import { createHash } from 'node:crypto';
import { and, arrayOverlaps, desc, eq, sql } from 'drizzle-orm';
import type { Db, DbOrTx } from '@/lib/db';
import { dbMode, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { env } from '@/lib/env';
import { revalidateTags } from '@/lib/revalidate';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';
import { storage } from '@/lib/storage';
import type { IngestInput, IngestResult, KbHit } from './api';
import { chunkDocument } from './chunk';
import { embedTexts } from './embeddings';
import { parseDocument, type ParsedDocument } from './parse';
import { reciprocalRankFusion } from './rank';

type EmbeddingSettings = {
  enabled: boolean;
  model: string | null;
  dim: number | null;
};

type SearchRow = Omit<KbHit, 'score'> & {
  score: number | string;
};

function checksum(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function normaliseQuestion(question: string): string {
  return question.trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
}

async function embeddingsSettings(db: DbOrTx): Promise<EmbeddingSettings> {
  const [row] = await db.select({ value: s.settings.value })
    .from(s.settings)
    .where(eq(s.settings.key, 'chat'))
    .limit(1);
  if (!row || typeof row.value !== 'object' || row.value === null || Array.isArray(row.value)) {
    return DEFAULT_SETTINGS.chat.embeddings;
  }
  const chat = row.value as Record<string, unknown>;
  const value = chat.embeddings;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_SETTINGS.chat.embeddings;
  const embedding = value as Record<string, unknown>;
  return {
    enabled: embedding.enabled === true,
    model: typeof embedding.model === 'string' ? embedding.model : null,
    dim: typeof embedding.dim === 'number' ? embedding.dim : null,
  };
}

async function hasEmbeddingColumn(db: DbOrTx): Promise<boolean> {
  const result = await db.execute(sql`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'kb_chunks'
        and column_name = 'embedding'
    ) as present
  `);
  const rows = (result as unknown as { rows?: Array<{ present: boolean }> }).rows ?? [];
  return rows[0]?.present === true;
}

function vectorLiteral(values: number[]): ReturnType<typeof sql.raw> {
  if (values.some((value) => !Number.isFinite(value))) throw new Error('Embedding contains a non-finite value.');
  return sql.raw(`'[${values.join(',')}]'::vector`);
}

async function upsertFaqs(db: DbOrTx, document: Extract<ParsedDocument, { kind: 'faq' }>, documentId: number,
  source: IngestInput['source']): Promise<number> {
  const existing = await db.select().from(s.faqs);
  const byQuestion = new Map(existing.map((faq) => [normaliseQuestion(faq.question), faq]));
  for (const entry of document.entries) {
    const match = byQuestion.get(normaliseQuestion(entry.q));
    if (match) {
      await db.update(s.faqs).set({
        question: entry.q,
        alternatives: entry.alt,
        answer: entry.a,
        tags: entry.tags,
        documentId,
        source,
        updatedAt: new Date(),
      }).where(eq(s.faqs.id, match.id));
    } else {
      const [inserted] = await db.insert(s.faqs).values({
        question: entry.q,
        alternatives: entry.alt,
        answer: entry.a,
        tags: entry.tags,
        documentId,
        source,
      }).returning();
      byQuestion.set(normaliseQuestion(entry.q), inserted);
    }
  }
  return document.entries.length;
}

async function upsertSynonyms(db: DbOrTx, document: Extract<ParsedDocument, { kind: 'synonyms' }>,
  source: IngestInput['source']): Promise<number> {
  for (const [term, variants] of Object.entries(document.entries)) {
    await db.insert(s.synonyms).values({ term, variants, source }).onConflictDoUpdate({
      target: s.synonyms.term,
      set: { variants, source },
    });
  }
  return Object.keys(document.entries).length;
}

export async function ingestDocumentWithDb(db: Db, input: IngestInput): Promise<IngestResult> {
  const parsed = parseDocument(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const document = parsed.document;
  const chunks = chunkDocument(document);
  const digest = checksum(input.text);
  const result = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(s.kbDocuments).where(and(
      eq(s.kbDocuments.slug, input.slug),
      eq(s.kbDocuments.isCurrent, true),
    )).limit(1);
    if (current?.checksum === digest) {
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(s.kbChunks)
        .where(eq(s.kbChunks.documentId, current.id));
      return {
        ok: true as const,
        documentId: current.id,
        version: current.version,
        chunks: count,
        faqs: document.kind === 'faq' ? document.entries.length : 0,
        synonyms: document.kind === 'synonyms' ? Object.keys(document.entries).length : 0,
      };
    }
    const version = (current?.version ?? 0) + 1;
    if (current) {
      await tx.update(s.kbDocuments).set({ isCurrent: false }).where(eq(s.kbDocuments.id, current.id));
    }
    const fileKey = `kb/${input.slug}/v${version}.${input.kind}`;
    let storedKey: string | null = fileKey;
    try {
      await storage().put(fileKey, Buffer.from(input.text), {
        contentType: input.kind === 'md' ? 'text/markdown; charset=utf-8' : 'application/json',
      });
    } catch {
      storedKey = null;
    }
    const tags = document.kind === 'md' ? document.tags : [];
    const priority = document.kind === 'md' ? document.priority : 'normal';
    const [inserted] = await tx.insert(s.kbDocuments).values({
      slug: input.slug,
      title: document.title,
      kind: input.kind,
      fileKey: storedKey,
      version,
      tags,
      priority,
      checksum: digest,
      source: input.source,
    }).returning({ id: s.kbDocuments.id });
    if (chunks.length) {
      await tx.insert(s.kbChunks).values(chunks.map((chunk) => ({
        documentId: inserted.id,
        headingPath: chunk.headingPath,
        body: chunk.body,
        tags: chunk.tags,
        priority: chunk.priority,
        tokens: chunk.tokens,
        sortOrder: chunk.sortOrder,
      })));
      const embeddingSettings = await embeddingsSettings(tx);
      if (embeddingSettings.enabled && embeddingSettings.model && await hasEmbeddingColumn(tx)) {
        const insertedChunks = await tx.select({ id: s.kbChunks.id, body: s.kbChunks.body })
          .from(s.kbChunks)
          .where(eq(s.kbChunks.documentId, inserted.id))
          .orderBy(s.kbChunks.sortOrder);
        for (let offset = 0; offset < insertedChunks.length; offset += 32) {
          const batch = insertedChunks.slice(offset, offset + 32);
          const vectors = await embedTexts(batch.map((chunk) => chunk.body), embeddingSettings.model);
          for (let index = 0; index < batch.length; index += 1) {
            await tx.execute(sql`update kb_chunks set embedding = ${vectorLiteral(vectors[index])}
              where id = ${batch[index].id}`);
          }
        }
      }
    }
    const faqCount = document.kind === 'faq'
      ? await upsertFaqs(tx, document, inserted.id, input.source)
      : 0;
    const synonymCount = document.kind === 'synonyms'
      ? await upsertSynonyms(tx, document, input.source)
      : 0;
    return {
      ok: true as const,
      documentId: inserted.id,
      version,
      chunks: chunks.length,
      faqs: faqCount,
      synonyms: synonymCount,
    };
  });
  try {
    revalidateTags('kb');
  } catch {
    // Database tests run without a Next.js request cache.
  }
  return result;
}

export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  return ingestDocumentWithDb(await getDb(), input);
}

