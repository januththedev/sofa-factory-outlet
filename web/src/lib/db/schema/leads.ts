import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { adminUsers, customers } from './people';

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'quote_sent'
  | 'won'
  | 'lost';
export type LeadItem = {
  productId: number;
  variantId: number;
  name: string;
  colour: string;
  quantity: number;
  priceMinor: number | null;
};
export const leads = pgTable(
  'leads',
  {
    id: serial('id').primaryKey(),
    reference: text('reference').notNull().unique(),
    requestHash: text('request_hash').notNull().unique(),
    fingerprint: text('fingerprint').notNull(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    city: text('city'),
    preferredContact: text('preferred_contact')
      .$type<'whatsapp' | 'call' | 'email'>()
      .notNull(),
    notes: text('notes'),
    budget: text('budget'),
    room: text('room'),
    items: jsonb('items').$type<LeadItem[]>().notNull(),
    attribution: jsonb('attribution')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    stage: text('stage').$type<LeadStage>().notNull().default('new'),
    assigneeId: integer('assignee_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    followUpAt: timestamp('follow_up_at', { withTimezone: true }),
    lostReason: text('lost_reason'),
    priority: boolean('priority').notNull().default(false),
    consentAt: timestamp('consent_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('leads_queue_idx').on(t.stage, t.followUpAt),
    index('leads_assignee_idx').on(t.assigneeId),
  ],
);
export const leadActivities = pgTable(
  'lead_activities',
  {
    id: serial('id').primaryKey(),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    actorId: integer('actor_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('lead_activities_lead_idx').on(t.leadId)],
);
export const rateBuckets = pgTable(
  'rate_buckets',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('rate_buckets_expiry_idx').on(t.expiresAt)],
);
