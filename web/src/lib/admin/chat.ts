import 'server-only';

import { and, asc, desc, eq, gt, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { fieldErrorsFrom, type FormErrors } from '@/lib/admin/knowledge';
import { colomboToday } from '@/lib/bookings/rules';
import { getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { chatModels } from '@/lib/env';
import { revalidateSettings } from '@/lib/revalidate';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';
import type { ChatSettings } from '@/lib/settings/types';

// Admin-side reads and writes for the Chat page: conversation logs, flags and the chat settings.
// The pipeline itself (src/lib/chat) is never reimplemented here.

/** The pipeline's confidence gate: replies scored below this are treated as "not sure". */
export const LOW_CONFIDENCE = 0.2;

export type ConversationFilter = 'all' | 'handoff' | 'thumbs_down' | 'unanswered';
export type MessageRow = typeof s.chatMessages.$inferSelect;
export type ConversationRow = typeof s.chatConversations.$inferSelect;

export type ConversationSummary = {
  id: number;
  /** First characters of the anonymous visitor id. */
  visitor: string;
  startedAt: Date;
  lastMessageAt: Date;
  messages: number;
  intents: Array<{ intent: string; count: number }>;
  handoff: boolean;
  thumbsDown: number;
  flagged: number;
  unanswered: number;
  lastText: string | null;
  lastRole: 'user' | 'assistant' | null;
};

type ListOptions = { filter?: ConversationFilter; page?: number; pageSize?: number };

export async function listConversations(options: ListOptions = {}) {
  const db = await getDb();
  const pageSize = options.pageSize ?? 25;
  const stats = db
    .select({
      id: s.chatConversations.id,
      visitorId: s.chatConversations.visitorId,
      createdAt: s.chatConversations.createdAt,
      lastMessageAt: s.chatConversations.lastMessageAt,
      handoffAt: s.chatConversations.handoffAt,
      messages: sql<number>`count(${s.chatMessages.id})::int`.as('message_count'),
      thumbsDown: sql<number>`count(*) filter (where ${s.chatMessages.rating} = -1)::int`.as('thumbs_down'),
      flagged: sql<number>`count(*) filter (where ${s.chatMessages.flagged})::int`.as('flagged_count'),
      unanswered: sql<number>`count(*) filter (where ${s.chatMessages.role} = 'assistant' and (
        ${s.chatMessages.answeredBy} in ('fallback', 'handoff')
        or (${s.chatMessages.confidence} is not null and ${s.chatMessages.confidence} < ${LOW_CONFIDENCE})
      ))::int`.as('unanswered_count'),
    })
    .from(s.chatConversations)
    .leftJoin(s.chatMessages, eq(s.chatMessages.conversationId, s.chatConversations.id))
    .groupBy(s.chatConversations.id)
    .as('conversation_stats');
  const filter = options.filter ?? 'all';
  const where =
    filter === 'handoff'
      ? isNotNull(stats.handoffAt)
      : filter === 'thumbs_down'
        ? gt(stats.thumbsDown, 0)
        : filter === 'unanswered'
          ? gt(stats.unanswered, 0)
          : undefined;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(stats).where(where);
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const page = Math.min(Math.max(1, Math.floor(options.page ?? 1)), pages);
  const rows = await db
    .select()
    .from(stats)
    .where(where)
    .orderBy(desc(stats.lastMessageAt), desc(stats.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const ids = rows.map((row) => row.id);
  const intentRows = ids.length
    ? await db
        .select({
          conversationId: s.chatMessages.conversationId,
          intent: s.chatMessages.intent,
          count: sql<number>`count(*)::int`,
        })
        .from(s.chatMessages)
        .where(
          and(
            inArray(s.chatMessages.conversationId, ids),
            eq(s.chatMessages.role, 'assistant'),
            isNotNull(s.chatMessages.intent),
          ),
        )
        .groupBy(s.chatMessages.conversationId, s.chatMessages.intent)
    : [];
  const lastRows = ids.length
    ? await db
        .selectDistinctOn([s.chatMessages.conversationId], {
          conversationId: s.chatMessages.conversationId,
          role: s.chatMessages.role,
          text: s.chatMessages.text,
        })
        .from(s.chatMessages)
        .where(inArray(s.chatMessages.conversationId, ids))
        .orderBy(s.chatMessages.conversationId, desc(s.chatMessages.id))
    : [];
  const intents = new Map<number, Array<{ intent: string; count: number }>>();
  for (const row of intentRows) {
    if (!row.intent) continue;
    const list = intents.get(row.conversationId) ?? [];
    list.push({ intent: row.intent, count: row.count });
    intents.set(row.conversationId, list);
  }
  const last = new Map(lastRows.map((row) => [row.conversationId, row]));
  const summaries: ConversationSummary[] = rows.map((row) => ({
    id: row.id,
    visitor: row.visitorId.slice(0, 8),
    startedAt: row.createdAt,
    lastMessageAt: row.lastMessageAt,
    messages: row.messages,
    intents: (intents.get(row.id) ?? []).sort((a, b) => b.count - a.count),
    handoff: row.handoffAt !== null,
    thumbsDown: row.thumbsDown,
    flagged: row.flagged,
    unanswered: row.unanswered,
    lastText: last.get(row.id)?.text ?? null,
    lastRole: last.get(row.id)?.role ?? null,
  }));
  return { rows: summaries, total: count, page, pages };
}

export type ConversationDetail = {
  conversation: ConversationRow;
  messages: MessageRow[];
  /** Names for the ids stored in each answer's `retrieved` column, so the transcript reads as words. */
  chunkTitles: Record<number, string>;
  productNames: Record<number, string>;
  faqQuestions: Record<number, string>;
};

export async function getConversation(id: number): Promise<ConversationDetail | null> {
  const db = await getDb();
  const [conversation] = await db
    .select()
    .from(s.chatConversations)
    .where(eq(s.chatConversations.id, id))
    .limit(1);
  if (!conversation) return null;
  const messages = await db
    .select()
    .from(s.chatMessages)
    .where(eq(s.chatMessages.conversationId, id))
    .orderBy(asc(s.chatMessages.id));
  const unique = (ids: Array<number | undefined>) => {
    const present = ids.filter((value): value is number => value !== undefined);
    return [...new Set(present)];
  };
  const retrieved = messages.map((message) => message.retrieved);
  const chunkIds = unique(retrieved.flatMap((item) => item?.chunks?.map((chunk) => chunk.id) ?? []));
  const productIds = unique(retrieved.flatMap((item) => item?.products?.map((product) => product.id) ?? []));
  const faqIds = unique(retrieved.map((item) => item?.faqId));
  const chunkRows = chunkIds.length
    ? await db
        .select({ id: s.kbChunks.id, headingPath: s.kbChunks.headingPath })
        .from(s.kbChunks)
        .where(inArray(s.kbChunks.id, chunkIds))
    : [];
  const productRows = productIds.length
    ? await db
        .select({ id: s.products.id, name: s.products.name })
        .from(s.products)
        .where(inArray(s.products.id, productIds))
    : [];
  const faqRows = faqIds.length
    ? await db
        .select({ id: s.faqs.id, question: s.faqs.question })
        .from(s.faqs)
        .where(inArray(s.faqs.id, faqIds))
    : [];
  return {
    conversation,
    messages,
    chunkTitles: Object.fromEntries(chunkRows.map((row) => [row.id, row.headingPath])),
    productNames: Object.fromEntries(productRows.map((row) => [row.id, row.name])),
    faqQuestions: Object.fromEntries(faqRows.map((row) => [row.id, row.question])),
  };
}

export type ConversationCounts = { handoff: number; thumbsDown: number; unanswered: number };

/** How many conversations each filter would show: the badges above the list. */
export async function conversationCounts(): Promise<ConversationCounts> {
  const [handoff, thumbsDown, unanswered] = await Promise.all(
    (['handoff', 'thumbs_down', 'unanswered'] as const).map(
      async (filter) => (await listConversations({ filter, pageSize: 1 })).total,
    ),
  );
  return { handoff, thumbsDown, unanswered };
}

/** Marks an assistant answer as wrong (or clears the mark). Returns false when the message does not exist. */
export async function setMessageFlag(messageId: number, flagged: boolean): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(s.chatMessages)
    .set({ flagged })
    .where(and(eq(s.chatMessages.id, messageId), eq(s.chatMessages.role, 'assistant')))
    .returning({ id: s.chatMessages.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Settings (owner only): the `chat` row of the settings table
// ---------------------------------------------------------------------------

/** Same layering as getSettings(): defaults first, stored values on top. */
function mergeStored<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) return base;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return override as T;
  if (typeof override !== 'object' || Array.isArray(override)) return override as T;
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    result[key] = key in result ? mergeStored(result[key], value) : value;
  }
  return result as T;
}

/**
 * The chat settings as stored right now. This reads the row itself rather than getSettings(): that one is
 * cached, and a stale copy must never be written back over what the embeddings switch stored.
 */
export async function readChatSettings(): Promise<ChatSettings> {
  const db = await getDb();
  const [row] = await db
    .select({ value: s.settings.value })
    .from(s.settings)
    .where(eq(s.settings.key, 'chat'))
    .limit(1);
  return mergeStored(structuredClone(DEFAULT_SETTINGS.chat), row?.value);
}

const blankToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

function numberField(label: string, min: number, max: number, whole: boolean) {
  const base = z.coerce.number(`${label} must be a number.`);
  const sized = (whole ? base.int(`${label} must be a whole number.`) : base)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} must be ${max} or less.`);
  return z.preprocess(blankToUndefined, sized);
}

const modelField = z
  .string()
  .max(120, 'A model id is too long.')
  .regex(/^[A-Za-z0-9._:/@+-]+$/, 'Model ids look like vendor/model-name:free.');

export const chatSettingsSchema = z.object({
  models: z.preprocess(
    (value) => {
      if (value === undefined || value === null) return [];
      if (typeof value !== 'string') return value;
      return value
        .split(/[,\n]/)
        .map((part) => part.trim())
        .filter(Boolean);
    },
    z.array(modelField).max(10, 'Use at most 10 models.'),
  ),
  dailyModelBudget: numberField('Daily budget', 0, 10_000, true),
  perSessionModelAnswers: numberField('Answers per session', 0, 50, true),
  messagesPer10Min: numberField('Messages per 10 minutes', 1, 500, true),
  temperature: numberField('Temperature', 0, 2, false),
  maxTokens: numberField('Max tokens', 16, 4000, true),
});

export type SaveChatSettingsResult =
  | { ok: true; settings: ChatSettings }
  | { ok: false; error: string; fieldErrors: FormErrors };

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Validates the form and merges it into the stored `chat` row. Fields the form does not show (buffer,
 * timeout and the embeddings switch) keep their stored values. A model list equal to the environment
 * default is stored as null so the default keeps following the environment.
 */
export async function saveChatSettings(raw: unknown): Promise<SaveChatSettingsResult> {
  const parsed = chatSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Please check the highlighted fields.', fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const input = parsed.data;
  const models = [...new Set(input.models)];
  const db = await getDb();
  const saved = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ value: s.settings.value })
      .from(s.settings)
      .where(eq(s.settings.key, 'chat'))
      .limit(1);
    const current = mergeStored(structuredClone(DEFAULT_SETTINGS.chat), row?.value);
    const next: ChatSettings = {
      ...current,
      models: models.length === 0 || sameList(models, chatModels()) ? null : models,
      dailyModelBudget: input.dailyModelBudget,
      perSessionModelAnswers: input.perSessionModelAnswers,
      messagesPer10Min: input.messagesPer10Min,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    };
    await tx
      .insert(s.settings)
      .values({ key: 'chat', value: next })
      .onConflictDoUpdate({ target: s.settings.key, set: { value: next, updatedAt: new Date() } });
    return next;
  });
  try {
    revalidateSettings();
  } catch {
    // Outside a Next.js request (scripts, tests) there is no cache to refresh.
  }
  return { ok: true, settings: saved };
}

/** Midnight in Asia/Colombo, when the daily model budget resets. */
export function colomboMidnight(now: Date = new Date()): Date {
  return new Date(`${colomboToday(now)}T00:00:00+05:30`);
}

/** Answers written by the model since midnight (Colombo): what the daily budget counts. */
export async function modelCallsToday(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(s.chatMessages)
    .where(and(eq(s.chatMessages.answeredBy, 'model'), gte(s.chatMessages.createdAt, colomboMidnight())));
  return row.count;
}

export type ChatSettingsView = {
  settings: ChatSettings;
  envModels: string[];
  effectiveModels: string[];
  usedToday: number;
};

export async function chatSettingsView(): Promise<ChatSettingsView> {
  const settings = await readChatSettings();
  const envModels = chatModels();
  return {
    settings,
    envModels,
    effectiveModels: settings.models && settings.models.length > 0 ? settings.models : envModels,
    usedToday: await modelCallsToday(),
  };
}
