import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tsvector } from './types';

export const kbDocuments = pgTable(
  'kb_documents',
  {
    id: serial('id').primaryKey(),
    /** File name without extension, e.g. 'delivery-and-warranty'. */
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    kind: text('kind').$type<'md' | 'json'>().notNull(),
    fileKey: text('file_key'),
    version: integer('version').notNull().default(1),
    isCurrent: boolean('is_current').notNull().default(true),
    enabled: boolean('enabled').notNull().default(true),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    priority: text('priority').$type<'high' | 'normal' | 'low'>().notNull().default('normal'),
    checksum: text('checksum'),
    source: text('source').$type<'starter' | 'upload'>().notNull().default('starter'),
    editedInAdmin: boolean('edited_in_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('kb_documents_current_uq').on(t.slug).where(sql`${t.isCurrent}`)],
);

export const kbChunks = pgTable(
  'kb_chunks',
  {
    id: serial('id').primaryKey(),
    documentId: integer('document_id')
      .notNull()
      .references(() => kbDocuments.id, { onDelete: 'cascade' }),
    headingPath: text('heading_path').notNull(),
    body: text('body').notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    priority: text('priority').notNull().default('normal'),
    tokens: integer('tokens').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    tsv: tsvector('tsv').generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(heading_path, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')`,
    ),
  },
  (t) => [index('kb_chunks_tsv_idx').using('gin', t.tsv), index('kb_chunks_document_idx').on(t.documentId)],
);

export const faqs = pgTable(
  'faqs',
  {
    id: serial('id').primaryKey(),
    question: text('question').notNull(),
    alternatives: text('alternatives').array().notNull().default(sql`'{}'::text[]`),
    answer: text('answer').notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    hitCount: integer('hit_count').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    documentId: integer('document_id').references(() => kbDocuments.id, { onDelete: 'set null' }),
    source: text('source').$type<'starter' | 'upload' | 'admin' | 'gap'>().notNull().default('starter'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('faqs_question_trgm_idx').using('gin', t.question.op('gin_trgm_ops'))],
);

export const synonyms = pgTable('synonyms', {
  id: serial('id').primaryKey(),
  term: text('term').notNull().unique(),
  variants: text('variants').array().notNull().default(sql`'{}'::text[]`),
  source: text('source').$type<'starter' | 'upload' | 'admin'>().notNull().default('starter'),
});
