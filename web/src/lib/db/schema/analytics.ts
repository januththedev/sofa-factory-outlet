import { bigint, bigserial, date, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    visitorId: text('visitor_id').notNull(),
    sessionId: text('session_id').notNull(),
    type: text('type').notNull(),
    path: text('path'),
    productId: integer('product_id'),
    variantId: integer('variant_id'),
    value: jsonb('value').$type<Record<string, unknown> | null>(),
    country: text('country'),
    region: text('region'),
    city: text('city'),
    device: text('device'),
    browser: text('browser'),
    os: text('os'),
    referrer: text('referrer'),
    source: text('source'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('events_created_idx').on(t.createdAt),
    index('events_type_created_idx').on(t.type, t.createdAt),
    index('events_product_idx').on(t.productId),
  ],
);

export const dailyStats = pgTable(
  'daily_stats',
  {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),
    metric: text('metric').notNull(),
    dimension: text('dimension').notNull().default(''),
    value: bigint('value', { mode: 'number' }).notNull().default(0),
  },
  (t) => [uniqueIndex('daily_stats_uq').on(t.date, t.metric, t.dimension)],
);
