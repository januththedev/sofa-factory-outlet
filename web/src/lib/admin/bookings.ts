import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { z } from 'zod';
import { getAvailability } from '@/lib/bookings/api';
import { colomboToday, weekdayForDate } from '@/lib/bookings/rules';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import type { BookingStatus, InvoiceStatus } from '@/lib/db/schema/types';
import { pictureData, type PictureData } from '@/lib/images/urls';
import { formatLkPhone } from '@/lib/phone';

// Everything the admin Bookings section needs from the database. Pages, server actions and the
// CSV route call these functions; the functions never check the session themselves.

// ---------------------------------------------------------------------------------------------
// Status model

export const BOOKING_STATUSES = [
  'new',
  'contacted',
  'visited',
  'purchased',
  'lost',
  'cancelled',
] as const;

export const STATUS_LABELS: Record<BookingStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  visited: 'Visited',
  purchased: 'Purchased',
  lost: 'Lost',
  cancelled: 'Cancelled',
};

export type StatusTone =
  | 'neutral'
  | 'maroon'
  | 'good'
  | 'warn'
  | 'bad'
  | 'dark';

export const STATUS_TONES: Record<BookingStatus, StatusTone> = {
  new: 'maroon',
  contacted: 'warn',
  visited: 'dark',
  purchased: 'good',
  lost: 'bad',
  cancelled: 'neutral',
};

// New → Contacted → Visited → Purchased / Lost, plus Cancelled. A walk-in can go straight from New
// to Visited. Lost and cancelled bookings free their slot (the availability query ignores them),
// so they can never be reopened; that keeps capacity honest without a second check.
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  new: ['contacted', 'visited', 'lost', 'cancelled'],
  contacted: ['visited', 'lost', 'cancelled'],
  visited: ['purchased', 'lost'],
  purchased: [],
  lost: [],
  cancelled: [],
};

/** The one place that says which status changes are allowed. */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(
  from: BookingStatus,
): readonly BookingStatus[] {
  return TRANSITIONS[from];
}

export function isBookingStatus(value: unknown): value is BookingStatus {
  return (
    typeof value === 'string' &&
    (BOOKING_STATUSES as readonly string[]).includes(value)
  );
}

/** Bookings that can still be moved to another date or slot. */
export function isOpenBooking(status: BookingStatus): boolean {
  return status === 'new' || status === 'contacted';
}

/** Cancelled and lost bookings no longer hold a place in a slot (same rule as getAvailability). */
const RELEASED: BookingStatus[] = ['cancelled', 'lost'];

export const PREFERRED_CONTACT_LABELS = {
  whatsapp: 'WhatsApp',
  call: 'Phone call',
  email: 'Email',
} as const;

// ---------------------------------------------------------------------------------------------
// Small pure helpers

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ID = 2_147_483_647;

/** True for a real calendar date written YYYY-MM-DD (rejects 2026-02-31). */
export function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/** A route parameter such as the [id] of /admin/bookings/[id]/, or null when it is not a usable id. */
export function parseRecordId(value: string | undefined): number | null {
  if (!value || !/^\d{1,10}$/.test(value)) return null;
  const id = Number(value);
  return id >= 1 && id <= MAX_ID ? id : null;
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** The Monday of the week that contains the date. */
export function weekStart(date: string): string {
  return addDays(date, -((weekdayForDate(date) + 6) % 7));
}

const visitDateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dayLabelFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const longDayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
});

const colomboDateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const atMidnight = (date: string) => new Date(`${date}T00:00:00Z`);

/** "Wed 28 Oct 2026" for a YYYY-MM-DD visit date. */
export function formatVisitDate(date: string): string {
  return isRealDate(date) ? visitDateFormat.format(atMidnight(date)) : date;
}

/** "Wed 28 Oct" for a calendar column heading. */
export function formatDayLabel(date: string): string {
  return isRealDate(date) ? dayLabelFormat.format(atMidnight(date)) : date;
}

/** "28 Oct 2026, 14:05" in Colombo time. */
export function formatColomboDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '' : colomboDateTimeFormat.format(date);
}

/** Colombo date and time as "2026-10-28 14:05", for the CSV file. */
function colomboStamp(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  return `${pick('year')}-${pick('month')}-${pick('day')} ${hour}:${pick('minute')}`;
}

/** A LIKE pattern that matches the text anywhere, with %, _ and \ taken literally. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * Patterns for searching stored +94 numbers by what staff type: "077 123 4567", "0771234567",
 * "+94771234567" or just "7712". Returns an empty list when the text does not look like a number.
 */
export function phoneSearchPatterns(text: string): string[] {
  const compact = text.replace(/[\s\-().]/g, '');
  if (!/^\+?\d{3,}$/.test(compact)) return [];
  const local = compact.replace(/^\+/, '').replace(/^(0094|94|0)/, '');
  return Array.from(new Set([compact, local])).filter(
    (pattern) => pattern.length >= 3,
  );
}

