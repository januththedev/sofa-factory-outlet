import 'server-only';

import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type GoldenFailure, runGoldenSet } from '@/lib/chat/eval';
import { type DbOrTx, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { ingestDocument, type IngestInput } from '@/lib/kb/api';
import { chunkDocument, type KnowledgeChunk } from '@/lib/kb/chunk';
import { parseDocument } from '@/lib/kb/parse';
import { revalidateTags } from '@/lib/revalidate';
import { storage } from '@/lib/storage';

// Admin-side operations for the Knowledge base page. Ingestion, retrieval and
// embeddings stay in src/lib/kb; this file only wraps them with the admin's
// extras: versions, switches, FAQs, synonyms, the gap queue and the golden run.

export const MAX_UPLOAD_BYTES = 1024 * 1024;

const EVAL_KEY = 'chat_eval_last';
const MAX_SYNONYM_TERMS = 2000;

export type LineError = { line?: number; message: string };
export type FormErrors = Record<string, string>;
/** What a server action hands back to its form or button. */
export type ActionResult = { ok: true } | { ok: false; error: string };
export type FormResult = { ok: true } | { ok: false; error: string; fieldErrors: FormErrors };
export type DocumentRow = typeof s.kbDocuments.$inferSelect;
export type FaqRow = typeof s.faqs.$inferSelect;
export type SynonymRow = typeof s.synonyms.$inferSelect;
export type GapRow = typeof s.knowledgeGaps.$inferSelect;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const whenFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Admin time stamps are shown in the business time zone. */
export function formatWhen(value: Date | string): string {
  return whenFormat.format(new Date(value));
}

/** Friendly text for a failed call. A contract stub that is not built yet gets its own wording. */
export function describeError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof Error && error.message.includes('is not implemented yet')) {
    return 'This part of the chatbot is not installed yet, so it cannot run right now.';
  }
  console.error('[admin]', error);
  return fallback;
}

export function fieldErrorsFrom(error: z.ZodError): FormErrors {
  const errors: FormErrors = {};
  for (const issue of error.issues) {
    const key = typeof issue.path[0] === 'string' ? issue.path[0] : 'form';
    errors[key] ??= issue.message;
  }
  return errors;
}

function refreshKnowledgeCache(): void {
  try {
    revalidateTags('kb');
  } catch {
    // Outside a Next.js request (scripts) there is no cache to refresh.
  }
}

function questionKey(question: string): string {
  return question.trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split(/\r?\n/).length;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type DocumentSummary = {
  id: number;
  slug: string;
  title: string;
  kind: 'md' | 'json';
  version: number;
  tags: string[];
  priority: 'high' | 'normal' | 'low';
  enabled: boolean;
  chunkCount: number;
  versionCount: number;
  updatedAt: Date;
  source: 'starter' | 'upload';
  editedInAdmin: boolean;
};

export async function listDocuments(): Promise<DocumentSummary[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(s.kbDocuments)
    .where(eq(s.kbDocuments.isCurrent, true))
    .orderBy(asc(s.kbDocuments.title));
  if (rows.length === 0) return [];
  const chunkRows = await db
    .select({ documentId: s.kbChunks.documentId, count: sql<number>`count(*)::int` })
    .from(s.kbChunks)
    .where(inArray(s.kbChunks.documentId, rows.map((row) => row.id)))
    .groupBy(s.kbChunks.documentId);
  const versionRows = await db
    .select({ slug: s.kbDocuments.slug, count: sql<number>`count(*)::int` })
    .from(s.kbDocuments)
    .where(inArray(s.kbDocuments.slug, rows.map((row) => row.slug)))
    .groupBy(s.kbDocuments.slug);
  const chunkCounts = new Map(chunkRows.map((row) => [row.documentId, row.count]));
  const versionCounts = new Map(versionRows.map((row) => [row.slug, row.count]));
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    version: row.version,
    tags: row.tags,
    priority: row.priority,
    enabled: row.enabled,
    chunkCount: chunkCounts.get(row.id) ?? 0,
    versionCount: versionCounts.get(row.slug) ?? 1,
    updatedAt: row.createdAt,
    source: row.source,
    editedInAdmin: row.editedInAdmin,
  }));
}

export async function getCurrentDocument(slug: string): Promise<DocumentRow | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(s.kbDocuments)
    .where(and(eq(s.kbDocuments.slug, slug), eq(s.kbDocuments.isCurrent, true)))
    .limit(1);
  return row ?? null;
}

