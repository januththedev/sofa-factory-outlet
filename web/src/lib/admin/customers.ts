import 'server-only';

import { and, count, desc, eq, ilike, inArray, max, ne, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import {
  likePattern,
  listInvoiceLinks,
  phoneSearchPatterns,
  type InvoiceLink,
  type PastBooking,
} from '@/lib/admin/bookings';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { formatLkPhone, isLkMobile, normaliseLkPhone } from '@/lib/phone';

// Customers are created by bookings and invoices and matched by phone. This file adds the admin
// side: a searchable list, one customer with their history, a "New customer" form for walk-ins
// and editing. A phone number belongs to exactly one customer.

export const CUSTOMER_PAGE_SIZE = 25;

// ---------------------------------------------------------------------------------------------
// Validation

const optionalText = (label: string, limit: number) =>
  z
    .string()
    .trim()
    .max(limit, `${label} can be up to ${limit} characters.`)
    .transform((value) => (value === '' ? null : value));

const customerSchema = z.object({
  name: z.string().trim().min(2, 'Enter the customer’s name.').max(80, 'The name can be up to 80 characters.'),
  phone: z
    .string()
    .trim()
    .transform((value, context) => {
      const phone = normaliseLkPhone(value);
      if (!phone) {
        context.addIssue({
          code: 'custom',
          message: 'Enter a valid Sri Lankan phone number, for example 077 123 4567.',
        });
        return z.NEVER;
      }
      return phone;
    }),
  whatsapp: z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === '') return null;
      const phone = normaliseLkPhone(value);
      if (!phone || !isLkMobile(phone)) {
        context.addIssue({ code: 'custom', message: 'Enter a Sri Lankan mobile number, or leave this empty.' });
        return z.NEVER;
      }
      return phone;
    }),
  email: z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === '') return null;
      if (!z.email().safeParse(value).success) {
        context.addIssue({ code: 'custom', message: 'Enter a valid email address, or leave this empty.' });
        return z.NEVER;
      }
      return value;
    }),
  city: optionalText('The city', 100),
  address: optionalText('The address', 300),
  notes: optionalText('Notes', 2000),
});

export type CustomerData = z.output<typeof customerSchema>;

export const CUSTOMER_FIELDS = ['name', 'phone', 'whatsapp', 'email', 'city', 'address', 'notes'] as const;

export type CustomerField = (typeof CUSTOMER_FIELDS)[number];

export type CustomerSaveResult =
  | { ok: true; id: number }
  | {
      ok: false;
      code: 'invalid' | 'phone_taken' | 'not_found' | 'unknown';
      message: string;
      fieldErrors?: Partial<Record<CustomerField, string>>;
      /** The customer that already uses the phone number. */
      existing?: { id: number; name: string };
    };

type Parsed = { ok: true; data: CustomerData } | { ok: false; failure: CustomerSaveResult };

/** Checks the form fields and normalises the phone numbers (+94…). Missing fields count as empty. */
export function parseCustomer(raw: Record<string, unknown>): Parsed {
  const input: Record<string, string> = {};
  for (const field of CUSTOMER_FIELDS) {
    const value = raw[field];
    input[field] = typeof value === 'string' ? value : '';
  }
  const parsed = customerSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Partial<Record<CustomerField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = CUSTOMER_FIELDS.find((name) => name === issue.path[0]);
    if (field) fieldErrors[field] ??= issue.message;
  }
  return {
    ok: false,
    failure: { ok: false, code: 'invalid', message: 'Please check the highlighted fields.', fieldErrors },
  };
}

/** True for a Postgres unique-constraint violation (code 23505), also when the driver wraps it. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth += 1) {
    if ('code' in current && current.code === '23505') return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Create and edit

async function findByPhone(phone: string, exceptId?: number): Promise<{ id: number; name: string } | null> {
  const db = await getDb();
  const sameNumber = eq(s.customers.phone, phone);
  const [row] = await db
    .select({ id: s.customers.id, name: s.customers.name })
    .from(s.customers)
    .where(exceptId === undefined ? sameNumber : and(sameNumber, ne(s.customers.id, exceptId)))
    .limit(1);
  return row ?? null;
}

function phoneTaken(other: { id: number; name: string }): CustomerSaveResult {
  return {
    ok: false,
    code: 'phone_taken',
    message: `This phone number already belongs to ${other.name}.`,
    fieldErrors: { phone: 'Another customer already uses this phone number.' },
    existing: other,
  };
}

const unknownFailure = (): CustomerSaveResult => ({
  ok: false,
  code: 'unknown',
  message: 'We could not save the customer. Please try again.',
});

/** Adds a customer (for example a walk-in). A phone number that is already taken is a friendly error. */
export async function createCustomer(raw: Record<string, unknown>): Promise<CustomerSaveResult> {
  const parsed = parseCustomer(raw);
  if (!parsed.ok) return parsed.failure;
  const taken = await findByPhone(parsed.data.phone);
  if (taken) return phoneTaken(taken);
  try {
    const db = await getDb();
    const [row] = await db.insert(s.customers).values(parsed.data).returning({ id: s.customers.id });
    return { ok: true, id: row.id };
  } catch (error) {
    // Someone else may have taken the number between the check above and the insert.
    if (isUniqueViolation(error)) {
      const other = await findByPhone(parsed.data.phone);
      if (other) return phoneTaken(other);
    }
    console.error('[admin-customers] could not create customer:', error);
    return unknownFailure();
  }
}

