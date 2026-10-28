import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import {
  cancelInvoice, convertQuotationToInvoice, createInvoiceFromBooking, createShareLink,
  getInvoice, issueInvoice, listInvoices, recordPayment, saveInvoiceDraft, verifyShareToken,
} from '@/lib/invoices/api';

let customerId: number;
const year = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Colombo', year: 'numeric' }).format(new Date()));

async function draft(type: 'invoice' | 'quotation' = 'invoice', total = 10_000) {
  return saveInvoiceDraft({ type, customerId, source: 'walk-in', lines: [{ description: 'Test sofa', quantity: 1, unitMinor: total }] });
}

beforeAll(async () => {
  const db = await getDb();
  const [customer] = await db.insert(s.customers).values({ name: 'Invoice Test Customer', phone: '+94770000001' }).returning({ id: s.customers.id });
  customerId = customer.id;
});

afterAll(closeDb);

describe('invoices', () => {
  it('creates and issues a draft with the Colombo year', async () => {
    const { invoiceId } = await draft();
    const { number } = await issueInvoice(invoiceId);
    expect(number).toMatch(new RegExp(`^SFO-${year}-\\d{4}$`));
  });

  it('issues 20 concurrent drafts with distinct consecutive numbers', async () => {
    const drafts = await Promise.all(Array.from({ length: 20 }, () => draft()));
    const issued = await Promise.all(drafts.map(({ invoiceId }) => issueInvoice(invoiceId)));
    const values = issued.map(({ number }) => Number(number.slice(-4))).sort((a, b) => a - b);
    expect(new Set(values).size).toBe(20);
    expect(values.at(-1)! - values[0]).toBe(19);
  });

  it('keeps a separate quotation number series', async () => {
    const { invoiceId } = await draft('quotation');
    await expect(issueInvoice(invoiceId)).resolves.toEqual({ number: `SFO-Q-${year}-0001` });
  });

  it('moves payment status and rejects overpayment', async () => {
    const { invoiceId } = await draft('invoice', 10_000);
    await issueInvoice(invoiceId);
    await expect(recordPayment({ invoiceId, amountMinor: 4_000, method: 'cash', paidOn: `${year}-01-01` })).resolves.toMatchObject({ status: 'partially_paid', balanceMinor: 6_000 });
    await expect(recordPayment({ invoiceId, amountMinor: 6_001, method: 'card', paidOn: `${year}-01-01` })).rejects.toThrow(/exceeds/);
    await expect(recordPayment({ invoiceId, amountMinor: 6_000, method: 'bank_transfer', paidOn: `${year}-01-02` })).resolves.toMatchObject({ status: 'paid', balanceMinor: 0 });
  });

  it('keeps cancelled invoices in lists', async () => {
    const { invoiceId } = await draft();
    await cancelInvoice(invoiceId);
    const result = await listInvoices({ status: 'cancelled', limit: 100 });
    expect(result.rows.some((row) => row.id === invoiceId)).toBe(true);
  });

  it('converts an issued quotation and links the new draft back', async () => {
    const { invoiceId: quotationId } = await draft('quotation');
    await issueInvoice(quotationId);
    const { invoiceId } = await convertQuotationToInvoice(quotationId);
    await expect(getInvoice(invoiceId)).resolves.toMatchObject({ type: 'invoice', status: 'draft', convertedFromId: quotationId });
  });

  it('creates a booking invoice idempotently', async () => {
    const db = await getDb();
    const [booking] = await db.insert(s.bookings).values({ reference: `SFO-B-INV-${Date.now()}`, customerId, visitDate: `${year}-12-01`, slotLabel: '10:00–12:00' }).returning({ id: s.bookings.id });
    await db.insert(s.bookingItems).values({ bookingId: booking.id, productName: 'Booking sofa', colourName: 'Olive', quantity: 2, priceMinor: null });
    const first = await createInvoiceFromBooking(booking.id);
    const second = await createInvoiceFromBooking(booking.id);
    expect(second).toEqual(first);
    await expect(getInvoice(first.invoiceId)).resolves.toMatchObject({ source: 'website', booking: { id: booking.id }, lines: [{ description: 'Booking sofa', colourName: 'Olive', unitMinor: 0 }] });
  });

  it('round-trips share tokens and rejects tampering', async () => {
    const previous = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = 'test-secret-long-enough-for-invoice-links';
    try {
      const { invoiceId } = await draft();
      const link = await createShareLink(invoiceId);
      const token = new URL(link, 'https://example.test').searchParams.get('t')!;
      await expect(verifyShareToken(invoiceId, token)).resolves.toBe(true);
      await expect(verifyShareToken(invoiceId + 1, token)).resolves.toBe(false);
      // The last base64url character of a 32-byte signature carries only 4 bits, so swapping it can decode to
      // the same bytes (1 run in 16). The first signature character carries 6, so changing it always breaks it.
      const start = token.lastIndexOf('.') + 1;
      const changed = token[start] === 'A' ? 'B' : 'A';
      await expect(verifyShareToken(invoiceId, `${token.slice(0, start)}${changed}${token.slice(start + 1)}`))
        .resolves.toBe(false);
    } finally {
      if (previous === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = previous;
    }
  });
});
