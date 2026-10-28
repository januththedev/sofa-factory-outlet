import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { getSettings } from '@/lib/settings/get';
import type {
  InvoiceDraftInput,
  InvoiceListFilter,
  InvoiceRow,
  InvoiceView,
  PaymentInput,
  RevenueReport,
} from './api';
import { computeTotals } from './totals';

const iso = (value: Date | string | null): string | null => value === null ? null : value instanceof Date ? value.toISOString() : value;
const colomboYear = (): number => Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Colombo', year: 'numeric' }).format(new Date()));

function lineValues(invoiceId: number, lines: InvoiceDraftInput['lines']) {
  return lines.map((line, sortOrder) => ({
    invoiceId,
    productId: line.productId,
    variantId: line.variantId,
    description: line.description,
    colourName: line.colourName,
    quantity: line.quantity,
    unitMinor: line.unitMinor,
    discountMinor: line.discountMinor ?? 0,
    lineMinor: Math.max(0, line.quantity * line.unitMinor - (line.discountMinor ?? 0)),
    sortOrder,
  }));
}

export async function saveInvoiceDraft(input: InvoiceDraftInput): Promise<{ invoiceId: number }> {
  const settings = await getSettings();
  const deliveryMinor = input.deliveryMinor ?? 0;
  const taxRateBp = settings.invoice.taxEnabled ? (input.taxRateBp ?? settings.invoice.taxRateBp) : 0;
  const discount = input.discount ?? { type: 'amount' as const, value: 0 };
  const totals = computeTotals({ lines: input.lines, discount, deliveryMinor, taxRateBp });
  const db = await getDb();
  return db.transaction(async (tx) => {
    let invoiceId: number;
    const values = {
      type: input.type,
      customerId: input.customerId,
      bookingId: input.bookingId,
      source: input.source,
      subtotalMinor: totals.subtotalMinor,
      discountType: discount.type,
      discountValue: discount.value,
      discountMinor: totals.discountMinor,
      deliveryMinor: totals.deliveryMinor,
      taxRateBp,
      taxMinor: totals.taxMinor,
      totalMinor: totals.totalMinor,
      paidMinor: 0,
      deliveryDate: input.deliveryDate,
      notes: input.notes,
      terms: input.terms ?? settings.invoice.terms,
      updatedAt: new Date(),
    };
    if (input.id !== undefined) {
      const [existing] = await tx.select({ status: s.invoices.status }).from(s.invoices).where(eq(s.invoices.id, input.id));
      if (!existing) throw new Error('Invoice not found');
      if (existing.status !== 'draft') throw new Error('Only draft invoices can be edited');
      await tx.update(s.invoices).set(values).where(eq(s.invoices.id, input.id));
      await tx.delete(s.invoiceItems).where(eq(s.invoiceItems.invoiceId, input.id));
      invoiceId = input.id;
    } else {
      const [created] = await tx.insert(s.invoices).values(values).returning({ id: s.invoices.id });
      invoiceId = created.id;
    }
    const items = lineValues(invoiceId, input.lines);
    if (items.length) await tx.insert(s.invoiceItems).values(items);
    return { invoiceId };
  });
}

export async function issueInvoice(invoiceId: number): Promise<{ number: string }> {
  const settings = await getSettings();
  const db = await getDb();
  return db.transaction(async (tx) => {
    const locked = await tx.execute<{ type: 'invoice' | 'quotation'; status: s.InvoiceStatus }>(sql`
      SELECT type, status FROM invoices WHERE id = ${invoiceId} FOR UPDATE
    `);
    const invoice = locked.rows[0];
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'draft') throw new Error('Only draft invoices can be issued');
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(s.invoiceItems).where(eq(s.invoiceItems.invoiceId, invoiceId));
    if (count === 0) throw new Error('An invoice must have at least one line');
    const year = colomboYear();
    const result = await tx.execute<{ last: number }>(sql`
      INSERT INTO invoice_counters (year, type, last) VALUES (${year}, ${invoice.type}, 1)
      ON CONFLICT (year, type) DO UPDATE SET last = invoice_counters.last + 1
      RETURNING last
    `);
    const last = result.rows[0]?.last;
    if (last === undefined) throw new Error('Could not allocate invoice number');
    const prefix = invoice.type === 'quotation' ? settings.invoice.quotationPrefix : settings.invoice.prefix;
    const number = `${prefix}-${year}-${String(last).padStart(4, '0')}`;
    await tx.update(s.invoices).set({ number, status: 'issued', issuedAt: new Date(), updatedAt: new Date() }).where(eq(s.invoices.id, invoiceId));
    return { number };
  });
}