const firstWord = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/** The pre-filled WhatsApp message that asks a customer who visited for a Google review. */
export function buildReviewMessage(input: {
  customerName: string;
  businessName: string;
  reviewUrl: string | null | undefined;
}): string {
  const first = firstWord(input.customerName);
  const greeting = first ? `Hi ${first},` : 'Hello,';
  const thanks = `${greeting} thank you for visiting ${input.businessName}.`;
  const url = input.reviewUrl?.trim();
  if (url)
    return `${thanks} If you have a minute, would you share your experience on Google? ${url}`;
  return `${thanks} If you have any questions about the pieces you saw, just reply to this message.`;
}

/** The pre-filled WhatsApp greeting for a booking. */
export function buildContactMessage(input: {
  customerName: string;
  businessName: string;
  reference: string;
  visitDate: string;
  slotLabel: string;
}): string {
  const first = firstWord(input.customerName);
  const greeting = first ? `Hi ${first},` : 'Hello,';
  const visit = `${formatVisitDate(input.visitDate)}, ${input.slotLabel}`;
  return `${greeting} this is ${input.businessName} about your showroom visit ${input.reference} on ${visit}.`;
}

// ---------------------------------------------------------------------------------------------
// How they found the site

export type SourceSummary = { origin: string; detail: string | null };

const KNOWN_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)google\./, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
];

const capitalise = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

function referrerName(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  let host: string;
  try {
    host = new URL(text).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return text.slice(0, 60);
  }
  const known = KNOWN_HOSTS.find(([pattern]) => pattern.test(host));
  return known ? known[1] : host;
}

function pagePath(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  try {
    return new URL(text, 'https://example.invalid').pathname.slice(0, 120);
  } catch {
    return text.slice(0, 120);
  }
}

/** One short line for the list: the campaign or referrer, plus the page the booking started on. */
export function summariseSource(input: {
  sourcePage?: string | null;
  referrer?: string | null;
  utm?: Record<string, string> | null;
}): SourceSummary {
  const utm = input.utm ?? {};
  const source = (utm.utm_source ?? utm.source ?? '').trim();
  const medium = (utm.utm_medium ?? utm.medium ?? '').trim();
  const campaign = (utm.utm_campaign ?? utm.campaign ?? '').trim();
  let origin = referrerName(input.referrer) ?? 'Direct';
  if (source)
    origin = medium ? `${capitalise(source)} (${medium})` : capitalise(source);
  const details: string[] = [];
  if (campaign) details.push(`Campaign: ${campaign}`);
  const page = pagePath(input.sourcePage);
  if (page) details.push(`Started on ${page}`);
  return { origin, detail: details.length > 0 ? details.join(' · ') : null };
}

// ---------------------------------------------------------------------------------------------
// Items

export type ItemView = {
  id: number;
  productId: number | null;
  name: string;
  slug: string | null;
  colourName: string | null;
  hex: string | null;
  quantity: number;
  /** Price per piece when the booking was made; null means "on request". */
  priceMinor: number | null;
  lineMinor: number | null;
  image: PictureData | null;
};

function toItemView(row: typeof s.bookingItems.$inferSelect): ItemView {
  return {
    id: row.id,
    productId: row.productId,
    name: row.productName,
    slug: row.productSlug,
    colourName: row.colourName,
    hex: row.hex,
    quantity: row.quantity,
    priceMinor: row.priceMinor,
    lineMinor: row.priceMinor === null ? null : row.priceMinor * row.quantity,
    image: row.image ? pictureData(row.image) : null,
  };
}

/** Pieces in total, and a money total only when every item has a price. */
export function itemsTotal(
  items: Array<Pick<ItemView, 'quantity' | 'priceMinor'>>,
): {
  pieces: number;
  totalMinor: number | null;
} {
  const pieces = items.reduce((sum, item) => sum + item.quantity, 0);
  const allPriced =
    items.length > 0 && items.every((item) => item.priceMinor !== null);
  const totalMinor = allPriced
    ? items.reduce(
        (sum, item) => sum + (item.priceMinor ?? 0) * item.quantity,
        0,
      )
    : null;
  return { pieces, totalMinor };
}

async function itemsByBooking(ids: number[]): Promise<Map<number, ItemView[]>> {
  const map = new Map<number, ItemView[]>();
  if (ids.length === 0) return map;
  const db = await getDb();
  const rows = await db
    .select()
    .from(s.bookingItems)
    .where(inArray(s.bookingItems.bookingId, ids))
    .orderBy(asc(s.bookingItems.id));
  for (const row of rows) {
    const list = map.get(row.bookingId) ?? [];
    list.push(toItemView(row));
    map.set(row.bookingId, list);
  }
  return map;
}