export type VersionSummary = {
  id: number;
  version: number;
  isCurrent: boolean;
  source: 'starter' | 'upload';
  createdAt: Date;
  chunkCount: number;
  hasFile: boolean;
};

export async function listVersions(slug: string): Promise<VersionSummary[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(s.kbDocuments)
    .where(eq(s.kbDocuments.slug, slug))
    .orderBy(desc(s.kbDocuments.version));
  if (rows.length === 0) return [];
  const chunkRows = await db
    .select({ documentId: s.kbChunks.documentId, count: sql<number>`count(*)::int` })
    .from(s.kbChunks)
    .where(inArray(s.kbChunks.documentId, rows.map((row) => row.id)))
    .groupBy(s.kbChunks.documentId);
  const chunkCounts = new Map(chunkRows.map((row) => [row.documentId, row.count]));
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    isCurrent: row.isCurrent,
    source: row.source,
    createdAt: row.createdAt,
    chunkCount: chunkCounts.get(row.id) ?? 0,
    hasFile: row.fileKey !== null,
  }));
}

export type PreviewChunk = Pick<KnowledgeChunk, 'headingPath' | 'body' | 'tags' | 'tokens' | 'priority'>;

/** The chunks stored for one document version, in reading order. */
export async function listChunks(documentId: number): Promise<PreviewChunk[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(s.kbChunks)
    .where(eq(s.kbChunks.documentId, documentId))
    .orderBy(asc(s.kbChunks.sortOrder), asc(s.kbChunks.id));
  return rows.map((row) => ({
    headingPath: row.headingPath,
    body: row.body,
    tags: row.tags,
    tokens: row.tokens,
    priority: row.priority === 'high' || row.priority === 'low' ? row.priority : 'normal',
  }));
}

/** The original file text stored at upload time, or null when storage has no copy. */
export async function readStoredText(fileKey: string | null): Promise<string | null> {
  if (!fileKey) return null;
  try {
    const data = await storage().get(fileKey);
    return data ? data.toString('utf8') : null;
  } catch {
    return null;
  }
}

/** Only the current version is searched, so the switch always targets it. */
export async function setDocumentEnabled(id: number, enabled: boolean): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(s.kbDocuments)
    .set({ enabled })
    .where(and(eq(s.kbDocuments.id, id), eq(s.kbDocuments.isCurrent, true)))
    .returning({ id: s.kbDocuments.id });
  refreshKnowledgeCache();
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Upload, preview, edit
// ---------------------------------------------------------------------------

const uploadSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'Choose a file.')
    .max(200, 'The file name is too long.')
    .regex(/\.(md|json)$/i, 'Upload a .md or .json file.'),
  text: z
    .string()
    .min(1, 'The file is empty.')
    .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_UPLOAD_BYTES, 'The file is larger than 1 MB.'),
});

const editSchema = z.object({
  slug: z.string().trim().min(1).max(100),
  text: uploadSchema.shape.text,
});

/** File name without extension, lower case, letters, digits and hyphens only. */
export function slugFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

type UploadFile = { slug: string; kind: 'md' | 'json'; text: string };

export function validateUpload(raw: unknown): { ok: true; file: UploadFile } | { ok: false; errors: LineError[] } {
  const parsed = uploadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((issue) => ({ message: issue.message })) };
  const slug = slugFromFileName(parsed.data.fileName);
  if (!slug) return { ok: false, errors: [{ message: 'The file name needs some letters or numbers.' }] };
  const kind = parsed.data.fileName.toLowerCase().endsWith('.json') ? 'json' : 'md';
  return { ok: true, file: { slug, kind, text: parsed.data.text } };
}

export type KnowledgePreview = {
  slug: string;
  kind: 'md' | 'json';
  contentType: 'Markdown document' | 'FAQ list' | 'Synonym list';
  title: string;
  tags: string[];
  priority: 'high' | 'normal' | 'low';
  chunks: PreviewChunk[];
  faqs: number;
  synonyms: number;
  currentVersion: number | null;
};

export type PreviewResponse = { ok: true; preview: KnowledgePreview } | { ok: false; errors: LineError[] };


/** The ingest names a failing FAQ field by its place in the list ("1.a"); readers count entries from 1. */
function friendlyError(error: LineError): LineError {
  const entry = /^(\d+)\.(q|alt|a|tags)(?:\.\d+)?: ([\s\S]+)$/.exec(error.message);
  if (!entry) return error;
  return { ...error, message: `Entry ${Number(entry[1]) + 1}, "${entry[2]}": ${entry[3]}` };
}