export async function recordPayment(input: PaymentInput): Promise<{ status: s.InvoiceStatus; paidMinor: number; balanceMinor: number }> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Payment amount must be positive');
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ type: string; status: s.InvoiceStatus; total_minor: number; paid_minor: number }>(sql`
      SELECT type, status, total_minor, paid_minor FROM invoices WHERE id = ${input.invoiceId} FOR UPDATE
    `);
    const invoice = rows.rows[0];
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.type === 'quotation') throw new Error('Payments cannot be recorded against quotations');
    if (invoice.status === 'draft' || invoice.status === 'cancelled') throw new Error('Payments require an active issued invoice');
    const balanceMinor = invoice.total_minor - invoice.paid_minor;
    if (input.amountMinor > balanceMinor) throw new Error('Payment exceeds the outstanding balance');
    const paidMinor = invoice.paid_minor + input.amountMinor;
    const status: s.InvoiceStatus = paidMinor === invoice.total_minor ? 'paid' : 'partially_paid';
    await tx.insert(s.payments).values(input);
    await tx.update(s.invoices).set({ paidMinor, status, updatedAt: new Date() }).where(eq(s.invoices.id, input.invoiceId));
    return { status, paidMinor, balanceMinor: invoice.total_minor - paidMinor };
  });
}

export async function cancelInvoice(invoiceId: number): Promise<void> {
  const db = await getDb();
  const [invoice] = await db.select({ status: s.invoices.status }).from(s.invoices).where(eq(s.invoices.id, invoiceId));
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === 'cancelled') throw new Error('Invoice is already cancelled');
  await db.update(s.invoices).set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() }).where(eq(s.invoices.id, invoiceId));
}

export async function convertQuotationToInvoice(quotationId: number): Promise<{ invoiceId: number }> {
  const view = await getInvoice(quotationId);
  if (!view || view.type !== 'quotation' || view.status !== 'issued') throw new Error('Only issued quotations can be converted');
  const result = await saveInvoiceDraft({
    type: 'invoice', customerId: view.customer.id, source: view.source,
    lines: view.lines, discount: view.discount, deliveryMinor: view.deliveryMinor,
    taxRateBp: view.taxRateBp, deliveryDate: view.deliveryDate ?? undefined,
    notes: view.notes ?? undefined, terms: view.terms ?? undefined,
  });
  const db = await getDb();
  await db.update(s.invoices).set({ convertedFromId: quotationId }).where(eq(s.invoices.id, result.invoiceId));
  return result;
}

export async function createInvoiceFromBooking(bookingId: number): Promise<{ invoiceId: number }> {
  const settings = await getSettings();
  const db = await getDb();
  return db.transaction(async (tx) => {
    const locked = await tx.execute<{ customer_id: number }>(sql`SELECT customer_id FROM bookings WHERE id = ${bookingId} FOR UPDATE`);
    const booking = locked.rows[0];
    if (!booking) throw new Error('Booking not found');
    const [existing] = await tx.select({ id: s.invoices.id }).from(s.invoices)
      .where(and(eq(s.invoices.bookingId, bookingId), ne(s.invoices.status, 'cancelled'))).limit(1);
    if (existing) return { invoiceId: existing.id };
    const items = await tx.select().from(s.bookingItems).where(eq(s.bookingItems.bookingId, bookingId)).orderBy(asc(s.bookingItems.id));
    const lines = items.map((item) => ({ productId: item.productId ?? undefined, variantId: item.variantId ?? undefined, description: item.productName, colourName: item.colourName ?? undefined, quantity: item.quantity, unitMinor: item.priceMinor ?? 0 }));
    const taxRateBp = settings.invoice.taxEnabled ? settings.invoice.taxRateBp : 0;
    const totals = computeTotals({ lines, taxRateBp });
    const [created] = await tx.insert(s.invoices).values({
      type: 'invoice', customerId: booking.customer_id, bookingId, source: 'website',
      subtotalMinor: totals.subtotalMinor, discountType: 'amount', discountValue: 0,
      discountMinor: 0, deliveryMinor: 0, taxRateBp, taxMinor: totals.taxMinor,
      totalMinor: totals.totalMinor, paidMinor: 0, terms: settings.invoice.terms,
    }).returning({ id: s.invoices.id });
    const values = lineValues(created.id, lines);
    if (values.length) await tx.insert(s.invoiceItems).values(values);
    return { invoiceId: created.id };
  });
}

