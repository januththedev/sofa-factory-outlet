import { boolean, index, integer, jsonb, pgTable, real, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { faqs } from './knowledge';

export type ChatContext = {
  page?: string;
  productId?: number;
  variantId?: number;
  cart?: Array<{ productId: number; variantId?: number; quantity: number }>;
};

export const chatConversations = pgTable(
  'chat_conversations',
  {
    id: serial('id').primaryKey(),
    visitorId: text('visitor_id').notNull(),
    sessionId: text('session_id').notNull(),
    context: jsonb('context').$type<ChatContext>().notNull().default({}),
    modelAnswers: integer('model_answers').notNull().default(0),
    handoffAt: timestamp('handoff_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('chat_conversations_visitor_idx').on(t.visitorId), index('chat_conversations_session_idx').on(t.sessionId)],
);

export type Retrieved = {
  products?: Array<{ id: number; score: number }>;
  chunks?: Array<{ id: number; score: number }>;
  faqId?: number;
};

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => chatConversations.id, { onDelete: 'cascade' }),
    role: text('role').$type<'user' | 'assistant'>().notNull(),
    text: text('text').notNull(),
    intent: text('intent'),
    extracted: jsonb('extracted').$type<Record<string, unknown> | null>(),
    retrieved: jsonb('retrieved').$type<Retrieved | null>(),
    confidence: real('confidence'),
    answeredBy: text('answered_by').$type<'faq' | 'template' | 'model' | 'handoff' | 'fallback'>(),
    model: text('model'),
    latencyMs: integer('latency_ms'),
    rating: integer('rating'),
    flagged: boolean('flagged').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('chat_messages_conversation_idx').on(t.conversationId),
    index('chat_messages_answered_idx').on(t.answeredBy, t.createdAt),
  ],
);

export const knowledgeGaps = pgTable('knowledge_gaps', {
  id: serial('id').primaryKey(),
  question: text('question').notNull(),
  normalised: text('normalised').notNull().unique(),
  timesAsked: integer('times_asked').notNull().default(1),
  status: text('status').$type<'open' | 'answered' | 'dismissed'>().notNull().default('open'),
  resolvedFaqId: integer('resolved_faq_id').references(() => faqs.id, { onDelete: 'set null' }),
  lastAskedAt: timestamp('last_asked_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