/** JSON that does not parse, with the line it broke on (the ingest's own line is not always right). */
function jsonSyntaxError(kind: 'md' | 'json', text: string): LineError | null {
  if (kind !== 'json') return null;
  try {
    JSON.parse(text);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The file is not valid JSON.';
    return { line: jsonErrorLine(text, message), message };
  }
}

/** Parse and chunk with the same pure functions the ingest uses, so the preview is what the bot will read. */
export async function previewKnowledge(raw: unknown): Promise<PreviewResponse> {
  const upload = validateUpload(raw);
  if (!upload.ok) return upload;
  const { slug, kind, text } = upload.file;
  const syntax = jsonSyntaxError(kind, text);
  if (syntax) return { ok: false, errors: [syntax] };
  const parsed = parseDocument({ slug, kind, text });
  if (!parsed.ok) return { ok: false, errors: parsed.errors.map(friendlyError) };
  const document = parsed.document;
  const current = await getCurrentDocument(slug);
  const contentType = {
    md: 'Markdown document',
    faq: 'FAQ list',
    synonyms: 'Synonym list',
  } as const;
  return {
    ok: true,
    preview: {
      slug,
      kind,
      contentType: contentType[document.kind],
      title: document.title,
      tags: document.kind === 'md' ? document.tags : [],
      priority: document.kind === 'md' ? document.priority : 'normal',
      chunks: chunkDocument(document),
      faqs: document.kind === 'faq' ? document.entries.length : 0,
      synonyms: document.kind === 'synonyms' ? Object.keys(document.entries).length : 0,
      currentVersion: current?.version ?? null,
    },
  };
}

export type SaveResult =
  | {
      ok: true;
      slug: string;
      version: number;
      previousVersion: number | null;
      unchanged: boolean;
      chunks: number;
      faqs: number;
      synonyms: number;
    }
  | { ok: false; errors: LineError[] };

/**
 * Runs the real ingest, then marks the new current version as admin-owned (the starter loader never
 * overwrites it) and keeps the on/off switch where the admin left it: a fresh version row starts enabled.
 */
async function ingestAsAdmin(input: IngestInput): Promise<SaveResult> {
  const db = await getDb();
  const syntax = jsonSyntaxError(input.kind, input.text);
  if (syntax) return { ok: false, errors: [syntax] };
  const previous = await getCurrentDocument(input.slug);
  const result = await ingestDocument(input);
  if (!result.ok) return { ok: false, errors: result.errors.map(friendlyError) };
  const unchanged = previous !== null && previous.id === result.documentId;
  if (!unchanged) {
    await db
      .update(s.kbDocuments)
      .set({ editedInAdmin: true, enabled: previous?.enabled ?? true })
      .where(eq(s.kbDocuments.id, result.documentId));
  }
  refreshKnowledgeCache();
  return {
    ok: true,
    slug: input.slug,
    version: result.version,
    previousVersion: previous?.version ?? null,
    unchanged,
    chunks: result.chunks,
    faqs: result.faqs,
    synonyms: result.synonyms,
  };
}

/** Saves an uploaded .md / .json file as a new version of the document with the same file name. */
export async function saveUpload(raw: unknown): Promise<SaveResult> {
  const upload = validateUpload(raw);
  if (!upload.ok) return upload;
  const { slug, kind, text } = upload.file;
  return ingestAsAdmin({ slug, kind, text, source: 'upload' });
}

/** Saves text edited in the browser as a new version, keeping the document's kind, title and source. */
export async function saveEdit(raw: unknown): Promise<SaveResult> {
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((issue) => ({ message: issue.message })) };
  const current = await getCurrentDocument(parsed.data.slug);
  if (!current) return { ok: false, errors: [{ message: 'That document no longer exists.' }] };
  return ingestAsAdmin({
    slug: current.slug,
    title: current.title,
    kind: current.kind,
    text: parsed.data.text,
    source: current.source,
  });
}

// ---------------------------------------------------------------------------
// Roll back
// ---------------------------------------------------------------------------

export type RollbackResult =
  | {
      ok: true;
      slug: string;
      /** The version the bot reads now. */
      version: number;
      chunks: number;
      /** `switched`: the older version is current again. `restored`: its stored file was ingested as a new version. */
      mode: 'switched' | 'restored';
      /** The older version that was brought back. */
      restoredFrom: number;
    }
  | { ok: false; error: string };