export async function listInvoices(filter: InvoiceListFilter = {}): Promise<{ rows: InvoiceRow[]; total: number }> {
  const db = await getDb();
  const conditions = [
    filter.status ? eq(s.invoices.status, filter.status) : undefined,
    filter.type ? eq(s.invoices.type, filter.type) : undefined,
    filter.source ? eq(s.invoices.source, filter.source) : undefined,
    filter.from ? gte(s.invoices.createdAt, new Date(`${filter.from}T00:00:00Z`)) : undefined,
    filter.to ? lte(s.invoices.createdAt, new Date(`${filter.to}T23:59:59.999Z`)) : undefined,
    filter.q ? or(ilike(s.invoices.number, `%${filter.q}%`), ilike(s.customers.name, `%${filter.q}%`), ilike(s.customers.phone, `%${filter.q}%`)) : undefined,
  ].filter((condition) => condition !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;
  const base = db.select({ invoice: s.invoices, customerName: s.customers.name, customerPhone: s.customers.phone }).from(s.invoices).innerJoin(s.customers, eq(s.invoices.customerId, s.customers.id));
  const data = await base.where(where).orderBy(desc(s.invoices.createdAt)).limit(Math.min(100, Math.max(1, filter.limit ?? 25))).offset(Math.max(0, filter.offset ?? 0));
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(s.invoices).innerJoin(s.customers, eq(s.invoices.customerId, s.customers.id)).where(where);
  return { rows: data.map(({ invoice, customerName, customerPhone }) => ({ id: invoice.id, number: invoice.number, type: invoice.type, status: invoice.status, source: invoice.source, customerName, customerPhone, totalMinor: invoice.totalMinor, paidMinor: invoice.paidMinor, balanceMinor: Math.max(0, invoice.totalMinor - invoice.paidMinor), issuedAt: iso(invoice.issuedAt), createdAt: iso(invoice.createdAt) as string })), total: count };
}

export async function getInvoice(invoiceId: number): Promise<InvoiceView | null> {
  const db = await getDb();
  const [row] = await db.select({ invoice: s.invoices, customer: s.customers, bookingId: s.bookings.id, bookingReference: s.bookings.reference }).from(s.invoices)
    .innerJoin(s.customers, eq(s.invoices.customerId, s.customers.id)).leftJoin(s.bookings, eq(s.invoices.bookingId, s.bookings.id)).where(eq(s.invoices.id, invoiceId));
  if (!row) return null;
  const lines = await db.select().from(s.invoiceItems).where(eq(s.invoiceItems.invoiceId, invoiceId)).orderBy(asc(s.invoiceItems.sortOrder));
  const payments = await db.select().from(s.payments).where(eq(s.payments.invoiceId, invoiceId)).orderBy(asc(s.payments.paidOn), asc(s.payments.id));
  const i = row.invoice;
  return {
    id: i.id, number: i.number, type: i.type, status: i.status, source: i.source,
    customerName: row.customer.name, customerPhone: row.customer.phone, totalMinor: i.totalMinor, paidMinor: i.paidMinor,
    balanceMinor: Math.max(0, i.totalMinor - i.paidMinor), issuedAt: iso(i.issuedAt), createdAt: iso(i.createdAt) as string,
    customer: { id: row.customer.id, name: row.customer.name, phone: row.customer.phone, whatsapp: row.customer.whatsapp, email: row.customer.email, city: row.customer.city, address: row.customer.address },
    booking: row.bookingId === null ? null : { id: row.bookingId, reference: row.bookingReference as string },
    lines: lines.map((line) => ({ id: line.id, productId: line.productId ?? undefined, variantId: line.variantId ?? undefined, description: line.description, colourName: line.colourName ?? undefined, quantity: line.quantity, unitMinor: line.unitMinor, discountMinor: line.discountMinor, lineMinor: line.lineMinor })),
    discount: { type: i.discountType, value: i.discountValue }, discountMinor: i.discountMinor, subtotalMinor: i.subtotalMinor,
    deliveryMinor: i.deliveryMinor, taxRateBp: i.taxRateBp, taxMinor: i.taxMinor, deliveryDate: i.deliveryDate,
    notes: i.notes, terms: i.terms, convertedFromId: i.convertedFromId,
    payments: payments.map((payment) => ({ id: payment.id, amountMinor: payment.amountMinor, method: payment.method, paidOn: payment.paidOn, reference: payment.reference, note: payment.note })),
  };
}

export async function revenueReport(options: { from?: string; to?: string } = {}): Promise<RevenueReport> {
  const db = await getDb();
  const filters = [eq(s.invoices.type, 'invoice'), inArray(s.invoices.status, ['issued', 'partially_paid', 'paid']), options.from ? gte(s.invoices.issuedAt, new Date(`${options.from}T00:00:00Z`)) : undefined, options.to ? lte(s.invoices.issuedAt, new Date(`${options.to}T23:59:59.999Z`)) : undefined].filter((x) => x !== undefined);
  const rows = await db.select({ invoice: s.invoices, customerName: s.customers.name }).from(s.invoices).innerJoin(s.customers, eq(s.invoices.customerId, s.customers.id)).where(and(...filters)).orderBy(desc(s.invoices.issuedAt));
  const grouped = new Map<string, RevenueReport['months'][number]>();
  const outstanding: RevenueReport['outstanding'] = [];
  for (const { invoice, customerName } of rows) {
    const issuedAt = iso(invoice.issuedAt) as string;
    const month = issuedAt.slice(0, 7);
    const current = grouped.get(month) ?? { month, invoicedMinor: 0, paidMinor: 0, websiteMinor: 0, walkInMinor: 0 };
    current.invoicedMinor += invoice.totalMinor; current.paidMinor += invoice.paidMinor;
    if (invoice.source === 'website') current.websiteMinor += invoice.totalMinor; else current.walkInMinor += invoice.totalMinor;
    grouped.set(month, current);
    const balanceMinor = Math.max(0, invoice.totalMinor - invoice.paidMinor);
    if (balanceMinor && invoice.number) outstanding.push({ invoiceId: invoice.id, number: invoice.number, customerName, balanceMinor, issuedAt });
  }
  return { months: [...grouped.values()].sort((a, b) => a.month.localeCompare(b.month)), outstanding };
}