// ---------------------------------------------------------------------------------------------
// List: filters, query, pagination

export const PAGE_SIZE = 25;

export type SortDirection = 'asc' | 'desc';

export type BookingFilter = {
  q?: string;
  status?: BookingStatus;
  /** First visit date, YYYY-MM-DD, inclusive. */
  from?: string;
  /** Last visit date, YYYY-MM-DD, inclusive. */
  to?: string;
  productId?: number;
  sort: SortDirection;
  page: number;
};

type ParamInput = Record<string, string | string[] | undefined>;

const statusField = z.enum(BOOKING_STATUSES);
const dateField = z.string().refine(isRealDate);
const idField = z.coerce.number().int().min(1).max(MAX_ID);
const pageField = z.coerce.number().int().min(1).max(10_000);

function firstValue(value: string | string[] | undefined): string | undefined {
  const first = (Array.isArray(value) ? value[0] : value)?.trim();
  return first ? first : undefined;
}

/** Reads the list filters from URL parameters. Bad values are ignored, never an error. */
export function parseBookingFilters(input: ParamInput): BookingFilter {
  const status = statusField.safeParse(firstValue(input.status));
  const from = dateField.safeParse(firstValue(input.from));
  const to = dateField.safeParse(firstValue(input.to));
  const product = idField.safeParse(firstValue(input.product));
  const page = pageField.safeParse(firstValue(input.page));
  const q = firstValue(input.q)?.slice(0, 100);
  let first = from.success ? from.data : undefined;
  let last = to.success ? to.data : undefined;
  if (first && last && first > last) [first, last] = [last, first];
  return {
    q: q ? q : undefined,
    status: status.success ? status.data : undefined,
    from: first,
    to: last,
    productId: product.success ? product.data : undefined,
    sort: firstValue(input.sort) === 'asc' ? 'asc' : 'desc',
    page: page.success ? page.data : 1,
  };
}

/** URL parameters for the filter, optionally with another page or sort order. */
export function bookingsQuery(
  filter: BookingFilter,
  overrides: { page?: number | null; sort?: SortDirection } = {},
): string {
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.status) params.set('status', filter.status);
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  if (filter.productId) params.set('product', String(filter.productId));
  if ((overrides.sort ?? filter.sort) === 'asc') params.set('sort', 'asc');
  const page = overrides.page === undefined ? filter.page : overrides.page;
  if (page && page > 1) params.set('page', String(page));
  return params.toString();
}

function filterWhere(filter: BookingFilter): SQL | undefined {
  const conditions: SQL[] = [];
  if (filter.status) conditions.push(eq(s.bookings.status, filter.status));
  if (filter.from) conditions.push(gte(s.bookings.visitDate, filter.from));
  if (filter.to) conditions.push(lte(s.bookings.visitDate, filter.to));
  if (filter.productId) {
    conditions.push(sql`exists (
      select 1 from ${s.bookingItems}
      where ${s.bookingItems.bookingId} = ${s.bookings.id} and ${s.bookingItems.productId} = ${filter.productId}
    )`);
  }
  if (filter.q) {
    const matches = [
      ilike(s.customers.name, likePattern(filter.q)),
      ilike(s.bookings.reference, likePattern(filter.q)),
      ...phoneSearchPatterns(filter.q).map((pattern) =>
        ilike(s.customers.phone, likePattern(pattern)),
      ),
    ];
    const search = or(...matches);
    if (search) conditions.push(search);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export type BookingListRow = {
  id: number;
  reference: string;
  status: BookingStatus;
  visitDate: string;
  slotLabel: string;
  customerId: number;
  customerName: string;
  phone: string;
  email: string | null;
  city: string | null;
  preferredContact: keyof typeof PREFERRED_CONTACT_LABELS;
  customerNotes: string | null;
  staffNotes: string | null;
  createdAt: Date;
  source: SourceSummary;
  items: ItemView[];
  pieces: number;
};

async function selectRows(
  filter: BookingFilter,
  limit: number,
  offset: number,
): Promise<BookingListRow[]> {
  const db = await getDb();
  const direction = filter.sort === 'asc' ? asc : desc;
  const records = await db
    .select({ booking: s.bookings, customer: s.customers })
    .from(s.bookings)
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(filterWhere(filter))
    .orderBy(
      direction(s.bookings.visitDate),
      direction(s.bookings.slotLabel),
      direction(s.bookings.id),
    )
    .limit(limit)
    .offset(offset);
  const items = await itemsByBooking(
    records.map((record) => record.booking.id),
  );
  return records.map(({ booking, customer }) => {
    const bookingItems = items.get(booking.id) ?? [];
    return {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      visitDate: booking.visitDate,
      slotLabel: booking.slotLabel,
      customerId: customer.id,
      customerName: booking.contactSnapshot?.name ?? customer.name,
      phone: customer.phone,
      email: booking.contactSnapshot?.email ?? customer.email,
      city: booking.city ?? customer.city,
      preferredContact: booking.preferredContact,
      customerNotes: booking.customerNotes,
      staffNotes: booking.staffNotes,
      createdAt: booking.createdAt,
      source: summariseSource(booking),
      items: bookingItems,
      pieces: itemsTotal(bookingItems).pieces,
    };
  });
}

async function countRows(filter: BookingFilter): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ value: count() })
    .from(s.bookings)
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(filterWhere(filter));
  return row.value;
}