const embeddingsSettingSchema = z.object({ embeddings: z.object({ enabled: z.boolean() }) });

async function embeddingsAreOn(): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ value: s.settings.value })
    .from(s.settings)
    .where(eq(s.settings.key, 'chat'))
    .limit(1);
  const parsed = embeddingsSettingSchema.safeParse(row?.value);
  return parsed.success && parsed.data.embeddings.enabled;
}

/**
 * Makes an older version the current one.
 *
 * A Markdown version whose chunks are still stored just becomes current again (one transaction: the current
 * row is switched off, the older one on, the on/off switch carried over). FAQ and synonym files, versions
 * without stored chunks, and any rollback while embeddings are on are rebuilt instead: the stored original
 * file goes through the real ingest, which rebuilds the chunks (and embeddings) and re-applies the entries.
 * That ingest saves the old text as a new version number.
 */
export async function rollbackToVersion(versionId: number): Promise<RollbackResult> {
  const db = await getDb();
  const [target] = await db.select().from(s.kbDocuments).where(eq(s.kbDocuments.id, versionId)).limit(1);
  if (!target) return { ok: false, error: 'That version no longer exists.' };
  if (target.isCurrent) return { ok: false, error: `Version ${target.version} is already the current version.` };
  const [stored] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(s.kbChunks)
    .where(eq(s.kbChunks.documentId, target.id));
  if (target.kind === 'md' && stored.count > 0 && !(await embeddingsAreOn())) {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ enabled: s.kbDocuments.enabled })
        .from(s.kbDocuments)
        .where(and(eq(s.kbDocuments.slug, target.slug), eq(s.kbDocuments.isCurrent, true)))
        .limit(1);
      // Only one row per slug may be current, so the old one is switched off first.
      await tx
        .update(s.kbDocuments)
        .set({ isCurrent: false })
        .where(and(eq(s.kbDocuments.slug, target.slug), eq(s.kbDocuments.isCurrent, true)));
      await tx
        .update(s.kbDocuments)
        .set({ isCurrent: true, enabled: current?.enabled ?? target.enabled, editedInAdmin: true })
        .where(eq(s.kbDocuments.id, target.id));
    });
    refreshKnowledgeCache();
    return {
      ok: true,
      slug: target.slug,
      version: target.version,
      chunks: stored.count,
      mode: 'switched',
      restoredFrom: target.version,
    };
  }
  const text = await readStoredText(target.fileKey);
  if (text === null) {
    const error = `The original file for version ${target.version} was not kept, so it cannot be restored.`;
    return { ok: false, error };
  }
  const saved = await ingestAsAdmin({
    slug: target.slug,
    title: target.title,
    kind: target.kind,
    text,
    source: target.source,
  });
  if (!saved.ok) {
    const reason = saved.errors[0]?.message ?? 'the file is invalid';
    return { ok: false, error: `Version ${target.version} no longer passes the format check: ${reason}` };
  }
  if (saved.unchanged) {
    return { ok: false, error: `Version ${target.version} has the same text as the current version.` };
  }
  return {
    ok: true,
    slug: target.slug,
    version: saved.version,
    chunks: saved.chunks,
    mode: 'restored',
    restoredFrom: target.version,
  };
}

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------

/** Text fields hold lists as lines or comma separated words; arrays pass through. */
function toList(value: unknown, pattern: RegExp): unknown {
  if (value === undefined || value === null) return [];
  if (typeof value !== 'string') return value;
  return value
    .split(pattern)
    .map((part) => part.trim())
    .filter(Boolean);
}

function toTagList(value: unknown): unknown {
  const list = toList(value, /[,\n]/);
  if (!Array.isArray(list)) return list;
  return list.map((tag) => (typeof tag === 'string' ? tag.trim().replace(/\s+/g, '_') : tag));
}

const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(40, 'Tags are limited to 40 characters.')
  .regex(/^[a-z0-9_-]+$/, 'Tags use letters, numbers, - and _.');

const alternativeSchema = z.string().trim().min(1).max(300, 'Keep each alternative under 300 characters.');