async function fullTextSearch(db: Db, query: string, tags: string[] | undefined, limit: number): Promise<SearchRow[]> {
  const rank = sql<number>`ts_rank(${s.kbChunks.tsv}, websearch_to_tsquery('english', ${query}))
    + case when ${s.kbChunks.priority} = 'high' then 0.000001 else 0 end`;
  const conditions = [
    eq(s.kbDocuments.isCurrent, true),
    eq(s.kbDocuments.enabled, true),
    sql`${s.kbChunks.tsv} @@ websearch_to_tsquery('english', ${query})`,
  ];
  if (tags?.length) conditions.push(arrayOverlaps(s.kbChunks.tags, tags));
  return db.select({
    chunkId: s.kbChunks.id,
    documentId: s.kbDocuments.id,
    documentTitle: s.kbDocuments.title,
    headingPath: s.kbChunks.headingPath,
    body: s.kbChunks.body,
    tags: s.kbChunks.tags,
    score: rank,
  }).from(s.kbChunks).innerJoin(s.kbDocuments, eq(s.kbDocuments.id, s.kbChunks.documentId))
    .where(and(...conditions)).orderBy(desc(rank), s.kbChunks.id).limit(limit);
}

async function vectorSearch(db: Db, embedding: number[], tags: string[] | undefined,
  limit: number): Promise<SearchRow[]> {
  const vector = vectorLiteral(embedding);
  const tagFilter = tags?.length
    ? sql`and c.tags && ${sql.param(tags, s.kbChunks.tags)}`
    : sql``;
  const result = await db.execute(sql`
    select
      c.id as "chunkId",
      d.id as "documentId",
      d.title as "documentTitle",
      c.heading_path as "headingPath",
      c.body,
      c.tags,
      1 - (c.embedding <=> ${vector})
        + case when c.priority = 'high' then 0.000001 else 0 end as score
    from kb_chunks c
    inner join kb_documents d on d.id = c.document_id
    where d.is_current = true
      and d.enabled = true
      and embedding is not null
      ${tagFilter}
    order by embedding <=> ${vector}, case when c.priority = 'high' then 0 else 1 end, c.id
    limit ${limit}
  `);
  return (result as unknown as { rows?: SearchRow[] }).rows ?? [];
}

function toHit(row: SearchRow, score = Number(row.score)): KbHit {
  return { ...row, score };
}

