import Papa from 'papaparse';
import { asc, count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addDays,
  allowedTransitions,
  BOOKING_STATUSES,
  bookingsCsv,
  bookingsQuery,
  buildContactMessage,
  buildReviewMessage,
  canTransition,
  changeBookingStatus,
  countNewBookings,
  csvCell,
  formatVisitDate,
  getBookingDetail,
  getBookingSheet,
  getCalendar,
  getRescheduleOptions,
  isRealDate,
  listBookedProducts,
  listBookings,
  markReviewRequested,
  parseBookingFilters,
  parseCalendarParams,
  parseRecordId,
  phoneSearchPatterns,
  rescheduleBooking,
  saveStaffNotes,
  streamBookingsCsv,
  summariseSource,
  toCsv,
  weekStart,
} from '@/lib/admin/bookings';
import {
  createCustomer,
  getCustomerDetail,
  isUniqueViolation,
  listCustomers,
  updateCustomer,
} from '@/lib/admin/customers';
import { colomboToday, weekdayForDate } from '@/lib/bookings/rules';
import { closeDb, type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import type { BookingStatus, ImageRef } from '@/lib/db/schema/types';

type Slot = typeof s.bookingSlots.$inferSelect;
type Customer = typeof s.customers.$inferSelect;
type Booking = typeof s.bookings.$inferSelect;
type Fixture = {
  id: number;
  name: string;
  slug: string;
  variantId: number;
  colourName: string;
  hex: string;
  image: ImageRef;
};

let db: Db;
let slots: Slot[] = [];
let productA: Fixture;
let productB: Fixture;
let referenceCounter = 0;
let phoneCounter = 0;

const today = colomboToday();
const nextReference = () => `SFO-B-T${String(++referenceCounter).padStart(3, '0')}`;
const nextPhone = () => `+9477222${String(++phoneCounter).padStart(4, '0')}`;

/** The first date at least `minimumDays` from today that falls on the weekday (0 = Sunday). */
function firstDate(weekday: number, minimumDays = 2): string {
  for (let offset = minimumDays; offset < minimumDays + 7; offset += 1) {
    const date = addDays(today, offset);
    if (weekdayForDate(date) === weekday) return date;
  }
  throw new Error('No matching date');
}

function slotAt(weekday: number, index: number): Slot {
  const slot = slots.filter((candidate) => candidate.weekday === weekday)[index];
  if (!slot) throw new Error(`No slot ${index} on weekday ${weekday}`);
  return slot;
}

async function addCustomer(
  name: string,
  phone: string = nextPhone(),
  extra: Partial<typeof s.customers.$inferInsert> = {},
): Promise<Customer> {
  const [row] = await db.insert(s.customers).values({ name, phone, ...extra }).returning();
  return row;
}

async function addBooking(
  customerId: number,
  date: string,
  slot: Slot | null,
  extra: Partial<typeof s.bookings.$inferInsert> = {},
): Promise<Booking> {
  const [row] = await db
    .insert(s.bookings)
    .values({
      reference: nextReference(),
      customerId,
      visitDate: date,
      slotId: slot ? slot.id : null,
      slotLabel: slot ? `${slot.start}–${slot.end}` : '10:00–12:00',
      ...extra,
    })
    .returning();
  return row;
}

async function addItem(bookingId: number, product: Fixture, quantity: number, priceMinor: number | null) {
  await db.insert(s.bookingItems).values({
    bookingId,
    productId: product.id,
    variantId: product.variantId,
    productName: product.name,
    productSlug: product.slug,
    colourName: product.colourName,
    hex: product.hex,
    image: product.image,
    quantity,
    priceMinor,
  });
}

/** A one-off booking in an open slot, for tests that change it. */
async function addOpenBooking(
  date: string,
  slot: Slot,
  status: BookingStatus = 'new',
  name = 'Move Test',
): Promise<Booking> {
  const customer = await addCustomer(name);
  return addBooking(customer.id, date, slot, { status });
}

async function statusOf(bookingId: number): Promise<BookingStatus> {
  const [row] = await db.select({ status: s.bookings.status }).from(s.bookings).where(eq(s.bookings.id, bookingId));
  return row.status;
}

async function bookingRow(bookingId: number): Promise<Booking> {
  const [row] = await db.select().from(s.bookings).where(eq(s.bookings.id, bookingId));
  return row;
}

const refs = (rows: Array<{ reference: string }>) => rows.map((row) => row.reference);
const filterFor = (params: Record<string, string>) => parseBookingFilters(params);

// Dates for the list fixtures: Monday to Thursday of one week, all inside the booking window.
const monday = firstDate(1);
const tuesday = addDays(monday, 1);
const wednesday = addDays(monday, 2);
const thursday = addDays(monday, 3);

let alice: Customer;
let bob: Customer;
let carol: Customer;
let b1: Booking;
let b2: Booking;
let b3: Booking;
let b4: Booking;
let b5: Booking;

beforeAll(async () => {
  db = await getDb();
  slots = await db.select().from(s.bookingSlots).orderBy(asc(s.bookingSlots.weekday), asc(s.bookingSlots.start));
  const rows = await db
    .select({
      id: s.products.id,
      name: s.products.name,
      slug: s.products.slug,
      variantId: s.productVariants.id,
      colourName: s.productVariants.colourName,
      hex: s.productVariants.hex,
      images: s.productVariants.images,
    })
    .from(s.products)
    .innerJoin(s.productVariants, eq(s.productVariants.productId, s.products.id))
    .where(eq(s.products.status, 'published'))
    .orderBy(asc(s.products.id), asc(s.productVariants.id));
  const found: Fixture[] = [];
  for (const row of rows) {
    const image = row.images[0];
    if (!image || found.some((product) => product.id === row.id)) continue;
    found.push({ ...row, image });
    if (found.length === 2) break;
  }
  [productA, productB] = found;

  alice = await addCustomer('Zed Alpha', '+94771110001', { city: 'Colombo', email: 'alpha@example.com' });
  bob = await addCustomer('Zed "Beta", Esq.', '+94771110002');
  carol = await addCustomer('Zed Gamma', '+94771110003', { city: 'Kandy' });
  b1 = await addBooking(alice.id, monday, slotAt(1, 0), {
    status: 'new',
    referrer: 'https://l.facebook.com/',
    sourcePage: '/product/emerald-sofa/',
    utm: { utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'diwali' },
  });
  await addItem(b1.id, productA, 2, 12_500_000);
  b2 = await addBooking(bob.id, monday, slotAt(1, 0), {
    status: 'contacted',
    staffNotes: 'Call after 5pm,\nask about "Olive"',
    customerNotes: 'Prefers morning',
  });
  await addItem(b2.id, productB, 1, null);
  b3 = await addBooking(carol.id, tuesday, slotAt(2, 0), { status: 'visited' });
  await addItem(b3.id, productA, 1, 12_500_000);
  b4 = await addBooking(alice.id, wednesday, slotAt(3, 0), { status: 'cancelled' });
  b5 = await addBooking(bob.id, thursday, slotAt(4, 1), { status: 'new' });
});

afterAll(closeDb);

describe('status rules', () => {
  it('allows only the pipeline moves, and nothing out of a final status', () => {
    expect(allowedTransitions('new')).toEqual(['contacted', 'visited', 'lost', 'cancelled']);
    expect(allowedTransitions('contacted')).toEqual(['visited', 'lost', 'cancelled']);
    expect(allowedTransitions('visited')).toEqual(['purchased', 'lost']);
    for (const final of ['purchased', 'lost', 'cancelled'] as const) expect(allowedTransitions(final)).toEqual([]);
  });

  it('never allows staying put or going backwards, and covers every status', () => {
    for (const status of BOOKING_STATUSES) expect(canTransition(status, status)).toBe(false);
    expect(canTransition('contacted', 'new')).toBe(false);
    expect(canTransition('visited', 'contacted')).toBe(false);
    expect(canTransition('visited', 'cancelled')).toBe(false);
    expect(canTransition('new', 'purchased')).toBe(false);
    expect(canTransition('lost', 'contacted')).toBe(false);
    expect(canTransition('cancelled', 'new')).toBe(false);
    expect(canTransition('visited', 'purchased')).toBe(true);
    expect(canTransition('new', 'visited')).toBe(true);
  });

  it('applies an allowed change and keeps a refused one out of the database', async () => {
    const booking = await addOpenBooking(thursday, slotAt(4, 2), 'new', 'Status Test');
    expect(await changeBookingStatus(booking.id, 'contacted')).toEqual({ ok: true, from: 'new', to: 'contacted' });
    expect(await statusOf(booking.id)).toBe('contacted');
    expect(await changeBookingStatus(booking.id, 'new')).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await changeBookingStatus(booking.id, 'purchased')).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await changeBookingStatus(booking.id, 'contacted')).toMatchObject({ ok: false, code: 'unchanged' });
    expect(await statusOf(booking.id)).toBe('contacted');
  });

  it('walks a booking through to a final status and then locks it', async () => {
    const booking = await addOpenBooking(thursday, slotAt(4, 3), 'new', 'Status Test');
    expect(await changeBookingStatus(booking.id, 'visited')).toMatchObject({ ok: true });
    expect(await changeBookingStatus(booking.id, 'purchased')).toMatchObject({ ok: true });
    const locked = await changeBookingStatus(booking.id, 'lost');
    expect(locked).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await statusOf(booking.id)).toBe('purchased');
  });

  it('rejects unknown statuses and unknown bookings', async () => {
    const booking = await addOpenBooking(thursday, slotAt(4, 3), 'new', 'Status Test');
    expect(await changeBookingStatus(booking.id, 'archived')).toMatchObject({ ok: false, code: 'invalid' });
    expect(await changeBookingStatus(987_654, 'contacted')).toMatchObject({ ok: false, code: 'not_found' });
  });
});

