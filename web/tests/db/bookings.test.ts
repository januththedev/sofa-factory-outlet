import { and, asc, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBooking, getAvailability } from '@/lib/bookings/api';
import { colomboToday, weekdayForDate } from '@/lib/bookings/rules';
import { closeDb, type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';

let db: Db;
const offsetDate = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const nextDateFor = (weekday: number, minimumDays = 1) => {
  const today = colomboToday();
  for (let offset = minimumDays; offset < 20; offset += 1) {
    const date = offsetDate(today, offset);
    if (weekdayForDate(date) === weekday) return date;
  }
  throw new Error('No matching date');
};
const makeInput = (date: string, slotId: number, phone = '077 123 4567') => ({
  name: 'Test Customer', phone, whatsappSame: true, email: 'test@example.com', city: 'Colombo', date, slotId,
  preferredContact: 'whatsapp' as const, consent: true as const, items: [] as Array<{ productId: number; variantId?: number; quantity: number }>,
});

beforeAll(async () => { db = await getDb(); });
afterAll(async () => { await closeDb(); });

describe('bookings database API', () => {
  it('returns one availability entry per requested date with seeded slots', async () => {
    const result = await getAvailability({ days: 7 });
    expect(result).toHaveLength(7);
    expect(result.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date))).toBe(true);
    expect(result.flatMap((day) => day.slots).every((slot) => slot.capacity === 3 && slot.remaining >= 0)).toBe(true);
  });

  it('creates a customer, booking, item and notification from database snapshots', async () => {
    const [slot] = await db.select().from(s.bookingSlots).where(eq(s.bookingSlots.weekday, 1)).orderBy(asc(s.bookingSlots.id)).limit(1);
    const [product] = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.status, 'published')).limit(1);
    const [variant] = await db.select({ id: s.productVariants.id }).from(s.productVariants).where(eq(s.productVariants.productId, product.id)).limit(1);
    const input = makeInput(nextDateFor(1), slot.id);
    input.items = [{ productId: product.id, variantId: variant.id, quantity: 2 }];
    const result = await createBooking(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reference).toMatch(/^SFO-B-\d{4,}$/);
    const [booking] = await db.select().from(s.bookings).where(eq(s.bookings.id, result.bookingId));
    const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, booking.customerId));
    const items = await db.select().from(s.bookingItems).where(eq(s.bookingItems.bookingId, booking.id));
    const notices = await db.select().from(s.notifications).where(eq(s.notifications.link, `/admin/bookings/${booking.id}/`));
    expect(customer.phone).toBe('+94771234567');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: product.id, variantId: variant.id, quantity: 2 });
    expect(notices).toHaveLength(1);
  });

  it('reuses a customer with the same normalised phone and increments references', async () => {
    const [slot] = await db.select().from(s.bookingSlots).where(eq(s.bookingSlots.weekday, 2)).limit(1);
    const date = nextDateFor(2);
    const first = await createBooking(makeInput(date, slot.id, '+94 76 222 3344'));
    const second = await createBooking({ ...makeInput(date, slot.id, '0762223344'), name: 'Updated Name' });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(Number(second.reference.slice(6))).toBeGreaterThan(Number(first.reference.slice(6)));
    const customers = await db.select().from(s.customers).where(eq(s.customers.phone, '+94762223344'));
    expect(customers).toHaveLength(1);
    expect(customers[0].name).toBe('Updated Name');
  });

  it('serialises concurrent capacity checks', async () => {
    const [slot] = await db.select().from(s.bookingSlots).where(eq(s.bookingSlots.weekday, 3)).limit(1);
    const date = nextDateFor(3);
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => createBooking(makeInput(date, slot.id, `0770000${String(index).padStart(3, '0')}`))));
    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(results.filter((result) => !result.ok && result.code === 'slot_full')).toHaveLength(7);
  });

  it('rejects closed weekdays and weekday mismatches', async () => {
    const [mondaySlot] = await db.select().from(s.bookingSlots).where(eq(s.bookingSlots.weekday, 1)).limit(1);
    expect(await createBooking(makeInput(nextDateFor(0), mondaySlot.id, '0773334444'))).toMatchObject({ ok: false, code: 'slot_closed' });
    expect(await createBooking(makeInput(nextDateFor(2), mondaySlot.id, '0773335555'))).toMatchObject({ ok: false, code: 'slot_closed' });
  });

  it('returns phone field errors before opening a transaction', async () => {
    const result = await createBooking(makeInput(nextDateFor(1), 1, 'not a phone'));
    expect(result).toMatchObject({ ok: false, code: 'invalid' });
    if (!result.ok) expect(result.fieldErrors?.phone).toBeTruthy();
  });

  it('ignores unpublished products', async () => {
    const [slot] = await db.select().from(s.bookingSlots).where(eq(s.bookingSlots.weekday, 4)).limit(1);
    const [hidden] = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.status, 'hidden')).limit(1);
    const input = makeInput(nextDateFor(4), slot.id, '0779998888');
    input.items = [{ productId: hidden.id, quantity: 1 }];
    const result = await createBooking(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(s.bookingItems)
      .where(and(eq(s.bookingItems.bookingId, result.bookingId), eq(s.bookingItems.productId, hidden.id)));
    expect(count).toBe(0);
  });
});