export const faqSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'Write the question people ask.')
    .max(300, 'Keep the question under 300 characters.'),
  alternatives: z.preprocess(
    (value) => toList(value, /\r?\n/),
    z.array(alternativeSchema).max(20, 'Use at most 20 alternatives.'),
  ),
  answer: z.string().trim().min(1, 'Write the answer.').max(2000, 'Keep the answer under 2,000 characters.'),
  tags: z.preprocess(toTagList, z.array(tagSchema).max(10, 'Use at most 10 tags.')),
  enabled: z.boolean().default(true),
});

type FaqFailure = { ok: false; error: string; fieldErrors: FormErrors };

export type FaqResult = { ok: true; faq: FaqRow } | FaqFailure;

async function findDuplicateFaq(db: DbOrTx, question: string, excludeId?: number): Promise<number | null> {
  const key = questionKey(question);
  const rows = await db.select({ id: s.faqs.id, question: s.faqs.question }).from(s.faqs);
  const match = rows.find((row) => row.id !== excludeId && questionKey(row.question) === key);
  return match?.id ?? null;
}

function duplicateFaq(id: number): FaqFailure {
  return {
    ok: false,
    error: 'This question already has an FAQ.',
    fieldErrors: { question: `There is already an FAQ for this question (number ${id}). Edit that one instead.` },
  };
}

export async function listFaqs(options: { search?: string; page?: number; pageSize?: number } = {}) {
  const db = await getDb();
  const pageSize = options.pageSize ?? 50;
  const term = options.search?.trim();
  const pattern = term ? `%${escapeLike(term)}%` : null;
  const where = pattern
    ? or(
        ilike(s.faqs.question, pattern),
        ilike(s.faqs.answer, pattern),
        sql`array_to_string(${s.faqs.alternatives}, ' ') ilike ${pattern}`,
      )
    : undefined;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(s.faqs).where(where);
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const page = Math.min(Math.max(1, Math.floor(options.page ?? 1)), pages);
  const rows = await db
    .select()
    .from(s.faqs)
    .where(where)
    .orderBy(asc(s.faqs.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { rows, total: count, page, pages };
}

/** Creates an FAQ, or edits the one in `options.id`. Questions are unique after trimming and lower-casing. */
export async function saveFaq(
  raw: unknown,
  options: { id?: number; source?: FaqRow['source'] } = {},
): Promise<FaqResult> {
  const parsed = faqSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Please check the highlighted fields.', fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const db = await getDb();
  const input = parsed.data;
  const duplicate = await findDuplicateFaq(db, input.question, options.id);
  if (duplicate !== null) return duplicateFaq(duplicate);
  const fields = {
    question: input.question,
    alternatives: input.alternatives,
    answer: input.answer,
    tags: input.tags,
    enabled: input.enabled,
  };
  if (options.id === undefined) {
    const [created] = await db
      .insert(s.faqs)
      .values({ ...fields, source: options.source ?? 'admin' })
      .returning();
    refreshKnowledgeCache();
    return { ok: true, faq: created };
  }
  const [updated] = await db
    .update(s.faqs)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(s.faqs.id, options.id))
    .returning();
  if (!updated) return { ok: false, error: 'That FAQ no longer exists.', fieldErrors: {} };
  refreshKnowledgeCache();
  return { ok: true, faq: updated };
}

export async function setFaqEnabled(id: number, enabled: boolean): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(s.faqs)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(s.faqs.id, id))
    .returning({ id: s.faqs.id });
  refreshKnowledgeCache();
  return rows.length > 0;
}

/** Deleting the FAQ that answered a gap puts that question back in the queue. */
export async function deleteFaq(id: number): Promise<boolean> {
  const db = await getDb();
  const deleted = await db.transaction(async (tx) => {
    await tx
      .update(s.knowledgeGaps)
      .set({ status: 'open', resolvedFaqId: null })
      .where(and(eq(s.knowledgeGaps.resolvedFaqId, id), eq(s.knowledgeGaps.status, 'answered')));
    const rows = await tx.delete(s.faqs).where(eq(s.faqs.id, id)).returning({ id: s.faqs.id });
    return rows.length > 0;
  });
  refreshKnowledgeCache();
  return deleted;
}

// ---------------------------------------------------------------------------
// Synonyms
// ---------------------------------------------------------------------------

const termSchema = z.string().trim().min(1, 'The term is empty.').max(80, 'Terms are limited to 80 characters.');
const variantSchema = z
  .string()
  .trim()
  .min(1, 'A variant is empty.')
  .max(80, 'Variants are limited to 80 characters.');
