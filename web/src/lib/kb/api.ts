import { notImplemented } from '../not-implemented';

// CONTRACT STUB. Owner: "kb-core" agent. Keep these exports and signatures.

export type KbHit = {
  chunkId: number;
  documentId: number;
  documentTitle: string;
  headingPath: string;
  body: string;
  tags: string[];
  score: number;
};

/** Hybrid retrieval: full-text (headings weighted above body), plus pgvector similarity merged by reciprocal rank fusion once embeddings are on. Only enabled documents. */
export const searchKnowledge: (query: string, options?: { tags?: string[]; limit?: number }) => Promise<KbHit[]> = async () => notImplemented('searchKnowledge');

export type IngestInput = {
  slug: string;
  title?: string;
  kind: 'md' | 'json';
  /** raw file text (Markdown with front matter, or the FAQ/synonym JSON) */
  text: string;
  source: 'starter' | 'upload';
};

export type IngestResult =
  | { ok: true; documentId: number; version: number; chunks: number; faqs: number; synonyms: number }
  | { ok: false; errors: Array<{ line?: number; message: string }> };

/** Validate (front matter / JSON schema, line-by-line errors), version the old copy, chunk (## sections, ~350 tokens, 50 overlap), index. */
export const ingestDocument: (input: IngestInput) => Promise<IngestResult> = async () => notImplemented('ingestDocument');

/** Rebuild chunks and embeddings for every enabled document (the month-3 "turn on embeddings" step). */
export const reindexAll: () => Promise<{ documents: number; chunks: number }> = async () => notImplemented('reindexAll');