describe('rescheduling', () => {
  const friday = firstDate(5, 3);
  const saturday = firstDate(6, 3);
  const sunday = firstDate(0, 3);

  it('refuses a full slot, counts only bookings that hold a place, and moves into the freed place', async () => {
    const target = slotAt(5, 1);
    const first = await addOpenBooking(friday, target, 'new', 'Fill One');
    const second = await addOpenBooking(friday, target, 'contacted', 'Fill Two');
    await addOpenBooking(friday, target, 'visited', 'Fill Three');
    const mover = await addOpenBooking(saturday, slotAt(6, 0));

    const full = await rescheduleBooking({ bookingId: mover.id, date: friday, slotId: target.id });
    expect(full).toMatchObject({ ok: false, code: 'slot_full' });
    expect((await bookingRow(mover.id)).visitDate).toBe(saturday);

    await changeBookingStatus(second.id, 'cancelled');
    const moved = await rescheduleBooking({ bookingId: mover.id, date: friday, slotId: target.id });
    expect(moved).toEqual({ ok: true, visitDate: friday, slotLabel: `${target.start}–${target.end}` });
    const after = await bookingRow(mover.id);
    expect(after).toMatchObject({ visitDate: friday, slotId: target.id, slotLabel: `${target.start}–${target.end}` });
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(mover.updatedAt.getTime());

    const another = await addOpenBooking(saturday, slotAt(6, 0));
    expect(await rescheduleBooking({ bookingId: another.id, date: friday, slotId: target.id })).toMatchObject({
      ok: false,
      code: 'slot_full',
    });
    await changeBookingStatus(first.id, 'lost');
    expect(await rescheduleBooking({ bookingId: another.id, date: friday, slotId: target.id })).toMatchObject({ ok: true });
  });

  it('only offers days with a free place and never the slot the booking is already in', async () => {
    const target = slotAt(5, 3);
    const open = await addOpenBooking(friday, target, 'new', 'Option One');
    await addOpenBooking(friday, target, 'new', 'Option Two');
    await addOpenBooking(friday, target, 'new', 'Option Three');
    const options = await getRescheduleOptions({ date: friday, slotId: slotAt(5, 0).id });
    expect(options.length).toBeGreaterThan(5);
    expect(options.every((day) => weekdayForDate(day.date) !== 0)).toBe(true);
    expect(options.every((day) => day.slots.length > 0 && day.slots.every((slot) => slot.remaining > 0))).toBe(true);
    const day = options.find((candidate) => candidate.date === friday);
    expect(day?.slots.some((slot) => slot.slotId === target.id)).toBe(false);
    expect(day?.slots.some((slot) => slot.slotId === slotAt(5, 0).id)).toBe(false);
    expect(day?.slots.some((slot) => slot.slotId === slotAt(5, 2).id)).toBe(true);
    await changeBookingStatus(open.id, 'cancelled');
    const reopened = await getRescheduleOptions();
    const again = reopened.find((candidate) => candidate.date === friday);
    expect(again?.slots.some((slot) => slot.slotId === target.id)).toBe(true);
  });

  it('refuses a slot that does not run on that weekday, a closed day, and dates outside the window', async () => {
    const mover = await addOpenBooking(saturday, slotAt(6, 1));
    const fridaySlot = slotAt(5, 0);
    const saturdaySlot = slotAt(6, 0);
    const closed = { ok: false, code: 'slot_closed' };
    expect(await rescheduleBooking({ bookingId: mover.id, date: saturday, slotId: fridaySlot.id })).toMatchObject(closed);
    expect(await rescheduleBooking({ bookingId: mover.id, date: friday, slotId: saturdaySlot.id })).toMatchObject(closed);
    expect(await rescheduleBooking({ bookingId: mover.id, date: sunday, slotId: fridaySlot.id })).toMatchObject(closed);
    expect(await rescheduleBooking({ bookingId: mover.id, date: addDays(today, -3), slotId: fridaySlot.id })).toMatchObject(closed);
    expect(await rescheduleBooking({ bookingId: mover.id, date: addDays(today, 120), slotId: fridaySlot.id })).toMatchObject(closed);
    expect(await rescheduleBooking({ bookingId: mover.id, date: friday, slotId: 999_999 })).toMatchObject(closed);
    const unchanged = await bookingRow(mover.id);
    expect(unchanged).toMatchObject({ visitDate: saturday, slotId: slotAt(6, 1).id });
  });

  it('refuses to move a booking that has been visited or cancelled, and one that is already there', async () => {
    const slot = slotAt(5, 2);
    const visited = await addOpenBooking(saturday, slotAt(6, 2), 'visited');
    const cancelled = await addOpenBooking(saturday, slotAt(6, 2), 'cancelled');
    expect(await rescheduleBooking({ bookingId: visited.id, date: friday, slotId: slot.id })).toMatchObject({
      ok: false,
      code: 'not_open',
    });
    expect(await rescheduleBooking({ bookingId: cancelled.id, date: friday, slotId: slot.id })).toMatchObject({
      ok: false,
      code: 'not_open',
    });
    const open = await addOpenBooking(friday, slot, 'contacted');
    expect(await rescheduleBooking({ bookingId: open.id, date: friday, slotId: slot.id })).toMatchObject({
      ok: false,
      code: 'unchanged',
    });
  });

  it('reports bad input and unknown bookings without touching anything', async () => {
    const slot = slotAt(5, 0);
    expect(await rescheduleBooking({ bookingId: 1, date: 'next friday', slotId: slot.id })).toMatchObject({
      ok: false,
      code: 'invalid',
    });
    expect(await rescheduleBooking({ bookingId: 1, date: `${today.slice(0, 5)}02-31`, slotId: slot.id })).toMatchObject({
      ok: false,
      code: 'invalid',
    });
    expect(await rescheduleBooking({ bookingId: 0, date: friday, slotId: slot.id })).toMatchObject({
      ok: false,
      code: 'invalid',
    });
    expect(await rescheduleBooking({ bookingId: 987_654, date: friday, slotId: slot.id })).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });

  it('gives the last place to only one of two simultaneous moves', async () => {
    const target = slotAt(5, 0);
    await addOpenBooking(friday, target, 'new', 'Race Holder One');
    await addOpenBooking(friday, target, 'new', 'Race Holder Two');
    const racers = await Promise.all([
      addOpenBooking(saturday, slotAt(6, 3), 'new', 'Racer One'),
      addOpenBooking(saturday, slotAt(6, 3), 'new', 'Racer Two'),
    ]);
    const results = await Promise.all(
      racers.map((racer) => rescheduleBooking({ bookingId: racer.id, date: friday, slotId: target.id })),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === 'slot_full')).toHaveLength(1);
  });
});