export type BookingPage = {
  rows: BookingListRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

/** One page of bookings for the filter, newest or oldest visit date first. */
export async function listBookings(
  filter: BookingFilter,
  pageSize: number = PAGE_SIZE,
): Promise<BookingPage> {
  const total = await countRows(filter);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filter.page), pageCount);
  const rows =
    total === 0
      ? []
      : await selectRows(filter, pageSize, (page - 1) * pageSize);
  return { rows, total, page, pageCount, pageSize };
}

/** Bookings still waiting for a first contact; the "New" count at the top of the list. */
export async function countNewBookings(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ value: count() })
    .from(s.bookings)
    .where(eq(s.bookings.status, 'new'));
  return row.value;
}

/** Products that appear in at least one booking, for the product filter. */
export async function listBookedProducts(): Promise<
  Array<{ id: number; name: string }>
> {
  const db = await getDb();
  return db
    .select({ id: s.products.id, name: s.products.name })
    .from(s.products)
    .where(
      inArray(
        s.products.id,
        db
          .selectDistinct({ id: s.bookingItems.productId })
          .from(s.bookingItems)
          .where(isNotNull(s.bookingItems.productId)),
      ),
    )
    .orderBy(asc(s.products.name));
}

// ---------------------------------------------------------------------------------------------
// CSV export

/** One CSV cell: quoted when it holds a comma, quote or line break, and safe to open in a spreadsheet. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Spreadsheets run cells that start with = + - @ as formulas. Numbers and phone numbers
  // (+94 77 123 4567) are left alone; anything else gets a leading apostrophe.
  const formula =
    /^[=@\t\r]/.test(text) ||
    (/^[+-]/.test(text) && !/^[+-]?[\d\s().-]+$/.test(text));
  if (formula) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvLine(
  cells: Array<string | number | null | undefined>,
): string {
  return `${cells.map(csvCell).join(',')}\r\n`;
}

export function toCsv(
  rows: Array<Array<string | number | null | undefined>>,
): string {
  return rows.map(csvLine).join('');
}

export const BOOKING_CSV_HEADERS = [
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
];

function itemSummary(item: ItemView): string {
  const colour = item.colourName ? ` (${item.colourName})` : '';
  return `${item.name}${colour} x${item.quantity}`;
}

export function bookingCsvRow(
  row: BookingListRow,
): Array<string | number | null> {
  const source = [row.source.origin, row.source.detail]
    .filter(Boolean)
    .join(' · ');
  return [
    row.reference,
    STATUS_LABELS[row.status],
    row.visitDate,
    row.slotLabel,
    row.customerName,
    row.phone,
    row.email,
    row.city,
    PREFERRED_CONTACT_LABELS[row.preferredContact],
    row.pieces,
    row.items.map(itemSummary).join('; '),
    source,
    row.customerNotes,
    row.staffNotes,
    colomboStamp(row.createdAt),
  ];
}

const EXPORT_BATCH = 200;

/** The CSV for every booking that matches the filter (all pages), produced a batch at a time. */
export async function* streamBookingsCsv(
  filter: BookingFilter,
  batchSize: number = EXPORT_BATCH,
): AsyncGenerator<string, void, undefined> {
  yield csvLine(BOOKING_CSV_HEADERS);
  let offset = 0;
  for (;;) {
    const rows = await selectRows(filter, batchSize, offset);
    if (rows.length > 0)
      yield rows.map((row) => csvLine(bookingCsvRow(row))).join('');
    if (rows.length < batchSize) return;
    offset += rows.length;
  }
}

export async function bookingsCsv(
  filter: BookingFilter,
  batchSize: number = EXPORT_BATCH,
): Promise<string> {
  let text = '';
  for await (const chunk of streamBookingsCsv(filter, batchSize)) text += chunk;
  return text;
}

// ---------------------------------------------------------------------------------------------
// One booking: the sheet and the detail page

