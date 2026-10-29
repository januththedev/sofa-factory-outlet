import 'server-only';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  or,
} from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { createNotification } from '@/lib/notify/bell';
import { tokenHash } from '@/lib/security/access';
import { consumeLimit } from '@/lib/security/shared-limit';
import { computeTotals } from '@/lib/invoices/totals';
import { colomboToday } from '@/lib/bookings/rules';
import { quoteSchema, type QuoteState, LEAD_STAGES } from './schema';

export async function requestQuote(
  input: unknown,
): Promise<NonNullable<QuoteState>> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: 'Please check the highlighted details.',
      fields: Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  const data = parsed.data;
  const requestHash = tokenHash(data.requestToken);
  const fingerprint = tokenHash(
    JSON.stringify({
      ...data,
      requestToken: undefined,
      attribution: undefined,
    }),
  );
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx
      .insert(s.rateBuckets)
      .values({
        key: `quote-request:${requestHash}`,
        count: 0,
        expiresAt: new Date(Date.now() + 86400000),
      })
      .onConflictDoNothing();
    await tx
      .select()
      .from(s.rateBuckets)
      .where(eq(s.rateBuckets.key, `quote-request:${requestHash}`))
      .for('update');
    const [prior] = await tx
      .select()
      .from(s.leads)
      .where(eq(s.leads.requestHash, requestHash));
    if (prior)
      return prior.fingerprint === fingerprint
        ? { ok: true, reference: prior.reference }
        : {
            ok: false,
            message:
              'This request has already been sent. Start a new request for different details.',
          };
    if (!(await consumeLimit(`quote:${data.phone}`, 5, 3600000, tx)))
      return {
        ok: false,
        message:
          'We have received several requests from this number. Please try again later.',
      };
    const items: s.LeadItem[] = [];
    for (const item of data.items) {
      const [row] = await tx
        .select({ product: s.products, variant: s.productVariants })
        .from(s.products)
        .innerJoin(
          s.productVariants,
          eq(s.productVariants.productId, s.products.id),
        )
        .where(
          and(
            eq(s.products.id, item.productId),
            eq(s.products.status, 'published'),
            item.variantId
              ? eq(s.productVariants.id, item.variantId)
              : eq(s.productVariants.isDefault, true),
          ),
        )
        .limit(1);
      if (!row)
        return {
          ok: false,
          message:
            'One of your selected pieces has changed. Update your cart and try again.',
        };
      items.push({
        productId: row.product.id,
        variantId: row.variant.id,
        name: row.product.name,
        colour: row.variant.colourName,
        quantity: item.quantity,
        priceMinor: row.product.priceMinor,
      });
    }
    const [customer] = await tx
      .insert(s.customers)
      .values({
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        city: data.city,
        whatsapp: data.preferredContact === 'whatsapp' ? data.phone : null,
      })
      .onConflictDoUpdate({
        target: s.customers.phone,
        set: { phone: data.phone },
      })
      .returning({ id: s.customers.id });
    const reference = `SFO-Q-${requestHash.slice(0, 10).toUpperCase()}`;
    const [lead] = await tx
      .insert(s.leads)
      .values({
        reference,
        requestHash,
        fingerprint,
        customerId: customer.id,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        city: data.city,
        preferredContact: data.preferredContact,
        notes: data.notes,
        budget: data.budget,
        room: data.room,
        items,
        attribution: data.attribution,
      })
      .returning({ id: s.leads.id });
    await tx
      .insert(s.leadActivities)
      .values({ leadId: lead.id, body: 'Quotation requested on the website.' });
    await createNotification(
      {
        type: 'system',
        title: `Quote request ${reference}`,
        body: `${data.name} · ${data.city}`,
        link: `/admin/leads/${lead.id}/`,
      },
      tx,
    );
    return { ok: true, reference };
  });
}