describe('the list query', () => {
  const zed = (extra: Record<string, string> = {}) => filterFor({ q: 'Zed', ...extra });

  it('shows the newest visit date first by default and the oldest first on request', async () => {
    const newest = await listBookings(zed());
    expect(newest.total).toBe(5);
    expect(refs(newest.rows)).toEqual(refs([b5, b4, b3, b2, b1]));
    const oldest = await listBookings(zed({ sort: 'asc' }));
    expect(refs(oldest.rows)).toEqual(refs([b1, b2, b3, b4, b5]));
  });

  it('describes each row for the table', async () => {
    const { rows } = await listBookings(zed({ sort: 'asc' }));
    const [first, second, third, , last] = rows;
    expect(first).toMatchObject({
      customerName: 'Zed Alpha',
      phone: '+94771110001',
      email: 'alpha@example.com',
      city: 'Colombo',
      status: 'new',
      visitDate: monday,
      slotLabel: `${slotAt(1, 0).start}–${slotAt(1, 0).end}`,
      pieces: 2,
      source: { origin: 'Facebook (cpc)', detail: 'Campaign: diwali · Started on /product/emerald-sofa/' },
    });
    expect(first.items).toHaveLength(1);
    expect(first.items[0]).toMatchObject({ name: productA.name, quantity: 2, priceMinor: 12_500_000 });
    expect(first.items[0].image?.src).toContain(productA.image.key);
    expect(second.items[0].priceMinor).toBeNull();
    expect(third.status).toBe('visited');
    expect(last.items).toEqual([]);
    expect(last.pieces).toBe(0);
  });

  it('filters by status, by visit date range (either way round) and by product', async () => {
    expect(refs((await listBookings(zed({ status: 'new', sort: 'asc' }))).rows)).toEqual(refs([b1, b5]));
    expect(refs((await listBookings(zed({ status: 'cancelled' }))).rows)).toEqual(refs([b4]));
    const range = { from: tuesday, to: wednesday, sort: 'asc' };
    expect(refs((await listBookings(zed(range))).rows)).toEqual(refs([b3, b4]));
    expect(refs((await listBookings(zed({ from: wednesday, to: tuesday, sort: 'asc' }))).rows)).toEqual(refs([b3, b4]));
    expect(refs((await listBookings(zed({ from: thursday, sort: 'asc' }))).rows)).toEqual(refs([b5]));
    expect(refs((await listBookings(zed({ to: monday, sort: 'asc' }))).rows)).toEqual(refs([b1, b2]));
    const byProduct = await listBookings(zed({ product: String(productA.id), sort: 'asc' }));
    expect(refs(byProduct.rows)).toEqual(refs([b1, b3]));
    const combined = await listBookings(zed({ product: String(productA.id), status: 'new' }));
    expect(refs(combined.rows)).toEqual(refs([b1]));
  });

  it('ignores filter values that make no sense', async () => {
    const parsed = parseBookingFilters({
      status: 'archived',
      from: '2026-02-31',
      to: 'tomorrow',
      product: 'abc',
      page: '-4',
      sort: 'sideways',
      q: '   ',
    });
    expect(parsed).toEqual({ sort: 'desc', page: 1 });
    expect(parseBookingFilters({ status: ['lost', 'new'], page: '3', q: ' sofa ' })).toMatchObject({
      status: 'lost',
      page: 3,
      q: 'sofa',
    });
    const everything = await listBookings(parsed);
    expect(everything.total).toBeGreaterThanOrEqual(5);
  });

  it('searches by name, reference and any way of writing a phone number', async () => {
    const find = async (q: string) => refs((await listBookings(filterFor({ q, sort: 'asc' }))).rows);
    expect(await find('zed gamma')).toEqual(refs([b3]));
    expect(await find('Esq')).toEqual(refs([b2, b5]));
    expect(await find(b3.reference.toLowerCase())).toEqual(refs([b3]));
    expect(await find(b3.reference)).toEqual(refs([b3]));
    for (const phone of ['077 111 0002', '0771110002', '+94771110002', '+94 77 111 0002', '94771110002', '1110002']) {
      expect(await find(phone)).toEqual(refs([b2, b5]));
    }
    expect(await find('0771110003')).toEqual(refs([b3]));
    expect(await find('no such person')).toEqual([]);
  });

  it('takes % and _ in the search literally', async () => {
    const find = async (q: string) => (await listBookings(filterFor({ q }))).total;
    expect(await find('%')).toBe(0);
    expect(await find('Zed_Alpha')).toBe(0);
    expect(await find('Zed%Alpha')).toBe(0);
  });

  it('pages the results and clamps a page that is too far out', async () => {
    const first = await listBookings(zed({ sort: 'asc' }), 2);
    expect(first).toMatchObject({ total: 5, page: 1, pageCount: 3, pageSize: 2 });
    expect(refs(first.rows)).toEqual(refs([b1, b2]));
    const second = await listBookings(zed({ sort: 'asc', page: '2' }), 2);
    expect(refs(second.rows)).toEqual(refs([b3, b4]));
    const beyond = await listBookings(zed({ sort: 'asc', page: '9' }), 2);
    expect(beyond.page).toBe(3);
    expect(refs(beyond.rows)).toEqual(refs([b5]));
    const none = await listBookings(filterFor({ q: 'nobody at all' }));
    expect(none).toMatchObject({ total: 0, page: 1, pageCount: 1, rows: [] });
  });

  it('counts new bookings and lists the products that were booked', async () => {
    const [row] = await db.select({ value: count() }).from(s.bookings).where(eq(s.bookings.status, 'new'));
    expect(row.value).toBeGreaterThanOrEqual(2);
    expect(await countNewBookings()).toBe(row.value);
    const products = await listBookedProducts();
    expect(products.map((product) => product.id)).toEqual(expect.arrayContaining([productA.id, productB.id]));
    expect(products.map((product) => product.name)).toEqual([...products.map((product) => product.name)].sort());
  });

  it('rebuilds the same filter from the URL it wrote', () => {
    const filter = parseBookingFilters({
      q: 'Zed & co',
      status: 'new',
      from: monday,
      to: thursday,
      product: '7',
      sort: 'asc',
      page: '3',
    });
    const query = bookingsQuery(filter);
    const again = parseBookingFilters(Object.fromEntries(new URLSearchParams(query)));
    expect(again).toEqual(filter);
    expect(bookingsQuery(filter, { page: null })).not.toContain('page=');
    expect(bookingsQuery(filter, { sort: 'desc', page: null })).not.toContain('sort=');
    expect(bookingsQuery(parseBookingFilters({}))).toBe('');
  });
});

