import { boolean, date, index, integer, pgTable, real, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { bookings } from './bookings';
import { products } from './catalogue';
import { invoices } from './invoices';
import { customers } from './people';

/** Database-driven redirects. to_path NULL with status 410 = gone. */
export const redirects = pgTable(
  'redirects',
  {
    id: serial('id').primaryKey(),
    fromPath: text('from_path').notNull().unique(),
    toPath: text('to_path'),
    status: integer('status').$type<301 | 410>().notNull().default(301),
    hits: integer('hits').notNull().default(0),
    reason: text('reason').$type<'hidden-product' | 'slug-change' | 'deleted' | 'manual'>().notNull().default('manual'),
    productId: integer('product_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('redirects_product_idx').on(t.productId)],
);

export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    invoiceId: integer('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    rating: integer('rating').notNull(),
    title: text('title'),
    body: text('body').notNull(),
    authorName: text('author_name').notNull(),
    verifiedVisit: boolean('verified_visit').notNull().default(false),
    approved: boolean('approved').notNull().default(false),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reviews_product_idx').on(t.productId, t.approved)],
);

export const searchConsoleDaily = pgTable(
  'search_console_daily',
  {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),
    query: text('query').notNull().default(''),
    page: text('page').notNull().default(''),
    clicks: integer('clicks').notNull().default(0),
    impressions: integer('impressions').notNull().default(0),
    ctr: real('ctr').notNull().default(0),
    position: real('position').notNull().default(0),
  },
  (t) => [uniqueIndex('search_console_daily_uq').on(t.date, t.query, t.page)],
);