const variantsSchema = z
  .array(variantSchema, 'Use a list of words, for example ["corner sofa", "sectional"].')
  .min(1, 'Add at least one variant.')
  .max(100, 'Use at most 100 variants per term.');

/** Trims, drops repeats (ignoring case) and removes the term itself. */
function cleanVariants(term: string, variants: string[]): string[] {
  const seen = new Set([term.toLocaleLowerCase('en')]);
  const cleaned: string[] = [];
  for (const variant of variants) {
    const key = variant.trim().toLocaleLowerCase('en');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(variant.trim());
  }
  return cleaned;
}

export async function listSynonyms(): Promise<SynonymRow[]> {
  const db = await getDb();
  return db.select().from(s.synonyms).orderBy(asc(s.synonyms.term));
}

export type SynonymEntry = { term: string; variants: string[] };
export type SynonymEntries = SynonymEntry[];
export type SynonymSaveResult = { ok: true; entry: SynonymEntry } | { ok: false; error: string };

/** Adds a term or replaces its variants (the chip editor). */
export async function saveSynonym(raw: unknown): Promise<SynonymSaveResult> {
  const parsed = z.object({ term: termSchema, variants: variantsSchema }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the term and variants.' };
  const variants = cleanVariants(parsed.data.term, parsed.data.variants);
  if (variants.length === 0) return { ok: false, error: 'Add at least one variant that differs from the term.' };
  const db = await getDb();
  await db
    .insert(s.synonyms)
    .values({ term: parsed.data.term, variants, source: 'admin' })
    .onConflictDoUpdate({ target: s.synonyms.term, set: { variants, source: 'admin' } });
  refreshKnowledgeCache();
  return { ok: true, entry: { term: parsed.data.term, variants } };
}

export async function deleteSynonym(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.delete(s.synonyms).where(eq(s.synonyms.id, id)).returning({ id: s.synonyms.id });
  refreshKnowledgeCache();
  return rows.length > 0;
}

/**
 * Some JSON.parse messages ("Unexpected token '}'") carry no position. Parse longer and longer starts of the
 * text: the first start that fails for a reason other than "not finished yet" ends on the faulty character.
 */
function firstBadJsonLine(text: string): number | undefined {
  const failsAt = (end: number): boolean => {
    try {
      JSON.parse(text.slice(0, end));
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/end of JSON input/i.test(message)) return false;
      const position = /position (\d+)/.exec(message);
      return !(position && Number(position[1]) >= end);
    }
  };
  if (!failsAt(text.length)) return undefined;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (failsAt(middle)) high = middle;
    else low = middle + 1;
  }
  return lineAt(text, Math.max(0, high - 1));
}

function jsonErrorLine(text: string, message: string): number | undefined {
  const direct = /\(line (\d+) column \d+\)/.exec(message);
  if (direct) return Number(direct[1]);
  const position = /position (\d+)/.exec(message);
  return position ? lineAt(text, Number(position[1])) : firstBadJsonLine(text);
}

function lineOfKey(text: string, key: string): number | undefined {
  const index = text.indexOf(JSON.stringify(key));
  return index < 0 ? undefined : lineAt(text, index);
}

export type SynonymParse = { ok: true; entries: SynonymEntries } | { ok: false; errors: LineError[] };

/** Validates a synonyms JSON file such as `{ "l-shape": ["corner sofa"] }`. Every problem is reported with its line. */
export function parseSynonymImport(text: string): SynonymParse {
  if (Buffer.byteLength(text, 'utf8') > MAX_UPLOAD_BYTES) {
    return { ok: false, errors: [{ message: 'The file is larger than 1 MB.' }] };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The file is not valid JSON.';
    return { ok: false, errors: [{ line: jsonErrorLine(text, message), message }] };
  }
  const shape = z.record(z.string(), z.unknown()).safeParse(value);
  if (!shape.success || Array.isArray(value)) {
    return { ok: false, errors: [{ message: 'Use an object such as {"l-shape": ["corner sofa", "sectional"]}.' }] };
  }
  const pairs = Object.entries(shape.data);
  if (pairs.length === 0) return { ok: false, errors: [{ message: 'The file has no terms in it.' }] };
  if (pairs.length > MAX_SYNONYM_TERMS) {
    return { ok: false, errors: [{ message: `Use at most ${MAX_SYNONYM_TERMS} terms per file.` }] };
  }
  const errors: LineError[] = [];
  const entries: SynonymEntries = [];
  for (const [rawTerm, rawVariants] of pairs) {
    const line = lineOfKey(text, rawTerm);
    const term = termSchema.safeParse(rawTerm);
    if (!term.success) {
      errors.push({ line, message: `"${rawTerm.slice(0, 40)}": ${term.error.issues[0].message}` });
      continue;
    }
    const variants = variantsSchema.safeParse(rawVariants);
    if (!variants.success) {
      errors.push({ line, message: `"${term.data}": ${variants.error.issues[0].message}` });
      continue;
    }
    const cleaned = cleanVariants(term.data, variants.data);
    if (cleaned.length === 0) {
      errors.push({ line, message: `"${term.data}": add at least one variant that differs from the term.` });
      continue;
    }
    entries.push({ term: term.data, variants: cleaned });
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, entries };
}