describe('the CSV export', () => {
  const parse = (text: string) => Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

  it('quotes commas, quotes and line breaks, and writes CRLF line ends', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell('windows\r\nlines')).toBe('"windows\r\nlines"');
    expect(csvCell(12)).toBe('12');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    const text = toCsv([['a,b', 'say "hi"', 'one\ntwo'], ['x', '', 'y']]);
    expect(text).toBe('"a,b","say ""hi""","one\ntwo"\r\nx,,y\r\n');
    expect(Papa.parse<string[]>(text, { skipEmptyLines: true }).data).toEqual([['a,b', 'say "hi"', 'one\ntwo'], ['x', '', 'y']]);
  });

  it('stops a spreadsheet from running text as a formula but leaves phone numbers alone', () => {
    expect(csvCell('=HYPERLINK("http://bad")')).toBe(`"'=HYPERLINK(""http://bad"")"`);
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('+94771234567')).toBe('+94771234567');
    expect(csvCell('+94 77 123 4567')).toBe('+94 77 123 4567');
    expect(csvCell('-5')).toBe('-5');
  });

  it('writes one row per booking with the list columns, and survives a round trip', async () => {
    const text = await bookingsCsv(filterFor({ q: 'Zed', sort: 'asc' }));
    const parsed = parse(text);
    expect(parsed.errors).toEqual([]);
    expect(parsed.meta.fields).toEqual([
      'Reference',
      'Status',
      'Visit date',
      'Slot',
      'Name',
      'Phone',
      'Email',
      'City',
      'Preferred contact',
      'Pieces',
      'Products',
      'How they found the site',
      'Customer notes',
      'Staff notes',
      'Booked on',
    ]);
    expect(parsed.data.map((row) => row.Reference)).toEqual(refs([b1, b2, b3, b4, b5]));
    const [first, second] = parsed.data;
    expect(first).toMatchObject({
      Status: 'New',
      'Visit date': monday,
      Name: 'Zed Alpha',
      Phone: '+94771110001',
      Email: 'alpha@example.com',
      Pieces: '2',
      Products: `${productA.name} (${productA.colourName}) x2`,
      'How they found the site': 'Facebook (cpc) · Campaign: diwali · Started on /product/emerald-sofa/',
    });
    expect(first['Booked on']).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    // Name with a comma and quotes, notes with a line break and quotes: all intact.
    expect(second.Name).toBe('Zed "Beta", Esq.');
    expect(second['Staff notes']).toBe('Call after 5pm,\nask about "Olive"');
    expect(second['Customer notes']).toBe('Prefers morning');
    expect(second['Preferred contact']).toBe('WhatsApp');
  });

  it('exports only what the filters match, from every page', async () => {
    const names = async (params: Record<string, string>) =>
      parse(await bookingsCsv(filterFor({ q: 'Zed', sort: 'asc', ...params }))).data.map((row) => row.Reference);
    expect(await names({ status: 'new' })).toEqual(refs([b1, b5]));
    expect(await names({ status: 'visited' })).toEqual(refs([b3]));
    expect(await names({ from: tuesday, to: wednesday })).toEqual(refs([b3, b4]));
    expect(await names({ product: String(productB.id) })).toEqual(refs([b2]));
    expect(await names({ q: '0771110003' })).toEqual(refs([b3]));
    // Page 2 of the list does not shorten the file.
    expect(await names({ page: '2' })).toEqual(refs([b1, b2, b3, b4, b5]));
    expect(await names({ status: 'lost' })).toEqual([]);
  });

  it('streams in batches without dropping or repeating a row', async () => {
    const chunks: string[] = [];
    for await (const chunk of streamBookingsCsv(filterFor({ q: 'Zed', sort: 'asc' }), 2)) chunks.push(chunk);
    expect(chunks).toHaveLength(4);
    const joined = chunks.join('');
    expect(joined).toBe(await bookingsCsv(filterFor({ q: 'Zed', sort: 'asc' })));
    expect(parse(joined).data.map((row) => row.Reference)).toEqual(refs([b1, b2, b3, b4, b5]));
    expect(parse(await bookingsCsv(filterFor({ q: 'nobody at all' }), 2)).data).toEqual([]);
  });
});

