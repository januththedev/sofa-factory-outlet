import 'server-only';

import { z } from 'zod';
import type { InvoiceListFilter, InvoiceRow } from '@/lib/invoices/api';
import { getInvoice, listInvoices } from '@/lib/invoices/api';

const statusSchema = z.enum(['draft', 'issued', 'partially_paid', 'paid', 'cancelled']);
const sourceSchema = z.enum(['website', 'walk-in']);
const typeSchema = z.enum(['invoice', 'quotation']);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
const searchSchema = z.string().trim().max(120);

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseStatus(value: string | undefined) {
  const result = statusSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function parseSource(value: string | undefined) {
  const result = sourceSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function parseType(value: string | undefined) {
  const result = typeSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function parseDate(value: string | undefined): string | undefined {
  const result = dateSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function parseSearch(value: string | undefined): string | undefined {
  const result = searchSchema.safeParse(value);
  return result.success && result.data ? result.data : undefined;
}

export function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Reads every row matching a filter, walking the contract's 100-row pages. */
export async function collectInvoiceRows(filter: InvoiceListFilter): Promise<InvoiceRow[]> {
  const rows: InvoiceRow[] = [];
  let offset = 0;
  for (let page = 0; page < 100; page += 1) {
    const result = await listInvoices({ ...filter, limit: 100, offset });
    rows.push(...result.rows);
    offset += result.rows.length;
    if (!result.rows.length || offset >= result.total) break;
  }
  return rows;
}

export async function findInvoiceConvertedFrom(
  quotationId: number,
): Promise<{ id: number; number: string | null } | null> {
  let offset = 0;
  for (let page = 0; page < 100; page += 1) {
    const result = await listInvoices({ type: 'invoice', limit: 100, offset });
    for (const row of result.rows) {
      const invoice = await getInvoice(row.id);
      if (invoice?.convertedFromId === quotationId) return { id: row.id, number: row.number };
    }
    offset += result.rows.length;
    if (!result.rows.length || offset >= result.total) break;
  }
  return null;
}