export type InvoiceLink = {
  id: number;
  number: string | null;
  type: 'invoice' | 'quotation';
  status: InvoiceStatus;
  totalMinor: number;
  paidMinor: number;
  createdAt: Date;
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  partially_paid: 'Part paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

/** "SFO-2026-0001", or "Draft invoice" / "Draft quotation" until a number is issued. */
export function invoiceTitle(
  invoice: Pick<InvoiceLink, 'number' | 'type'>,
): string {
  if (invoice.number) return invoice.number;
  return invoice.type === 'quotation' ? 'Draft quotation' : 'Draft invoice';
}

export type PastBooking = {
  id: number;
  reference: string;
  visitDate: string;
  slotLabel: string;
  status: BookingStatus;
};

type Core = {
  booking: typeof s.bookings.$inferSelect;
  customer: typeof s.customers.$inferSelect;
  items: ItemView[];
};

async function loadCore(bookingId: number): Promise<Core | null> {
  const db = await getDb();
  const [row] = await db
    .select({ booking: s.bookings, customer: s.customers })
    .from(s.bookings)
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(eq(s.bookings.id, bookingId))
    .limit(1);
  if (!row) return null;
  const items = await itemsByBooking([bookingId]);
  return {
    booking: row.booking,
    customer: row.customer,
    items: items.get(bookingId) ?? [],
  };
}

export type BookingSheet = {
  id: number;
  reference: string;
  status: BookingStatus;
  bookedOn: string;
  visit: {
    date: string;
    dateLabel: string;
    slotLabel: string;
    preferredContact: keyof typeof PREFERRED_CONTACT_LABELS;
  };
  customer: {
    name: string;
    phone: string;
    phoneLabel: string;
    whatsapp: string | null;
    email: string | null;
    city: string | null;
  };
  items: ItemView[];
  pieces: number;
  /** Null unless every item has a price. */
  totalMinor: number | null;
  customerNotes: string | null;
  staffNotes: string | null;
};

function toSheet(core: Core): BookingSheet {
  const { booking, customer, items } = core;
  const totals = itemsTotal(items);
  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    bookedOn: formatColomboDateTime(booking.createdAt),
    visit: {
      date: booking.visitDate,
      dateLabel: formatVisitDate(booking.visitDate),
      slotLabel: booking.slotLabel,
      preferredContact: booking.preferredContact,
    },
    customer: {
      name: booking.contactSnapshot?.name ?? customer.name,
      phone: customer.phone,
      phoneLabel: formatLkPhone(customer.phone),
      whatsapp: customer.whatsapp,
      email: booking.contactSnapshot?.email ?? customer.email,
      city: booking.city ?? customer.city,
    },
    items,
    pieces: totals.pieces,
    totalMinor: totals.totalMinor,
    customerNotes: booking.customerNotes,
    staffNotes: booking.staffNotes,
  };
}

/** Everything the one-page print sheet shows. */
export async function getBookingSheet(
  bookingId: number,
): Promise<BookingSheet | null> {
  const core = await loadCore(bookingId);
  return core ? toSheet(core) : null;
}

export type ChatLine = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  createdAt: Date;
};

export type BookingDetail = {
  sheet: BookingSheet;
  customerId: number;
  /** Saved on the customer record, not on this booking. */
  customerRecordNotes: string | null;
  slotId: number | null;
  createdAt: Date;
  updatedAt: Date;
  reviewRequestedAt: Date | null;
  conversationId: number | null;
  source: SourceSummary;
  referrer: string | null;
  sourcePage: string | null;
  utm: Record<string, string> | null;
  chat: ChatLine[];
  pastBookings: PastBooking[];
  invoices: InvoiceLink[];
  /** The live invoice made from this booking, when there is one. */
  bookingInvoice: InvoiceLink | null;
};

const invoiceColumns = {
  id: s.invoices.id,
  number: s.invoices.number,
  type: s.invoices.type,
  status: s.invoices.status,
  totalMinor: s.invoices.totalMinor,
  paidMinor: s.invoices.paidMinor,
  createdAt: s.invoices.createdAt,
};

/** Recent invoices for a customer, newest first. */
export async function listInvoiceLinks(
  customerId: number,
  limit = 30,
): Promise<InvoiceLink[]> {
  const db = await getDb();
  return db
    .select(invoiceColumns)
    .from(s.invoices)
    .where(eq(s.invoices.customerId, customerId))
    .orderBy(desc(s.invoices.createdAt), desc(s.invoices.id))
    .limit(limit);
}