describe('one booking', () => {
  it('assembles the print sheet, with a total only when every item has a price', async () => {
    const priced = await getBookingSheet(b1.id);
    expect(priced).toMatchObject({
      id: b1.id,
      reference: b1.reference,
      status: 'new',
      visit: { date: monday, dateLabel: formatVisitDate(monday), preferredContact: 'whatsapp' },
      customer: { name: 'Zed Alpha', phone: '+94771110001', phoneLabel: '+94 77 111 0001', city: 'Colombo' },
      pieces: 2,
      totalMinor: 25_000_000,
      staffNotes: null,
    });
    expect(priced?.items[0]).toMatchObject({ name: productA.name, colourName: productA.colourName, lineMinor: 25_000_000 });
    expect(priced?.items[0].image?.src).toContain(productA.image.key);

    const onRequest = await getBookingSheet(b2.id);
    expect(onRequest?.totalMinor).toBeNull();
    expect(onRequest?.items[0]).toMatchObject({ priceMinor: null, lineMinor: null });
    expect(onRequest).toMatchObject({ customerNotes: 'Prefers morning', staffNotes: 'Call after 5pm,\nask about "Olive"' });

    const empty = await getBookingSheet(b5.id);
    expect(empty).toMatchObject({ items: [], pieces: 0, totalMinor: null });
    expect(await getBookingSheet(987_654)).toBeNull();
  });

  it('adds up several priced items and stays blank when one is on request', async () => {
    const customer = await addCustomer('Sheet Total');
    const booking = await addBooking(customer.id, monday, slotAt(1, 3));
    await addItem(booking.id, productA, 2, 10_000_000);
    await addItem(booking.id, productB, 3, 2_500_000);
    expect((await getBookingSheet(booking.id))?.totalMinor).toBe(27_500_000);
    await addItem(booking.id, productB, 1, null);
    const sheet = await getBookingSheet(booking.id);
    expect(sheet?.totalMinor).toBeNull();
    expect(sheet?.pieces).toBe(6);
  });

  it('gathers the detail page: customer history, invoices, chat and where they came from', async () => {
    const customer = await addCustomer('Detail Test', '+94771119999', { whatsapp: '+94771119999', notes: 'Likes oak' });
    const [conversation] = await db
      .insert(s.chatConversations)
      .values({ visitorId: 'visitor-1', sessionId: 'session-1' })
      .returning();
    await db.insert(s.chatMessages).values([
      { conversationId: conversation.id, role: 'user', text: 'Do you have an L-shape in green?' },
      { conversationId: conversation.id, role: 'assistant', text: 'Yes, we have several.' },
    ]);
    const past = await addBooking(customer.id, addDays(monday, -30), slotAt(1, 1), { status: 'purchased' });
    const booking = await addBooking(customer.id, monday, slotAt(1, 2), {
      conversationId: conversation.id,
      referrer: 'https://www.google.com/search?q=sofa',
      sourcePage: 'https://sofafactoryoutlet.lk/shop/?utm=1',
      city: 'Galle',
    });
    await addItem(booking.id, productA, 1, null);
    await db.insert(s.invoices).values([
      { customerId: customer.id, bookingId: booking.id, source: 'website', status: 'cancelled', number: 'SFO-T-0001' },
      { customerId: customer.id, bookingId: booking.id, source: 'website', status: 'issued', number: 'SFO-T-0002' },
      { customerId: customer.id, source: 'walk-in', status: 'draft' },
    ]);

    const detail = await getBookingDetail(booking.id);
    expect(detail).not.toBeNull();
    expect(detail?.sheet.customer).toMatchObject({ name: 'Detail Test', whatsapp: '+94771119999', city: 'Galle' });
    expect(detail?.customerRecordNotes).toBe('Likes oak');
    expect(detail?.chat.map((line) => [line.role, line.text])).toEqual([
      ['user', 'Do you have an L-shape in green?'],
      ['assistant', 'Yes, we have several.'],
    ]);
    expect(detail?.pastBookings.map((row) => row.id)).toEqual([past.id]);
    expect(detail?.invoices).toHaveLength(3);
    expect(detail?.bookingInvoice).toMatchObject({ number: 'SFO-T-0002', status: 'issued' });
    expect(detail?.source).toEqual({ origin: 'Google', detail: 'Started on /shop/' });
    expect(detail?.reviewRequestedAt).toBeNull();

    const plain = await getBookingDetail(past.id);
    expect(plain?.chat).toEqual([]);
    expect(plain?.bookingInvoice).toBeNull();
    expect(plain?.pastBookings.map((row) => row.id)).toEqual([booking.id]);
    expect(await getBookingDetail(987_654)).toBeNull();
  });

  it('saves, trims and clears staff notes', async () => {
    const booking = await addOpenBooking(thursday, slotAt(4, 3), 'new', 'Notes Test');
    expect(await saveStaffNotes(booking.id, '  call back on Friday  ')).toEqual({ ok: true });
    expect((await bookingRow(booking.id)).staffNotes).toBe('call back on Friday');
    expect(await saveStaffNotes(booking.id, '   ')).toEqual({ ok: true });
    expect((await bookingRow(booking.id)).staffNotes).toBeNull();
    expect(await saveStaffNotes(booking.id, 'x'.repeat(4001))).toMatchObject({ ok: false, code: 'invalid' });
    expect(await saveStaffNotes(987_654, 'hello')).toMatchObject({ ok: false, code: 'not_found' });
  });

  it('records the review request only after a visit', async () => {
    const fresh = await addOpenBooking(thursday, slotAt(4, 3), 'contacted', 'Review Test');
    expect(await markReviewRequested(fresh.id)).toMatchObject({ ok: false });
    expect((await bookingRow(fresh.id)).reviewRequestedAt).toBeNull();
    await changeBookingStatus(fresh.id, 'visited');
    const result = await markReviewRequested(fresh.id);
    expect(result.ok).toBe(true);
    expect((await bookingRow(fresh.id)).reviewRequestedAt).not.toBeNull();
    expect((await getBookingDetail(fresh.id))?.reviewRequestedAt).toBeInstanceOf(Date);
    expect(await markReviewRequested(987_654)).toMatchObject({ ok: false });
  });
});