export async function searchKnowledge(
  query: string,
  options: { tags?: string[]; limit?: number } = {},
): Promise<KbHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const limit = Math.max(1, Math.min(options.limit ?? 3, 20));
  const poolSize = Math.max(limit * 4, 12);
  const db = await getDb();
  const textRows = await fullTextSearch(db, trimmed, options.tags, poolSize);
  const embeddingSettings = await embeddingsSettings(db);
  if (!embeddingSettings.enabled || !embeddingSettings.model || !await hasEmbeddingColumn(db)) {
    return textRows.slice(0, limit).map((row) => toHit(row));
  }
  const [embedding] = await embedTexts([trimmed], embeddingSettings.model);
  const vectorRows = await vectorSearch(db, embedding, options.tags, poolSize);
  const fused = reciprocalRankFusion([
    textRows.map((row, index) => ({ id: row.chunkId, rank: index + 1 })),
    vectorRows.map((row, index) => ({ id: row.chunkId, rank: index + 1 })),
  ]);
  const rows = new Map([...textRows, ...vectorRows].map((row) => [row.chunkId, row]));
  return fused.slice(0, limit).flatMap((item) => {
    const row = rows.get(item.id);
    return row ? [toHit(row, item.score)] : [];
  });
}

export async function reindexAll(): Promise<{ documents: number; chunks: number }> {
  const db = await getDb();
  const documents = await db.select().from(s.kbDocuments)
    .where(eq(s.kbDocuments.isCurrent, true));
  const embeddingSettings = await embeddingsSettings(db);
  const embed = embeddingSettings.enabled && embeddingSettings.model && await hasEmbeddingColumn(db);
  let documentCount = 0;
  let chunkCount = 0;
  for (const row of documents) {
    if (!row.fileKey) continue;
    const stored = await storage().get(row.fileKey);
    if (!stored) continue;
    const parsed = parseDocument({ slug: row.slug, title: row.title, kind: row.kind, text: stored.toString('utf8') });
    if (!parsed.ok) continue;
    const chunks = chunkDocument(parsed.document);
    await db.transaction(async (tx) => {
      await tx.delete(s.kbChunks).where(eq(s.kbChunks.documentId, row.id));
      if (chunks.length) {
        await tx.insert(s.kbChunks).values(chunks.map((chunk) => ({ ...chunk, documentId: row.id })));
      }
    });
    if (embed && embeddingSettings.model && chunks.length) {
      const inserted = await db.select({ id: s.kbChunks.id, body: s.kbChunks.body })
        .from(s.kbChunks).where(eq(s.kbChunks.documentId, row.id)).orderBy(s.kbChunks.sortOrder);
      for (let offset = 0; offset < inserted.length; offset += 32) {
        const batch = inserted.slice(offset, offset + 32);
        const vectors = await embedTexts(batch.map((chunk) => chunk.body), embeddingSettings.model);
        for (let index = 0; index < batch.length; index += 1) {
          await db.execute(sql`update kb_chunks set embedding = ${vectorLiteral(vectors[index])}
            where id = ${batch[index].id}`);
        }
      }
    }
    documentCount += 1;
    chunkCount += chunks.length;
  }
  try {
    revalidateTags('kb');
  } catch {
    // Database tests run without a Next.js request cache.
  }
  return { documents: documentCount, chunks: chunkCount };
}

export async function enableEmbeddings(model: string): Promise<
  { ok: true; dim: number } | { ok: false; error: string }
> {
  const resolvedModel = model.trim() || env.OPENROUTER_EMBED_MODEL;
  if (dbMode() === 'pglite') {
    return { ok: false, error: 'Vector embeddings are not available locally. Use Neon to enable them.' };
  }
  if (!env.OPENROUTER_API_KEY) {
    return { ok: false, error: 'OpenRouter is not configured. Set OPENROUTER_API_KEY first.' };
  }
  if (!resolvedModel) return { ok: false, error: 'Choose an embedding model first.' };
  try {
    const [probe] = await embedTexts(['dimension probe'], resolvedModel);
    const dim = probe.length;
    if (!dim) return { ok: false, error: 'The embedding model returned an empty vector.' };
    const db = await getDb();
    await db.execute(sql.raw('create extension if not exists vector'));
    await db.execute(sql.raw(`alter table kb_chunks add column if not exists embedding vector(${dim})`));
    await db.execute(sql.raw(
      'create index if not exists kb_chunks_embedding_hnsw_idx '
      + 'on kb_chunks using hnsw (embedding vector_cosine_ops)',
    ));
    const [chatRow] = await db.select({ value: s.settings.value })
      .from(s.settings)
      .where(eq(s.settings.key, 'chat'))
      .limit(1);
    const chat = typeof chatRow?.value === 'object' && chatRow.value !== null && !Array.isArray(chatRow.value)
      ? chatRow.value as Record<string, unknown>
      : {};
    await db.insert(s.settings).values({
      key: 'chat',
      value: { ...chat, embeddings: { enabled: true, model: resolvedModel, dim } },
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: s.settings.key,
      set: { value: { ...chat, embeddings: { enabled: true, model: resolvedModel, dim } }, updatedAt: new Date() },
    });
    return { ok: true, dim };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    const unavailable = /extension|vector|not available|could not open/i.test(message);
    return {
      ok: false,
      error: unavailable ? `Vector extension is not available: ${message}` : message,
    };
  }
}