export async function getBookingDetail(
  bookingId: number,
): Promise<BookingDetail | null> {
  const core = await loadCore(bookingId);
  if (!core) return null;
  const { booking, customer } = core;
  const db = await getDb();
  const chat = booking.conversationId
    ? await db
        .select({
          id: s.chatMessages.id,
          role: s.chatMessages.role,
          text: s.chatMessages.text,
          createdAt: s.chatMessages.createdAt,
        })
        .from(s.chatMessages)
        .where(eq(s.chatMessages.conversationId, booking.conversationId))
        .orderBy(asc(s.chatMessages.createdAt), asc(s.chatMessages.id))
        .limit(300)
    : [];
  const pastBookings = await db
    .select({
      id: s.bookings.id,
      reference: s.bookings.reference,
      visitDate: s.bookings.visitDate,
      slotLabel: s.bookings.slotLabel,
      status: s.bookings.status,
    })
    .from(s.bookings)
    .where(
      and(eq(s.bookings.customerId, customer.id), ne(s.bookings.id, bookingId)),
    )
    .orderBy(desc(s.bookings.visitDate), desc(s.bookings.id))
    .limit(30);
  const invoices = await listInvoiceLinks(customer.id);
  const [bookingInvoice] = await db
    .select(invoiceColumns)
    .from(s.invoices)
    .where(
      and(
        eq(s.invoices.bookingId, bookingId),
        ne(s.invoices.status, 'cancelled'),
      ),
    )
    .orderBy(asc(s.invoices.id))
    .limit(1);
  return {
    sheet: toSheet(core),
    customerId: customer.id,
    customerRecordNotes: customer.notes,
    slotId: booking.slotId,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    reviewRequestedAt: booking.reviewRequestedAt,
    conversationId: booking.conversationId,
    source: summariseSource(booking),
    referrer: booking.referrer,
    sourcePage: booking.sourcePage,
    utm: booking.utm,
    chat,
    pastBookings,
    invoices,
    bookingInvoice: bookingInvoice ?? null,
  };
}

export async function getBookingStatus(
  bookingId: number,
): Promise<BookingStatus | null> {
  const db = await getDb();
  const [row] = await db
    .select({ status: s.bookings.status })
    .from(s.bookings)
    .where(eq(s.bookings.id, bookingId));
  return row ? row.status : null;
}

// ---------------------------------------------------------------------------------------------
// Changes

export type StatusChange =
  | { ok: true; from: BookingStatus; to: BookingStatus }
  | {
      ok: false;
      code: 'invalid' | 'not_found' | 'unchanged' | 'not_allowed';
      message: string;
    };

function nextStepsMessage(from: BookingStatus): string {
  const next = allowedTransitions(from).map((status) =>
    STATUS_LABELS[status].toLowerCase(),
  );
  const label = STATUS_LABELS[from].toLowerCase();
  if (next.length === 0)
    return `A ${label} booking has no further status changes.`;
  return `A ${label} booking can only change to: ${next.join(', ')}.`;
}

/** Moves a booking to a new status if the rules allow it. The row is locked while it is checked. */
export async function changeBookingStatus(
  bookingId: number,
  target: string,
): Promise<StatusChange> {
  if (!isBookingStatus(target))
    return {
      ok: false,
      code: 'invalid',
      message: 'Choose a status from the list.',
    };
  const db = await getDb();
  return db.transaction(async (tx): Promise<StatusChange> => {
    const [booking] = await tx
      .select({ status: s.bookings.status })
      .from(s.bookings)
      .where(eq(s.bookings.id, bookingId))
      .for('update');
    if (!booking)
      return {
        ok: false,
        code: 'not_found',
        message: 'This booking could not be found.',
      };
    if (booking.status === target) {
      const message = `The booking is already ${STATUS_LABELS[target].toLowerCase()}.`;
      return { ok: false, code: 'unchanged', message };
    }
    if (!canTransition(booking.status, target)) {
      return {
        ok: false,
        code: 'not_allowed',
        message: nextStepsMessage(booking.status),
      };
    }
    await tx
      .update(s.bookings)
      .set({ status: target, updatedAt: new Date() })
      .where(eq(s.bookings.id, bookingId));
    return { ok: true, from: booking.status, to: target };
  });
}

const notesSchema = z
  .string()
  .max(4000, 'Notes can be up to 4,000 characters.');

export type NotesResult =
  | { ok: true }
  | { ok: false; code: 'invalid' | 'not_found'; message: string };