describe('the calendar', () => {
  it('shows a Monday-to-Sunday week with how full each slot is', async () => {
    const week = await getCalendar({ view: 'week', date: wednesday });
    expect(week).toMatchObject({ view: 'week', from: monday, to: addDays(monday, 6), today });
    expect(week.prev).toBe(addDays(wednesday, -7));
    expect(week.next).toBe(addDays(wednesday, 7));
    expect(week.days.map((day) => day.date)).toEqual(Array.from({ length: 7 }, (_, index) => addDays(monday, index)));
    expect(week.days[6].slots).toEqual([]);
    const [first] = week.days;
    expect(first.slots).toHaveLength(4);
    const slot = first.slots[0];
    expect(slot).toMatchObject({ label: `${slotAt(1, 0).start}–${slotAt(1, 0).end}`, capacity: 3, booked: 2 });
    expect(slot.bookings.map((entry) => [entry.reference, entry.customerName, entry.pieces, entry.status])).toEqual([
      [b1.reference, 'Zed Alpha', 2, 'new'],
      [b2.reference, 'Zed "Beta", Esq.', 1, 'contacted'],
    ]);
    expect(first.slots[1]).toMatchObject({ capacity: 3, booked: 0, bookings: [] });
  });

  it('lists cancelled bookings but does not count them against the slot', async () => {
    const week = await getCalendar({ view: 'week', date: monday });
    const slot = week.days[2].slots[0];
    expect(slot.booked).toBe(0);
    expect(slot.bookings.map((entry) => [entry.reference, entry.status])).toEqual([[b4.reference, 'cancelled']]);
  });

  it('shows one day, steps by a day, and keeps bookings from slots that are no longer offered', async () => {
    const customer = await addCustomer('Orphan Test');
    const orphan = await addBooking(customer.id, tuesday, null, { slotLabel: '09:00–10:00' });
    const day = await getCalendar({ view: 'day', date: tuesday });
    expect(day).toMatchObject({ view: 'day', from: tuesday, to: tuesday, prev: monday, next: wednesday });
    expect(day.days).toHaveLength(1);
    const labels = day.days[0].slots.map((slot) => slot.label);
    expect(labels.slice(0, 4)).toEqual(['10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00']);
    expect(day.days[0].slots[4]).toMatchObject({ label: '09:00–10:00', capacity: null, booked: 1 });
    expect(day.days[0].slots[4].bookings[0].reference).toBe(orphan.reference);
    expect(day.days[0].slots[0].bookings.map((entry) => entry.reference)).toEqual([b3.reference]);
  });

  it('reads the view and date from the URL, falling back to a week around today', () => {
    expect(parseCalendarParams({ view: 'day', date: tuesday }, today)).toEqual({ view: 'day', date: tuesday });
    expect(parseCalendarParams({ view: 'month', date: '2026-13-01' }, today)).toEqual({ view: 'week', date: today });
    expect(parseCalendarParams({}, today)).toEqual({ view: 'week', date: today });
    expect(weekStart('2026-11-01')).toBe('2026-10-26');
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
    expect(weekStart('2026-10-28')).toBe('2026-10-26');
  });
});

