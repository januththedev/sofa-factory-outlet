'use server';

import { and, asc, eq, ilike, inArray, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type {
  BuilderCustomer,
  CustomerOption,
  ProductOption,
} from '@/lib/admin/invoices';
import { requireRole } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import type { InvoiceDraftInput } from '@/lib/invoices/api';
import {
  cancelInvoice,
  convertQuotationToInvoice,
  issueInvoice,
  recordPayment,
  saveInvoiceDraft,
} from '@/lib/invoices/api';
import { normaliseLkPhone } from '@/lib/phone';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const maxMinor = Number.MAX_SAFE_INTEGER;

const lineSchema = z.object({
  productId: z.number().int().positive().optional(),
  variantId: z.number().int().positive().optional(),
  description: z.string().trim().min(1).max(300),
  colourName: z.string().trim().max(120).optional(),
  quantity: z.number().int().min(1).max(1000),
  unitMinor: z.number().int().min(0).max(maxMinor),
  discountMinor: z.number().int().min(0).max(maxMinor).optional(),
});

const draftSchema = z.object({
  id: z.number().int().positive().optional(),
  type: z.enum(['invoice', 'quotation']),
  customerId: z.number().int().positive(),
  bookingId: z.number().int().positive().optional(),
  source: z.enum(['website', 'walk-in']),
  lines: z.array(lineSchema).min(1).max(100),
  discount: z.object({
    type: z.enum(['amount', 'percent']),
    value: z.number().int().min(0).max(maxMinor),
  }),
  deliveryMinor: z.number().int().min(0).max(maxMinor),
  advanceMinor: z.number().int().min(0).max(maxMinor),
  taxRateBp: z.number().int().min(0).max(10_000),
  deliveryDate: z.string().regex(datePattern).optional(),
  notes: z.string().trim().max(5000).optional(),
  terms: z.string().trim().max(5000).optional(),
});

const paymentSchema = z.object({
  invoiceId: z.number().int().positive(),
  amountMinor: z.number().int().positive().max(maxMinor),
  method: z.enum(['cash', 'bank_transfer', 'card']),
  paidOn: z.string().regex(datePattern).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`))),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

const idSchema = z.number().int().positive();
const searchSchema = z.string().trim().max(80);

const customerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(30),
  address: z.string().trim().max(300).optional(),
  email: z.union([z.email(), z.literal('')]).optional(),
});

function friendly(error: unknown, fallback: string): string {
  if (error instanceof Error && /^(Invoice|Only|An invoice|Could not allocate|Payment|Booking)/.test(error.message)) {
    return error.message;
  }
  return fallback;
}

function toCustomer(row: typeof s.customers.$inferSelect): BuilderCustomer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    city: row.city,
    address: row.address,
  };
}

function draftInput(data: z.infer<typeof draftSchema>): InvoiceDraftInput {
  return {
    id: data.id,
    type: data.type,
    customerId: data.customerId,
    bookingId: data.bookingId,
    source: data.source,
    lines: data.lines,
    discount: data.discount,
    deliveryMinor: data.deliveryMinor,
    taxRateBp: data.taxRateBp,
    deliveryDate: data.deliveryDate,
    notes: data.notes,
    terms: data.terms,
  };
}

export async function searchCustomersAction(query: string): Promise<CustomerOption[]> {
  await requireRole();
  const parsed = searchSchema.safeParse(query);
  if (!parsed.success || parsed.data.length < 2) return [];
  const term = parsed.data;
  const phone = normaliseLkPhone(term);
  const nameMatch = ilike(s.customers.name, `%${term}%`);
  const phoneMatch = phone ? eq(s.customers.phone, phone) : ilike(s.customers.phone, `%${term}%`);
  try {
    const db = await getDb();
    const rows = await db.select().from(s.customers)
      .where(or(nameMatch, phoneMatch))
      .orderBy(asc(s.customers.name))
      .limit(12);
    return rows.map(toCustomer);
  } catch (error) {
    console.error('[invoices] customer search failed:', error);
    return [];
  }
}

export async function addCustomerAction(
  input: unknown,
): Promise<{ ok: true; customer: BuilderCustomer; attached: boolean } | { ok: false; error: string }> {
  await requireRole();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Enter a name and a valid Sri Lankan phone number.' };
  }
  const phone = normaliseLkPhone(parsed.data.phone);
  if (!phone) return { ok: false, error: 'Enter a valid Sri Lankan phone number.' };
  try {
    const db = await getDb();
    const [existing] = await db.select().from(s.customers).where(eq(s.customers.phone, phone)).limit(1);
    if (existing) return { ok: true, customer: toCustomer(existing), attached: true };
    const [created] = await db.insert(s.customers).values({
      name: parsed.data.name,
      phone,
      address: parsed.data.address || null,
      email: parsed.data.email || null,
    }).onConflictDoNothing({ target: s.customers.phone }).returning();
    if (created) return { ok: true, customer: toCustomer(created), attached: false };
    const [later] = await db.select().from(s.customers).where(eq(s.customers.phone, phone)).limit(1);
    if (later) return { ok: true, customer: toCustomer(later), attached: true };
    return { ok: false, error: 'We could not add that customer. Please try again.' };
  } catch (error) {
    console.error('[invoices] could not add customer:', error);
    return { ok: false, error: 'We could not add that customer. Please try again.' };
  }
}

export async function searchProductsAction(query: string): Promise<ProductOption[]> {
  await requireRole();
  const parsed = searchSchema.safeParse(query);
  if (!parsed.success || parsed.data.length < 2) return [];
  const term = parsed.data;
  try {
    const db = await getDb();
    const rows = await db.select({
      id: s.products.id,
      name: s.products.name,
      priceMinor: s.products.priceMinor,
    }).from(s.products)
      .where(and(eq(s.products.status, 'published'), ilike(s.products.name, `%${term}%`)))
      .orderBy(asc(s.products.name))
      .limit(10);
    if (!rows.length) return [];
    const variants = await db.select({
      id: s.productVariants.id,
      productId: s.productVariants.productId,
      colourName: s.productVariants.colourName,
      hex: s.productVariants.hex,
      inStock: s.productVariants.inStock,
    }).from(s.productVariants)
      .where(inArray(s.productVariants.productId, rows.map((row) => row.id)))
      .orderBy(asc(s.productVariants.sortOrder));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      priceMinor: row.priceMinor ?? 0,
      priceOnRequest: row.priceMinor === null,
      variants: variants.filter((variant) => variant.productId === row.id).map((variant) => ({
        id: variant.id,
        colourName: variant.colourName,
        hex: variant.hex,
        inStock: variant.inStock,
      })),
    }));
  } catch (error) {
    console.error('[invoices] product search failed:', error);
    return [];
  }
}

export async function saveDraftAction(
  input: unknown,
): Promise<{ ok: true; invoiceId: number } | { ok: false; error: string }> {
  await requireRole();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the customer, line items and amounts.' };
  try {
    const result = await saveInvoiceDraft(draftInput(parsed.data));
    revalidatePath('/admin/invoices/');
    revalidatePath(`/admin/invoices/${result.invoiceId}/`);
    return { ok: true, invoiceId: result.invoiceId };
  } catch (error) {
    console.error('[invoices] could not save draft:', error);
    return { ok: false, error: friendly(error, 'We could not save this draft. Please try again.') };
  }
}

export async function issueDraftAction(
  input: unknown,
): Promise<{ ok: true; invoiceId: number; number: string } | { ok: false; error: string }> {
  await requireRole();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the customer, line items and amounts.' };
  try {
    const saved = await saveInvoiceDraft(draftInput(parsed.data));
    const issued = await issueInvoice(saved.invoiceId);
    revalidatePath('/admin/invoices/');
    revalidatePath(`/admin/invoices/${saved.invoiceId}/`);
    return { ok: true, invoiceId: saved.invoiceId, number: issued.number };
  } catch (error) {
    console.error('[invoices] could not issue invoice:', error);
    return { ok: false, error: friendly(error, 'We could not issue this invoice. Please try again.') };
  }
}

export async function recordPaymentAction(input: unknown): Promise<
  | { ok: true; status: string; paidMinor: number; balanceMinor: number }
  | { ok: false; error: string }
> {
  await requireRole();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Enter a positive amount, a method and a valid date.' };
  try {
    const result = await recordPayment(parsed.data);
    revalidatePath('/admin/invoices/');
    revalidatePath(`/admin/invoices/${parsed.data.invoiceId}/`);
    return { ok: true, ...result };
  } catch (error) {
    console.error('[invoices] could not record payment:', error);
    return { ok: false, error: friendly(error, 'We could not record that payment. Please try again.') };
  }
}

export async function cancelInvoiceAction(
  invoiceId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole('owner');
  const parsed = idSchema.safeParse(invoiceId);
  if (!parsed.success) return { ok: false, error: 'Invoice not found.' };
  try {
    await cancelInvoice(parsed.data);
    revalidatePath('/admin/invoices/');
    revalidatePath(`/admin/invoices/${parsed.data}/`);
    return { ok: true };
  } catch (error) {
    console.error('[invoices] could not cancel invoice:', error);
    return { ok: false, error: friendly(error, 'We could not cancel this invoice. Please try again.') };
  }
}

export async function convertQuotationAction(
  quotationId: number,
): Promise<{ ok: true; invoiceId: number } | { ok: false; error: string }> {
  await requireRole();
  const parsed = idSchema.safeParse(quotationId);
  if (!parsed.success) return { ok: false, error: 'Quotation not found.' };
  try {
    const result = await convertQuotationToInvoice(parsed.data);
    revalidatePath('/admin/invoices/');
    revalidatePath(`/admin/invoices/${parsed.data}/`);
    revalidatePath(`/admin/invoices/${result.invoiceId}/`);
    return { ok: true, invoiceId: result.invoiceId };
  } catch (error) {
    console.error('[invoices] could not convert quotation:', error);
    return { ok: false, error: friendly(error, 'We could not convert this quotation. Please try again.') };
  }
}
