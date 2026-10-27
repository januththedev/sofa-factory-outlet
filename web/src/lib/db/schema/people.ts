import { sql } from 'drizzle-orm';
import { boolean, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { AdminRole } from './types';

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  /** Normalised to +94XXXXXXXXX; customers are matched by phone. */
  phone: text('phone').notNull().unique(),
  whatsapp: text('whatsapp'),
  email: text('email'),
  city: text('city'),
  address: text('address'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminUsers = pgTable(
  'admin_users',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').$type<AdminRole>().notNull().default('staff'),
    active: boolean('active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('admin_users_email_uq').on(sql`lower(${t.email})`)],
);