describe('customers', () => {
  it('adds a walk-in with the phone normalised and the optional fields cleaned up', async () => {
    const result = await createCustomer({
      name: '  Nimal Perera ',
      phone: '077 123 9001',
      whatsapp: '+94 77 123 9001',
      email: ' nimal@example.com ',
      city: ' Galle ',
      address: '',
      notes: 'Walked in on Saturday',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = await db.select().from(s.customers).where(eq(s.customers.id, result.id));
    expect(row).toMatchObject({
      name: 'Nimal Perera',
      phone: '+94771239001',
      whatsapp: '+94771239001',
      email: 'nimal@example.com',
      city: 'Galle',
      address: null,
      notes: 'Walked in on Saturday',
    });
  });

  it('explains each field that is wrong', async () => {
    const result = await createCustomer({ name: 'A', phone: 'abc', whatsapp: '011 234 5678', email: 'not-an-email' });
    expect(result).toMatchObject({ ok: false, code: 'invalid' });
    if (result.ok || result.code !== 'invalid') return;
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(['email', 'name', 'phone', 'whatsapp']);
    const missing = await createCustomer({});
    expect(missing).toMatchObject({ ok: false, code: 'invalid' });
  });

  it('turns a clash on the phone number into a friendly message that names the other customer', async () => {
    const first = await createCustomer({ name: 'First Owner', phone: '0771239002' });
    expect(first.ok).toBe(true);
    const clash = await createCustomer({ name: 'Second Owner', phone: '+94 77 123 9002' });
    expect(clash).toMatchObject({
      ok: false,
      code: 'phone_taken',
      message: 'This phone number already belongs to First Owner.',
      fieldErrors: { phone: 'Another customer already uses this phone number.' },
      existing: { name: 'First Owner' },
    });
    const rows = await db.select().from(s.customers).where(eq(s.customers.phone, '+94771239002'));
    expect(rows).toHaveLength(1);
  });

  it('lets only one of two simultaneous adds win the same number', async () => {
    const results = await Promise.all([
      createCustomer({ name: 'Race One', phone: '0771239003' }),
      createCustomer({ name: 'Race Two', phone: '+94 77 123 9003' }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === 'phone_taken')).toHaveLength(1);
    const rows = await db.select().from(s.customers).where(eq(s.customers.phone, '+94771239003'));
    expect(rows).toHaveLength(1);
  });

  it('keeps phone numbers unique when editing, and normalises the new number', async () => {
    const one = await createCustomer({ name: 'Edit One', phone: '0771239004' });
    const two = await createCustomer({ name: 'Edit Two', phone: '0771239005' });
    if (!one.ok || !two.ok) throw new Error('Setup failed');

    const clash = await updateCustomer(two.id, { name: 'Edit Two', phone: '077 123 9004' });
    expect(clash).toMatchObject({ ok: false, code: 'phone_taken', existing: { id: one.id, name: 'Edit One' } });
    const [unchanged] = await db.select().from(s.customers).where(eq(s.customers.id, two.id));
    expect(unchanged.phone).toBe('+94771239005');

    const same = await updateCustomer(two.id, { name: 'Edit Two Renamed', phone: '+94 77 123 9005', city: 'Kandy' });
    expect(same).toEqual({ ok: true, id: two.id });
    const moved = await updateCustomer(two.id, { name: 'Edit Two Renamed', phone: '0771239006', notes: 'New number' });
    expect(moved).toEqual({ ok: true, id: two.id });
    const [after] = await db.select().from(s.customers).where(eq(s.customers.id, two.id));
    expect(after).toMatchObject({ phone: '+94771239006', name: 'Edit Two Renamed', city: null, notes: 'New number' });
    expect(after.updatedAt.getTime()).toBeGreaterThan(unchanged.createdAt.getTime() - 1);

    expect(await updateCustomer(two.id, { name: 'Edit Two', phone: 'nope' })).toMatchObject({ ok: false, code: 'invalid' });
    expect(await updateCustomer(987_654, { name: 'Nobody', phone: '0771239007' })).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });

  it('recognises a unique-constraint error even when the driver wraps it', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ message: 'failed', cause: { code: '23505' } })).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });

  it('lists customers with their booking and invoice counts, searchable by phone in any format', async () => {
    const found = await listCustomers({ q: 'Detail Test' });
    expect(found.total).toBe(1);
    expect(found.rows[0]).toMatchObject({
      name: 'Detail Test',
      phone: '+94771119999',
      phoneLabel: '+94 77 111 9999',
      bookings: 2,
      invoices: 3,
    });
    for (const q of ['077 111 9999', '0771119999', '+94771119999', '1119999']) {
      expect((await listCustomers({ q })).rows.map((row) => row.name)).toEqual(['Detail Test']);
    }
    expect((await listCustomers({ q: 'kandy' })).rows.map((row) => row.name)).toEqual(
      expect.arrayContaining(['Zed Gamma']),
    );
    expect((await listCustomers({ q: '%' })).total).toBe(0);
    const alpha = (await listCustomers({ q: 'Zed Alpha' })).rows[0];
    expect(alpha).toMatchObject({ bookings: 2, invoices: 0 });
    expect(alpha.lastActivity.getTime()).toBeGreaterThanOrEqual(alice.createdAt.getTime());
  });

  it('puts the customer with the newest activity first and pages the list', async () => {
    const everyone = await listCustomers();
    expect(everyone.total).toBeGreaterThan(10);
    const times = everyone.rows.map((row) => row.lastActivity.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    const beyond = await listCustomers({ page: 99 });
    expect(beyond.page).toBe(beyond.pageCount);
  });

  it('shows a customer with every booking and invoice', async () => {
    const [customer] = await db.select().from(s.customers).where(eq(s.customers.phone, '+94771119999'));
    const detail = await getCustomerDetail(customer.id);
    expect(detail?.customer).toMatchObject({ name: 'Detail Test', phoneLabel: '+94 77 111 9999' });
    expect(detail?.bookings).toHaveLength(2);
    const dates = (detail?.bookings ?? []).map((booking) => booking.visitDate);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(detail?.invoices.map((invoice) => invoice.status).sort()).toEqual(['cancelled', 'draft', 'issued']);
    expect(await getCustomerDetail(987_654)).toBeNull();
  });
});