export type SynonymImportResult =
  | { ok: true; imported: number; created: number; updated: number }
  | { ok: false; errors: LineError[] };

/** Terms in the file replace the stored variants; terms that are not in the file are left alone. */
export async function importSynonyms(text: string): Promise<SynonymImportResult> {
  const parsed = parseSynonymImport(text);
  if (!parsed.ok) return parsed;
  const db = await getDb();
  const outcome = await db.transaction(async (tx) => {
    const existing = new Set((await tx.select({ term: s.synonyms.term }).from(s.synonyms)).map((row) => row.term));
    const rows = parsed.entries.map((entry) => ({ ...entry, source: 'upload' as const }));
    await tx
      .insert(s.synonyms)
      .values(rows)
      .onConflictDoUpdate({
        target: s.synonyms.term,
        set: { variants: sql`excluded.variants`, source: sql`excluded.source` },
      });
    const updated = parsed.entries.filter((entry) => existing.has(entry.term)).length;
    return { created: parsed.entries.length - updated, updated };
  });
  refreshKnowledgeCache();
  return { ok: true, imported: parsed.entries.length, ...outcome };
}

export async function exportSynonyms(): Promise<Record<string, string[]>> {
  const rows = await listSynonyms();
  return Object.fromEntries(rows.map((row) => [row.term, row.variants]));
}

// ---------------------------------------------------------------------------
// Knowledge gaps
// ---------------------------------------------------------------------------

export type GapStatus = 'open' | 'answered' | 'dismissed';
export type GapSort = 'asked' | 'recent';

export async function listGaps(options: { status?: GapStatus; sort?: GapSort } = {}): Promise<GapRow[]> {
  const db = await getDb();
  const order =
    options.sort === 'recent'
      ? [desc(s.knowledgeGaps.lastAskedAt)]
      : [desc(s.knowledgeGaps.timesAsked), desc(s.knowledgeGaps.lastAskedAt)];
  return db
    .select()
    .from(s.knowledgeGaps)
    .where(eq(s.knowledgeGaps.status, options.status ?? 'open'))
    .orderBy(...order)
    .limit(200);
}

export async function countOpenGaps(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(s.knowledgeGaps)
    .where(eq(s.knowledgeGaps.status, 'open'));
  return row.count;
}

export type GapAnswerResult = { ok: true; faqId: number } | FaqFailure;

/** Keeps the visitor's own wording as an alternative when the admin reworded the question. */
function alternativesWithOriginal(alternatives: string[], question: string, original: string): string[] {
  const own = questionKey(question);
  const seen = new Set([own]);
  const result: string[] = [];
  for (const phrase of [original, ...alternatives]) {
    const key = questionKey(phrase);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(phrase.trim());
  }
  return result;
}

/** Turns an open gap into an instant FAQ (source 'gap') and marks the gap answered, in one transaction. */
export async function answerGap(gapId: number, raw: unknown): Promise<GapAnswerResult> {
  const parsed = faqSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Please check the highlighted fields.', fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const db = await getDb();
  const input = parsed.data;
  const result = await db.transaction(async (tx): Promise<GapAnswerResult> => {
    const [gap] = await tx.select().from(s.knowledgeGaps).where(eq(s.knowledgeGaps.id, gapId)).limit(1);
    if (!gap) return { ok: false, error: 'That question is no longer in the queue.', fieldErrors: {} };
    if (gap.status !== 'open') return { ok: false, error: 'That question has already been handled.', fieldErrors: {} };
    const duplicate = await findDuplicateFaq(tx, input.question);
    if (duplicate !== null) return duplicateFaq(duplicate);
    const [faq] = await tx
      .insert(s.faqs)
      .values({
        question: input.question,
        alternatives: alternativesWithOriginal(input.alternatives, input.question, gap.question),
        answer: input.answer,
        tags: input.tags,
        enabled: input.enabled,
        source: 'gap',
      })
      .returning({ id: s.faqs.id });
    await tx
      .update(s.knowledgeGaps)
      .set({ status: 'answered', resolvedFaqId: faq.id })
      .where(eq(s.knowledgeGaps.id, gap.id));
    return { ok: true, faqId: faq.id };
  });
  if (result.ok) refreshKnowledgeCache();
  return result;
}

