import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { products, productVariants } from './catalogue';
import { customers } from './people';
import type { BookingStatus, ImageRef } from './types';

/** Feeds booking references: SFO-B-0001, SFO-B-0002, … (formatted in code). */
export const bookingRefSeq = pgSequence('booking_ref_seq', { startWith: 1, increment: 1 });

export const bookingSlots = pgTable('booking_slots', {
  id: serial('id').primaryKey(),
  /** 0 = Sunday … 6 = Saturday */
  weekday: integer('weekday').notNull(),
  start: text('start').notNull(),
  end: text('end').notNull(),
  capacity: integer('capacity').notNull().default(3),
  active: boolean('active').notNull().default(true),
});

export const bookings = pgTable(
  'bookings',
  {
    id: serial('id').primaryKey(),
    reference: text('reference').notNull().unique(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id),
    visitDate: date('visit_date').notNull(),
    slotId: integer('slot_id').references(() => bookingSlots.id, { onDelete: 'set null' }),
    slotLabel: text('slot_label').notNull(),
    status: text('status').$type<BookingStatus>().notNull().default('new'),
    customerNotes: text('customer_notes'),
    staffNotes: text('staff_notes'),
    preferredContact: text('preferred_contact').$type<'whatsapp' | 'call' | 'email'>().notNull().default('whatsapp'),
    city: text('city'),
    sourcePage: text('source_page'),
    referrer: text('referrer'),
    utm: jsonb('utm').$type<Record<string, string> | null>(),
    visitorId: text('visitor_id'),
    conversationId: integer('conversation_id'),
    consentAt: timestamp('consent_at', { withTimezone: true }),
    reviewRequestedAt: timestamp('review_requested_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('bookings_date_slot_idx').on(t.visitDate, t.slotId),
    index('bookings_status_idx').on(t.status),
    index('bookings_customer_idx').on(t.customerId),
  ],
);

export const bookingItems = pgTable(
  'booking_items',
  {
    id: serial('id').primaryKey(),
    bookingId: integer('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    productName: text('product_name').notNull(),
    productSlug: text('product_slug'),
    colourName: text('colour_name'),
    hex: text('hex'),
    image: jsonb('image').$type<ImageRef | null>(),
    quantity: integer('quantity').notNull().default(1),
    priceMinor: bigint('price_minor', { mode: 'number' }),
  },
  (t) => [index('booking_items_booking_idx').on(t.bookingId)],
);