/** Saves the staff notes on a booking. An empty note clears them. */
export async function saveStaffNotes(
  bookingId: number,
  notes: string,
): Promise<NotesResult> {
  const parsed = notesSchema.safeParse(notes.trim());
  if (!parsed.success)
    return {
      ok: false,
      code: 'invalid',
      message: parsed.error.issues[0].message,
    };
  const db = await getDb();
  const updated = await db
    .update(s.bookings)
    .set({
      staffNotes: parsed.data === '' ? null : parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(s.bookings.id, bookingId))
    .returning({ id: s.bookings.id });
  if (updated.length === 0)
    return {
      ok: false,
      code: 'not_found',
      message: 'This booking could not be found.',
    };
  return { ok: true };
}

export type RescheduleDay = {
  date: string;
  label: string;
  slots: Array<{ slotId: number; label: string; remaining: number }>;
};

/** Days that are open for visits and have a free place, from the same availability the public form uses. */
export async function getRescheduleOptions(current?: {
  date: string;
  slotId: number | null;
}): Promise<RescheduleDay[]> {
  const days = await getAvailability();
  return days
    .filter((day) => day.open)
    .map((day) => ({
      date: day.date,
      label: formatVisitDate(day.date),
      slots: day.slots
        .filter(
          (slot) =>
            slot.remaining > 0 &&
            !(current?.date === day.date && current.slotId === slot.slotId),
        )
        .map((slot) => ({
          slotId: slot.slotId,
          label: slot.label,
          remaining: slot.remaining,
        })),
    }))
    .filter((day) => day.slots.length > 0);
}

const rescheduleSchema = z.object({
  bookingId: z.number().int().min(1).max(MAX_ID),
  date: z.string().refine(isRealDate),
  slotId: z.number().int().min(1).max(MAX_ID),
});

export type RescheduleResult =
  | { ok: true; visitDate: string; slotLabel: string }
  | {
      ok: false;
      code:
        | 'invalid'
        | 'not_found'
        | 'not_open'
        | 'slot_closed'
        | 'slot_full'
        | 'unchanged';
      message: string;
    };

/**
 * Moves an open booking to another date and slot. The day must be open for visits (the public
 * availability rules); capacity is then checked again inside a transaction that locks the slot,
 * the same lock createBooking takes, so two people can never take the last place.
 */
export async function rescheduleBooking(input: {
  bookingId: number;
  date: string;
  slotId: number;
}): Promise<RescheduleResult> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      code: 'invalid',
      message: 'Choose a date and a time slot.',
    };
  const { bookingId, date, slotId } = parsed.data;
  const closed: RescheduleResult = {
    ok: false,
    code: 'slot_closed',
    message: 'That day or time slot is not open for visits.',
  };
  const [day] = await getAvailability({ from: date, days: 1 });
  if (!day || !day.open || !day.slots.some((slot) => slot.slotId === slotId))
    return closed;

  const db = await getDb();
  return db.transaction(async (tx): Promise<RescheduleResult> => {
    await tx.execute(
      sql`select id from booking_slots where id = ${slotId} for update`,
    );
    const [slot] = await tx
      .select()
      .from(s.bookingSlots)
      .where(eq(s.bookingSlots.id, slotId))
      .limit(1);
    const [booking] = await tx
      .select()
      .from(s.bookings)
      .where(eq(s.bookings.id, bookingId))
      .for('update');
    if (!booking)
      return {
        ok: false,
        code: 'not_found',
        message: 'This booking could not be found.',
      };
    if (!isOpenBooking(booking.status)) {
      const label = STATUS_LABELS[booking.status].toLowerCase();
      return {
        ok: false,
        code: 'not_open',
        message: `A ${label} booking cannot be rescheduled.`,
      };
    }
    if (!slot || !slot.active || slot.weekday !== weekdayForDate(date))
      return closed;
    if (booking.visitDate === date && booking.slotId === slot.id) {
      return {
        ok: false,
        code: 'unchanged',
        message: 'The booking is already in that slot.',
      };
    }
    const [taken] = await tx
      .select({ value: count() })
      .from(s.bookings)
      .where(
        and(
          eq(s.bookings.visitDate, date),
          eq(s.bookings.slotId, slot.id),
          notInArray(s.bookings.status, RELEASED),
          ne(s.bookings.id, bookingId),
        ),
      );
    if (taken.value >= slot.capacity) {
      return {
        ok: false,
        code: 'slot_full',
        message: 'That time slot is full. Choose another.',
      };
    }
    const slotLabel = `${slot.start}–${slot.end}`;
    await tx
      .update(s.bookings)
      .set({
        visitDate: date,
        slotId: slot.id,
        slotLabel,
        updatedAt: new Date(),
      })
      .where(eq(s.bookings.id, bookingId));
    return { ok: true, visitDate: date, slotLabel };
  });
}

export type ReviewRequestResult =
  | { ok: true; at: Date }
  | { ok: false; message: string };

/** Notes that staff opened the WhatsApp review request. Only offered once a visit has happened. */
export async function markReviewRequested(
  bookingId: number,
): Promise<ReviewRequestResult> {
  const db = await getDb();
  const now = new Date();
  const updated = await db
    .update(s.bookings)
    .set({ reviewRequestedAt: now, updatedAt: now })
    .where(
      and(
        eq(s.bookings.id, bookingId),
        inArray(s.bookings.status, ['visited', 'purchased']),
      ),
    )
    .returning({ id: s.bookings.id });
  if (updated.length === 0)
    return {
      ok: false,
      message: 'A review can only be requested after the visit.',
    };
  return { ok: true, at: now };
}

// ---------------------------------------------------------------------------------------------
// Calendar

export type CalendarView = 'day' | 'week';

export type CalendarEntry = {
  id: number;
  reference: string;
  customerName: string;
  pieces: number;
  status: BookingStatus;
};

export type CalendarSlot = {
  key: string;
  label: string;
  /** Null for a slot that is no longer offered but still has bookings in it. */
  capacity: number | null;
  /** Bookings holding a place (cancelled and lost ones are listed but not counted). */
  booked: number;
  bookings: CalendarEntry[];
};