/** Saves a customer's contact details and notes, keeping the phone number unique. */
export async function updateCustomer(customerId: number, raw: Record<string, unknown>): Promise<CustomerSaveResult> {
  const parsed = parseCustomer(raw);
  if (!parsed.ok) return parsed.failure;
  const taken = await findByPhone(parsed.data.phone, customerId);
  if (taken) return phoneTaken(taken);
  try {
    const db = await getDb();
    const updated = await db
      .update(s.customers)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(s.customers.id, customerId))
      .returning({ id: s.customers.id });
    if (updated.length === 0) return { ok: false, code: 'not_found', message: 'This customer could not be found.' };
    return { ok: true, id: customerId };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const other = await findByPhone(parsed.data.phone, customerId);
      if (other) return phoneTaken(other);
    }
    console.error('[admin-customers] could not update customer:', error);
    return unknownFailure();
  }
}

// ---------------------------------------------------------------------------------------------
// List

export type CustomerRow = {
  id: number;
  name: string;
  phone: string;
  phoneLabel: string;
  email: string | null;
  city: string | null;
  bookings: number;
  invoices: number;
  lastActivity: Date;
};

export type CustomerPage = {
  rows: CustomerRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

function searchWhere(q: string | undefined): SQL | undefined {
  const text = q?.trim();
  if (!text) return undefined;
  return or(
    ilike(s.customers.name, likePattern(text)),
    ilike(s.customers.city, likePattern(text)),
    ilike(s.customers.email, likePattern(text)),
    ...phoneSearchPatterns(text).map((pattern) => ilike(s.customers.phone, likePattern(pattern))),
  );
}

// Newest booking or invoice first; a customer with neither sorts by when they were added.
const lastActivityDesc = sql`greatest(
  ${s.customers.createdAt},
  (select max(${s.bookings.createdAt}) from ${s.bookings} where ${s.bookings.customerId} = ${s.customers.id}),
  (select max(${s.invoices.createdAt}) from ${s.invoices} where ${s.invoices.customerId} = ${s.customers.id})
) desc`;

/** Customers matching the search (name, phone, city or email), most recent activity first. */
export async function listCustomers(options: { q?: string; page?: number } = {}): Promise<CustomerPage> {
  const db = await getDb();
  const where = searchWhere(options.q);
  const [totalRow] = await db.select({ value: count() }).from(s.customers).where(where);
  const total = totalRow.value;
  const pageCount = Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);
  const customers =
    total === 0
      ? []
      : await db
          .select()
          .from(s.customers)
          .where(where)
          .orderBy(lastActivityDesc, desc(s.customers.id))
          .limit(CUSTOMER_PAGE_SIZE)
          .offset((page - 1) * CUSTOMER_PAGE_SIZE);
  const ids = customers.map((customer) => customer.id);
  const bookingStats =
    ids.length > 0
      ? await db
          .select({ customerId: s.bookings.customerId, total: count(), last: max(s.bookings.createdAt) })
          .from(s.bookings)
          .where(inArray(s.bookings.customerId, ids))
          .groupBy(s.bookings.customerId)
      : [];
  const invoiceStats =
    ids.length > 0
      ? await db
          .select({ customerId: s.invoices.customerId, total: count(), last: max(s.invoices.createdAt) })
          .from(s.invoices)
          .where(inArray(s.invoices.customerId, ids))
          .groupBy(s.invoices.customerId)
      : [];
  const bookingsBy = new Map(bookingStats.map((row) => [row.customerId, row]));
  const invoicesBy = new Map(invoiceStats.map((row) => [row.customerId, row]));
  const rows = customers.map((customer): CustomerRow => {
    const moments = [customer.createdAt, bookingsBy.get(customer.id)?.last, invoicesBy.get(customer.id)?.last];
    const latest = Math.max(...moments.map((moment) => (moment ? moment.getTime() : 0)));
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      phoneLabel: formatLkPhone(customer.phone),
      email: customer.email,
      city: customer.city,
      bookings: bookingsBy.get(customer.id)?.total ?? 0,
      invoices: invoicesBy.get(customer.id)?.total ?? 0,
      lastActivity: new Date(latest),
    };
  });
  return { rows, total, page, pageCount, pageSize: CUSTOMER_PAGE_SIZE };
}

// ---------------------------------------------------------------------------------------------
// One customer

export type CustomerDetail = {
  customer: typeof s.customers.$inferSelect & { phoneLabel: string };
  bookings: PastBooking[];
  invoices: InvoiceLink[];
};

/** A customer with every booking and invoice, newest first. */
export async function getCustomerDetail(customerId: number): Promise<CustomerDetail | null> {
  const db = await getDb();
  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, customerId)).limit(1);
  if (!customer) return null;
  const bookings = await db
    .select({
      id: s.bookings.id,
      reference: s.bookings.reference,
      visitDate: s.bookings.visitDate,
      slotLabel: s.bookings.slotLabel,
      status: s.bookings.status,
    })
    .from(s.bookings)
    .where(eq(s.bookings.customerId, customerId))
    .orderBy(desc(s.bookings.visitDate), desc(s.bookings.id));
  const invoices = await listInvoiceLinks(customerId, 200);
  return { customer: { ...customer, phoneLabel: formatLkPhone(customer.phone) }, bookings, invoices };
}
