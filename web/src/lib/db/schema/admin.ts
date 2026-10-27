import { index, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    type: text('type')
      .$type<'booking' | 'handoff' | 'knowledge_gap' | 'flagged_answer' | 'overdue_invoice' | 'digest' | 'review' | 'system'>()
      .notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_unread_idx').on(t.readAt, t.createdAt)],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