export async function dismissGap(gapId: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(s.knowledgeGaps)
    .set({ status: 'dismissed' })
    .where(and(eq(s.knowledgeGaps.id, gapId), ne(s.knowledgeGaps.status, 'answered')))
    .returning({ id: s.knowledgeGaps.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Golden test: the last stored run and the comparison with the one before it
// ---------------------------------------------------------------------------

const evalSummarySchema = z.object({
  at: z.string(),
  total: z.number(),
  hitAt3: z.number(),
  intentAccuracy: z.number(),
  answeredWithoutModel: z.number(),
});

const storedEvalSchema = evalSummarySchema.extend({
  failures: z.array(z.object({ id: z.string(), question: z.string(), reason: z.string() })).default([]),
  previous: evalSummarySchema.nullable().default(null),
});

export type EvalSummary = z.infer<typeof evalSummarySchema>;
export type StoredEval = z.infer<typeof storedEvalSchema>;

export type EvalView = {
  at: string;
  atLabel: string;
  total: number;
  hitAt3: number;
  intentAccuracy: number;
  answeredWithoutModel: number;
  failures: GoldenFailure[];
  previousAtLabel: string | null;
  previousHitAt3: number | null;
  /** Did relevance (hit@3) go up or down compared with the run before this one? */
  direction: 'up' | 'down' | 'same' | 'first';
  changePoints: number | null;
};

export function compareEval(current: number, previous: number | null): Pick<EvalView, 'direction' | 'changePoints'> {
  if (previous === null) return { direction: 'first', changePoints: null };
  const changePoints = Math.round((current - previous) * 1000) / 10;
  if (changePoints === 0) return { direction: 'same', changePoints };
  return { direction: changePoints > 0 ? 'up' : 'down', changePoints };
}

export function toEvalView(stored: StoredEval): EvalView {
  return {
    at: stored.at,
    atLabel: formatWhen(stored.at),
    total: stored.total,
    hitAt3: stored.hitAt3,
    intentAccuracy: stored.intentAccuracy,
    answeredWithoutModel: stored.answeredWithoutModel,
    failures: stored.failures,
    previousAtLabel: stored.previous ? formatWhen(stored.previous.at) : null,
    previousHitAt3: stored.previous?.hitAt3 ?? null,
    ...compareEval(stored.hitAt3, stored.previous?.hitAt3 ?? null),
  };
}

export async function readLastEval(): Promise<StoredEval | null> {
  const db = await getDb();
  const [row] = await db
    .select({ value: s.settings.value })
    .from(s.settings)
    .where(eq(s.settings.key, EVAL_KEY))
    .limit(1);
  if (!row) return null;
  const parsed = storedEvalSchema.safeParse(row.value);
  return parsed.success ? parsed.data : null;
}

/** Runs the golden set (retrieval only, no model calls) and stores it as `chat_eval_last` next to the previous run. */
export async function runAndStoreEval(): Promise<StoredEval> {
  const previous = await readLastEval();
  const result = await runGoldenSet();
  const stored: StoredEval = {
    at: new Date().toISOString(),
    total: result.total,
    hitAt3: result.hitAt3,
    intentAccuracy: result.intentAccuracy,
    answeredWithoutModel: result.answeredWithoutModel,
    failures: result.failures.slice(0, 200),
    previous: previous
      ? {
          at: previous.at,
          total: previous.total,
          hitAt3: previous.hitAt3,
          intentAccuracy: previous.intentAccuracy,
          answeredWithoutModel: previous.answeredWithoutModel,
        }
      : null,
  };
  const db = await getDb();
  await db
    .insert(s.settings)
    .values({ key: EVAL_KEY, value: stored })
    .onConflictDoUpdate({ target: s.settings.key, set: { value: stored, updatedAt: new Date() } });
  return stored;
}