describe('small helpers', () => {
  it('summarises how someone found the site', () => {
    expect(summariseSource({})).toEqual({ origin: 'Direct', detail: null });
    expect(summariseSource({ referrer: 'https://www.google.com/' })).toEqual({ origin: 'Google', detail: null });
    expect(summariseSource({ referrer: 'https://m.facebook.com/' }).origin).toBe('Facebook');
    expect(summariseSource({ referrer: 'https://api.whatsapp.com/send' }).origin).toBe('WhatsApp');
    expect(summariseSource({ referrer: 'https://www.ikman.lk/en/ads' }).origin).toBe('ikman.lk');
    expect(summariseSource({ referrer: 'a friend' }).origin).toBe('a friend');
    expect(summariseSource({ utm: { utm_source: 'instagram' }, referrer: 'https://www.google.com/' }).origin).toBe('Instagram');
    expect(summariseSource({ utm: { source: 'newsletter', medium: 'email' } }).origin).toBe('Newsletter (email)');
    expect(summariseSource({ sourcePage: '/product/olive-sofa/' }).detail).toBe('Started on /product/olive-sofa/');
    expect(summariseSource({ sourcePage: 'https://sofafactoryoutlet.lk/cart/?x=1' }).detail).toBe('Started on /cart/');
  });

  it('writes the review request with the Google link when there is one, and a plain thank-you when not', () => {
    const withLink = buildReviewMessage({
      customerName: 'Nimal Perera',
      businessName: 'Sofa Factory Outlet',
      reviewUrl: ' https://g.page/r/example/review ',
    });
    expect(withLink).toContain('Hi Nimal,');
    expect(withLink).toContain('thank you for visiting Sofa Factory Outlet');
    expect(withLink).toContain('https://g.page/r/example/review');
    for (const missing of [null, undefined, '', '   ']) {
      const plain = buildReviewMessage({ customerName: 'Nimal Perera', businessName: 'Sofa Factory Outlet', reviewUrl: missing });
      expect(plain).toContain('thank you for visiting Sofa Factory Outlet');
      expect(plain).not.toContain('http');
      expect(plain).not.toContain('Google');
    }
    expect(buildReviewMessage({ customerName: '  ', businessName: 'Shop', reviewUrl: null })).toMatch(/^Hello, thank you/);
  });

  it('writes the booking greeting', () => {
    const message = buildContactMessage({
      customerName: 'Nimal Perera',
      businessName: 'Sofa Factory Outlet',
      reference: 'SFO-B-0042',
      visitDate: '2026-10-28',
      slotLabel: '10:00–12:00',
    });
    expect(message).toBe(
      `Hi Nimal, this is Sofa Factory Outlet about your showroom visit SFO-B-0042 on ${formatVisitDate('2026-10-28')}, 10:00–12:00.`,
    );
  });

  it('builds phone search patterns and checks ids and dates', () => {
    expect(phoneSearchPatterns('077 123 4567')).toEqual(['0771234567', '771234567']);
    expect(phoneSearchPatterns('+94771234567')).toEqual(['+94771234567', '771234567']);
    expect(phoneSearchPatterns('7712')).toEqual(['7712']);
    expect(phoneSearchPatterns('12')).toEqual([]);
    expect(phoneSearchPatterns('sofa')).toEqual([]);
    expect(parseRecordId('42')).toBe(42);
    for (const bad of ['0', '-1', '1.5', 'abc', '', '99999999999', '12 ', undefined]) expect(parseRecordId(bad)).toBeNull();
    expect(isRealDate('2026-02-28')).toBe(true);
    expect(isRealDate('2026-02-31')).toBe(false);
    expect(isRealDate('2026-2-3')).toBe(false);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});
