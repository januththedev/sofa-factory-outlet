import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getDb, type Db } from '@/lib/db';
import * as s from '@/lib/db/schema';
import {
  createLeadQuotation,
  getLead,
  listLeads,
  requestQuote,
  updateLead,
} from '@/lib/leads/service';
import {
  cancelInvoice,
  convertQuotationToInvoice,
  getInvoice,
  issueInvoice,
  recordPayment,
  saveInvoiceDraft,
} from '@/lib/invoices/service';
import { canReadBooking, newAccessToken } from '@/lib/security/access';
import { consumeLimit } from '@/lib/security/shared-limit';
import { createBooking, getAvailability } from '@/lib/bookings/api';
let db: Db;
let productId: number, variantId: number, ownerId: number;
beforeAll(async () => {
  db = await getDb();
  const [row] = await db
    .select({ productId: s.products.id, variantId: s.productVariants.id })
    .from(s.products)
    .innerJoin(
      s.productVariants,
      eq(s.products.id, s.productVariants.productId),
    )
    .where(eq(s.products.status, 'published'))
    .limit(1);
  productId = row.productId;
  variantId = row.variantId;
  ownerId = (await db.select().from(s.adminUsers).limit(1))[0].id;
});
afterAll(closeDb);
let sequence = 0;
function input() {
  sequence += 1;
  return {
    requestToken: newAccessToken(),
    name: 'Quote Visitor',
    phone: `077900${String(sequence).padStart(4, '0')}`,
    email: '',
    city: 'Colombo',
    preferredContact: 'whatsapp',
    consent: true,
    items: [{ productId, variantId, quantity: 2 }],
    attribution: { source: 'facebook', campaign: 'living-room' },
    notes: 'Olive fabric',
    budget: '',
    room: '',
  };
}
async function createLead() {
  const data = input();
  const result = await requestQuote(data);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return (
    await db
      .select()
      .from(s.leads)
      .where(eq(s.leads.reference, result.reference))
  )[0];
}
describe('quote requests and assigned sales workflow', () => {
  it('deduplicates concurrent retries and snapshots products and attribution', async () => {
    const data = input();
    const responses = await Promise.all([
      requestQuote(data),
      requestQuote(data),
      requestQuote(data),
    ]);
    expect(responses[1]).toEqual(responses[0]);
    expect(responses[2]).toEqual(responses[0]);
    const result = responses[0];
    if (!result.ok) throw new Error(result.message);
    const [lead] = await db
      .select()
      .from(s.leads)
      .where(eq(s.leads.reference, result.reference));
    expect(lead.items[0]).toMatchObject({ productId, variantId, quantity: 2 });
    expect(lead.attribution).toMatchObject({
      source: 'facebook',
      campaign: 'living-room',
    });
    expect(lead.requestHash).not.toBe(data.requestToken);
    expect(await requestQuote({ ...data, name: 'Different' })).toMatchObject({
      ok: false,
    });
  });
  it('does not mutate an established customer from an unverified quote request', async () => {
    const data = input();
    const [customer] = await db
      .insert(s.customers)
      .values({
        phone: data.phone.replace(/^0/, '+94'),
        name: 'Verified name',
        email: 'original@example.com',
        city: 'Kandy',
      })
      .returning();
    await requestQuote(data);
    expect(
      (
        await db
          .select()
          .from(s.customers)
          .where(eq(s.customers.id, customer.id))
      )[0],
    ).toMatchObject({
      name: 'Verified name',
      email: 'original@example.com',
      city: 'Kandy',
    });
  });
  it('rejects removed products and mismatched colour variants without a saved enquiry', async () => {
    const data = input();
    expect(
      await requestQuote({
        ...data,
        items: [{ productId, variantId: 2147483647, quantity: 1 }],
      }),
    ).toMatchObject({ ok: false });
    expect(
      await db
        .select()
        .from(s.leads)
        .where(eq(s.leads.phone, data.phone.replace(/^0/, '+94'))),
    ).toHaveLength(0);
  });
  it('supports enquiries with no cart, but requires email when email contact is chosen', async () => {
    expect(await requestQuote({ ...input(), items: [] })).toMatchObject({
      ok: true,
    });
    expect(
      await requestQuote({ ...input(), preferredContact: 'email' }),
    ).toMatchObject({ ok: false, fields: { email: expect.any(String) } });
  });
  it('assigns staff, schedules Colombo follow-up, records activity and filters queues', async () => {
    const lead = await createLead();
    await updateLead(
      {
        id: lead.id,
        stage: 'contacted',
        assigneeId: ownerId,
        followUp: '2026-01-01T10:00',
        note: 'Customer wants velvet.',
        lostReason: '',
        priority: true,
      },
      ownerId,
    );
    const detail = await getLead(lead.id);
    expect(detail?.lead.followUpAt?.toISOString()).toBe(
      '2026-01-01T04:30:00.000Z',
    );
    expect(detail?.activities[0].activity.body).toContain(
      'Customer wants velvet.',
    );
    expect(
      (await listLeads({ queue: 'overdue', userId: ownerId })).some(
        (r) => r.lead.id === lead.id,
      ),
    ).toBe(true);
    await expect(
      updateLead(
        {
          id: lead.id,
          stage: 'lost',
          assigneeId: ownerId,
          followUp: '',
          note: '',
          lostReason: '',
          priority: false,
        },
        ownerId,
      ),
    ).rejects.toThrow();
    await updateLead(
      {
        id: lead.id,
        stage: 'won',
        assigneeId: ownerId,
        followUp: '2026-01-01T10:00',
        note: 'Ordered.',
        lostReason: '',
        priority: false,
      },
      ownerId,
    );
    expect((await getLead(lead.id))?.lead.followUpAt).toBeNull();
    expect(
      (await listLeads({ queue: 'overdue', userId: ownerId })).some(
        (r) => r.lead.id === lead.id,
      ),
    ).toBe(false);
  });
  it('creates exactly one quotation draft for concurrent staff clicks', async () => {
    const lead = await createLead();
    const ids = await Promise.all([
      createLeadQuotation(lead.id, ownerId),
      createLeadQuotation(lead.id, ownerId),
    ]);
    expect(ids[0]).toBe(ids[1]);
    const invoice = await getInvoice(ids[0]);
    expect(invoice).toMatchObject({
      type: 'quotation',
      status: 'draft',
      source: 'website',
    });
    expect(invoice?.lines[0]).toMatchObject({
      productId,
      variantId,
      quantity: 2,
    });
  });
  it('enforces a shared atomic allowance', async () => {
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () =>
        consumeLimit('release-limit-test', 3, 60000),
      ),
    );
    expect(outcomes.filter(Boolean)).toHaveLength(3);
  });
});
describe('booking privacy and finance integrity', () => {
  it('deduplicates bookings and requires the private token with expiry/revocation', async () => {
    const days = await getAvailability();
    const day = days.find(
      (d) => d.open && d.slots.some((s) => s.remaining > 0),
    );
    if (!day) throw new Error('Missing booking fixtures');
    const slot = day.slots.find((s) => s.remaining > 0)!;
    const requestToken = newAccessToken();
    const data = {
      name: 'Private Visit',
      phone: '0778000001',
      whatsappSame: true,
      date: day.date,
      slotId: slot.slotId,
      preferredContact: 'call' as const,
      consent: true as const,
      items: [],
      requestToken,
    };
    const results = await Promise.all([
      createBooking(data),
      createBooking(data),
    ]);
    expect(results[0]).toEqual(results[1]);
    const result = results[0];
    if (!result.ok) throw new Error(result.message);
    expect(await canReadBooking(result.reference, undefined)).toBe(false);
    expect(await canReadBooking(result.reference, newAccessToken())).toBe(
      false,
    );
    expect(await canReadBooking(result.reference, result.accessToken)).toBe(
      true,
    );
    await db
      .update(s.bookings)
      .set({ accessExpiresAt: new Date(0) })
      .where(eq(s.bookings.id, result.bookingId));
    expect(await canReadBooking(result.reference, result.accessToken)).toBe(
      false,
    );
    await db
      .update(s.bookings)
      .set({ accessExpiresAt: new Date(Date.now() + 60000), accessHash: null })
      .where(eq(s.bookings.id, result.bookingId));
    expect(await canReadBooking(result.reference, result.accessToken)).toBe(
      false,
    );
  });
  it('converts an issued quote once under concurrency, retaining its booking provenance', async () => {
    const lead = await createLead();
    const [booking] = await db
      .insert(s.bookings)
      .values({
        reference: 'SFO-B-PROVENANCE',
        customerId: lead.customerId,
        visitDate: '2026-12-01',
        slotLabel: '10:00–12:00',
      })
      .returning();
    const quote = await saveInvoiceDraft({
      customerId: lead.customerId,
      bookingId: booking.id,
      type: 'quotation',
      source: 'website',
      lines: [{ description: 'Approved sofa', unitMinor: 10000, quantity: 1 }],
    });
    await issueInvoice(quote.invoiceId);
    const ids = await Promise.all([
      convertQuotationToInvoice(quote.invoiceId),
      convertQuotationToInvoice(quote.invoiceId),
    ]);
    expect(ids[0]).toEqual(ids[1]);
    expect(await getInvoice(ids[0].invoiceId)).toMatchObject({
      booking: { id: booking.id },
      convertedFromId: quote.invoiceId,
    });
  });
  it('records a retried payment only once and prevents cancellation with money recorded', async () => {
    const lead = await createLead();
    const invoice = await saveInvoiceDraft({
      customerId: lead.customerId,
      type: 'invoice',
      source: 'website',
      lines: [{ description: 'Sofa', quantity: 1, unitMinor: 10000 }],
    });
    await issueInvoice(invoice.invoiceId);
    const payment = {
      invoiceId: invoice.invoiceId,
      requestKey: crypto.randomUUID(),
      amountMinor: 4000,
      method: 'cash' as const,
      paidOn: '2026-10-29',
    };
    const responses = await Promise.all([
      recordPayment(payment),
      recordPayment(payment),
    ]);
    expect(responses[0]).toEqual(responses[1]);
    expect((await getInvoice(invoice.invoiceId))?.payments).toHaveLength(1);
    await expect(cancelInvoice(invoice.invoiceId)).rejects.toThrow(
      /recorded payments/,
    );
    await expect(
      recordPayment({ ...payment, amountMinor: 5000 }),
    ).rejects.toThrow(/different details/);
  });
  it('refuses to issue an unknown price as a free item', async () => {
    const lead = await createLead();
    const id = await createLeadQuotation(lead.id, ownerId);
    await db
      .update(s.invoiceItems)
      .set({ unitMinor: 0 })
      .where(eq(s.invoiceItems.invoiceId, id));
    await expect(issueInvoice(id)).rejects.toThrow(/confirmed positive price/);
  });
  it('indexes the new tables after applying the additive migration', async () => {
    const result = await db.execute(
      sql`select indexname from pg_indexes where tablename = 'leads'`,
    );
    expect(JSON.stringify(result)).toContain('leads_queue_idx');
  });
});
