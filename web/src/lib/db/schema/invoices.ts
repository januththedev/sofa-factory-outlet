import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { bookings } from './bookings';
import { products, productVariants } from './catalogue';
import { customers } from './people';
import type { InvoiceStatus } from './types';

export const invoices = pgTable(
  'invoices',
  {
    id: serial('id').primaryKey(),
    /** Assigned when issued: SFO-2026-0001 (invoices) or SFO-Q-2026-0001 (quotations). */
    number: text('number').unique(),
    type: text('type').$type<'invoice' | 'quotation'>().notNull().default('invoice'),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id),
    bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    source: text('source').$type<'website' | 'walk-in'>().notNull().default('walk-in'),
    status: text('status').$type<InvoiceStatus>().notNull().default('draft'),
    subtotalMinor: bigint('subtotal_minor', { mode: 'number' }).notNull().default(0),
    discountType: text('discount_type').$type<'amount' | 'percent'>().notNull().default('amount'),
    /** Minor units for 'amount', basis points for 'percent' (1250 = 12.5%). */
    discountValue: bigint('discount_value', { mode: 'number' }).notNull().default(0),
    discountMinor: bigint('discount_minor', { mode: 'number' }).notNull().default(0),
    deliveryMinor: bigint('delivery_minor', { mode: 'number' }).notNull().default(0),
    taxRateBp: integer('tax_rate_bp').notNull().default(0),
    taxMinor: bigint('tax_minor', { mode: 'number' }).notNull().default(0),
    totalMinor: bigint('total_minor', { mode: 'number' }).notNull().default(0),
    paidMinor: bigint('paid_minor', { mode: 'number' }).notNull().default(0),
    balanceMinor: bigint('balance_minor', { mode: 'number' }).generatedAlwaysAs(sql`total_minor - paid_minor`),
    deliveryDate: date('delivery_date'),
    notes: text('notes'),
    terms: text('terms'),
    convertedFromId: integer('converted_from_id').references((): AnyPgColumn => invoices.id, { onDelete: 'set null' }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    reviewRequestedAt: timestamp('review_requested_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('invoices_customer_idx').on(t.customerId), index('invoices_status_idx').on(t.status)],
);

export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: serial('id').primaryKey(),
    invoiceId: integer('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    description: text('description').notNull(),
    colourName: text('colour_name'),
    quantity: integer('quantity').notNull().default(1),
    unitMinor: bigint('unit_minor', { mode: 'number' }).notNull().default(0),
    discountMinor: bigint('discount_minor', { mode: 'number' }).notNull().default(0),
    lineMinor: bigint('line_minor', { mode: 'number' }).notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('invoice_items_invoice_idx').on(t.invoiceId)],
);

export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    invoiceId: integer('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    method: text('method').$type<'cash' | 'bank_transfer' | 'card'>().notNull(),
    paidOn: date('paid_on').notNull(),
    reference: text('reference'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('payments_invoice_idx').on(t.invoiceId)],
);

export const invoiceCounters = pgTable(
  'invoice_counters',
  {
    year: integer('year').notNull(),
    type: text('type').$type<'invoice' | 'quotation'>().notNull(),
    last: integer('last').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.year, t.type] })],
);