export async function listLeads(options: {
  queue?: string;
  q?: string;
  page?: number;
  userId: number;
}) {
  const db = await getDb();
  const queue = options.queue ?? 'all';
  const now = new Date();
  const endToday = new Date(`${colomboToday()}T23:59:59.999+05:30`);
  const open = inArray(s.leads.stage, [
    'new',
    'contacted',
    'qualified',
    'quote_sent',
  ]);
  return db
    .select({ lead: s.leads, assignee: s.adminUsers.name })
    .from(s.leads)
    .leftJoin(s.adminUsers, eq(s.leads.assigneeId, s.adminUsers.id))
    .where(
      and(
        options.q
          ? or(
              ilike(s.leads.name, `%${options.q}%`),
              ilike(s.leads.phone, `%${options.q}%`),
              ilike(s.leads.reference, `%${options.q}%`),
            )
          : undefined,
        queue === 'unassigned'
          ? and(open, isNull(s.leads.assigneeId))
          : queue === 'mine'
            ? and(open, eq(s.leads.assigneeId, options.userId))
            : queue === 'overdue'
              ? and(open, lt(s.leads.followUpAt, now))
              : queue === 'today'
                ? and(open, lt(s.leads.followUpAt, endToday))
                : LEAD_STAGES.includes(queue as s.LeadStage)
                  ? eq(s.leads.stage, queue as s.LeadStage)
                  : undefined,
      ),
    )
    .orderBy(
      desc(s.leads.priority),
      asc(s.leads.followUpAt),
      desc(s.leads.createdAt),
      desc(s.leads.id),
    )
    .limit(25)
    .offset(((options.page ?? 1) - 1) * 25);
}
export async function getLead(id: number) {
  const db = await getDb();
  const [lead] = await db.select().from(s.leads).where(eq(s.leads.id, id));
  if (!lead) return null;
  const [activities, staff, quotations] = await Promise.all([
    db
      .select({ activity: s.leadActivities, actor: s.adminUsers.name })
      .from(s.leadActivities)
      .leftJoin(s.adminUsers, eq(s.leadActivities.actorId, s.adminUsers.id))
      .where(eq(s.leadActivities.leadId, id))
      .orderBy(desc(s.leadActivities.id))
      .limit(100),
    db
      .select({ id: s.adminUsers.id, name: s.adminUsers.name })
      .from(s.adminUsers)
      .where(eq(s.adminUsers.active, true))
      .orderBy(asc(s.adminUsers.name)),
    db.select().from(s.invoices).where(eq(s.invoices.leadId, id)),
  ]);
  return { lead, activities, staff, quotations };
}
export const leadUpdateSchema = z
  .object({
    id: z.coerce.number().int().positive(),
    stage: z.enum(LEAD_STAGES),
    assigneeId: z
      .union([z.literal(''), z.coerce.number().int().positive()])
      .transform((v) => (v === '' ? null : v)),
    followUp: z
      .string()
      .refine(
        (v) =>
          v === '' ||
          (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) &&
            Number.isFinite(Date.parse(`${v}:00+05:30`))),
        'Enter a valid follow-up date and time.',
      ),
    lostReason: z.string().trim().max(300),
    note: z.string().trim().max(2000),
    priority: z.boolean(),
  })
  .refine((v) => v.stage !== 'lost' || v.lostReason.length > 0, {
    message: 'Add a reason before marking a lead lost.',
    path: ['lostReason'],
  });
export async function updateLead(raw: unknown, actorId: number) {
  const data = leadUpdateSchema.parse(raw);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [lead] = await tx
      .select()
      .from(s.leads)
      .where(eq(s.leads.id, data.id))
      .for('update');
    if (!lead) throw new Error('Lead not found.');
    if (data.assigneeId) {
      const [staff] = await tx
        .select()
        .from(s.adminUsers)
        .where(
          and(
            eq(s.adminUsers.id, data.assigneeId),
            eq(s.adminUsers.active, true),
          ),
        );
      if (!staff) throw new Error('Choose an active staff member.');
    }
    await tx
      .update(s.leads)
      .set({
        stage: data.stage,
        assigneeId: data.assigneeId,
        followUpAt:
          ['won', 'lost'].includes(data.stage) || !data.followUp
            ? null
            : new Date(`${data.followUp}:00+05:30`),
        priority: data.priority,
        lostReason: data.stage === 'lost' ? data.lostReason : null,
        updatedAt: new Date(),
      })
      .where(eq(s.leads.id, data.id));
    const summary = `Stage: ${lead.stage} → ${data.stage}. Assigned staff: ${data.assigneeId ?? 'unassigned'}. Follow-up (Colombo): ${data.followUp || 'none'}.${data.lostReason && data.stage === 'lost' ? ` Lost reason: ${data.lostReason}.` : ''}`;
    await tx
      .insert(s.leadActivities)
      .values({
        leadId: data.id,
        actorId,
        body: `${summary}${data.note ? `\n${data.note}` : ''}`,
      });
  });
}
/** Repeated clicks create one draft; use the existing invoice builder for pricing and issuing. */
export async function createLeadQuotation(
  leadId: number,
  actorId: number,
): Promise<number> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [lead] = await tx
      .select()
      .from(s.leads)
      .where(eq(s.leads.id, leadId))
      .for('update');
    if (!lead) throw new Error('Lead not found.');
    const [existing] = await tx
      .select()
      .from(s.invoices)
      .where(eq(s.invoices.leadId, leadId));
    if (existing) return existing.id;
    const lines = lead.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      description: item.name,
      colourName: item.colour,
      quantity: item.quantity,
      unitMinor: item.priceMinor ?? 0,
    }));
    const totals = computeTotals({ lines });
    const [quote] = await tx
      .insert(s.invoices)
      .values({
        type: 'quotation',
        leadId,
        customerId: lead.customerId,
        source: 'website',
        subtotalMinor: totals.subtotalMinor,
        totalMinor: totals.totalMinor,
        notes: `Quote request ${lead.reference}. Contact: ${lead.name}, ${lead.phone}. ${lead.notes ?? ''}`,
      })
      .returning({ id: s.invoices.id });
    if (lines.length)
      await tx
        .insert(s.invoiceItems)
        .values(
          lines.map((line, sortOrder) => ({
            ...line,
            invoiceId: quote.id,
            lineMinor: line.quantity * line.unitMinor,
            sortOrder,
          })),
        );
    await tx
      .insert(s.leadActivities)
      .values({
        leadId,
        actorId,
        body: `Quotation draft #${quote.id} created. Confirm all unknown prices before issuing.`,
      });
    return quote.id;
  });
}