export type CalendarDay = {
  date: string;
  label: string;
  isToday: boolean;
  slots: CalendarSlot[];
};

export type Calendar = {
  view: CalendarView;
  date: string;
  from: string;
  to: string;
  today: string;
  prev: string;
  next: string;
  title: string;
  days: CalendarDay[];
};

/** Reads ?view= and ?date= for the calendar; anything unusable falls back to a week around today. */
export function parseCalendarParams(
  input: ParamInput,
  today: string = colomboToday(),
): { view: CalendarView; date: string } {
  const date = firstValue(input.date);
  return {
    view: firstValue(input.view) === 'day' ? 'day' : 'week',
    date: date && isRealDate(date) ? date : today,
  };
}

function calendarTitle(view: CalendarView, from: string, to: string): string {
  if (view === 'day') return longDayFormat.format(atMidnight(from));
  const year = to.slice(0, 4);
  return `${shortDayFormat.format(atMidnight(from))} – ${shortDayFormat.format(atMidnight(to))} ${year}`;
}

/** Slots and bookings for one day or one Monday-to-Sunday week, by Colombo date. */
export async function getCalendar(options: {
  view: CalendarView;
  date: string;
}): Promise<Calendar> {
  const today = colomboToday();
  const date = isRealDate(options.date) ? options.date : today;
  const from = options.view === 'week' ? weekStart(date) : date;
  const to = options.view === 'week' ? addDays(from, 6) : date;
  const db = await getDb();
  const slots = await db
    .select()
    .from(s.bookingSlots)
    .where(eq(s.bookingSlots.active, true))
    .orderBy(asc(s.bookingSlots.start), asc(s.bookingSlots.id));
  const records = await db
    .select({ booking: s.bookings, customerName: s.customers.name })
    .from(s.bookings)
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(and(gte(s.bookings.visitDate, from), lte(s.bookings.visitDate, to)))
    .orderBy(
      asc(s.bookings.visitDate),
      asc(s.bookings.slotLabel),
      asc(s.bookings.createdAt),
      asc(s.bookings.id),
    );
  const ids = records.map((record) => record.booking.id);
  const pieceRows =
    ids.length > 0
      ? await db
          .select({
            bookingId: s.bookingItems.bookingId,
            pieces: sql<number>`coalesce(sum(${s.bookingItems.quantity}), 0)::int`,
          })
          .from(s.bookingItems)
          .where(inArray(s.bookingItems.bookingId, ids))
          .groupBy(s.bookingItems.bookingId)
      : [];
  const pieces = new Map(
    pieceRows.map((row) => [row.bookingId, Number(row.pieces)]),
  );
  const entryFor = (record: (typeof records)[number]): CalendarEntry => ({
    id: record.booking.id,
    reference: record.booking.reference,
    customerName: record.booking.contactSnapshot?.name ?? record.customerName,
    pieces: pieces.get(record.booking.id) ?? 0,
    status: record.booking.status,
  });
  const holdsPlace = (entry: CalendarEntry) => !RELEASED.includes(entry.status);

  const days: CalendarDay[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const weekday = weekdayForDate(day);
    const dayRecords = records.filter(
      (record) => record.booking.visitDate === day,
    );
    const offered = slots.filter((slot) => slot.weekday === weekday);
    const offeredIds = new Set(offered.map((slot) => slot.id));
    const daySlots: CalendarSlot[] = offered.map((slot) => {
      const entries = dayRecords
        .filter((record) => record.booking.slotId === slot.id)
        .map(entryFor);
      return {
        key: `slot-${slot.id}`,
        label: `${slot.start}–${slot.end}`,
        capacity: slot.capacity,
        booked: entries.filter(holdsPlace).length,
        bookings: entries,
      };
    });
    const orphans = new Map<string, CalendarEntry[]>();
    for (const record of dayRecords) {
      if (
        record.booking.slotId !== null &&
        offeredIds.has(record.booking.slotId)
      )
        continue;
      const list = orphans.get(record.booking.slotLabel) ?? [];
      list.push(entryFor(record));
      orphans.set(record.booking.slotLabel, list);
    }
    for (const [label, entries] of orphans) {
      daySlots.push({
        key: `other-${label}`,
        label,
        capacity: null,
        booked: entries.filter(holdsPlace).length,
        bookings: entries,
      });
    }
    days.push({
      date: day,
      label: formatDayLabel(day),
      isToday: day === today,
      slots: daySlots,
    });
  }

  const step = options.view === 'week' ? 7 : 1;
  return {
    view: options.view,
    date,
    from,
    to,
    today,
    prev: addDays(date, -step),
    next: addDays(date, step),
    title: calendarTitle(options.view, from, to),
    days,
  };
}
