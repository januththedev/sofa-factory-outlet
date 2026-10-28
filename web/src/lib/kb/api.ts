export type KbHit = {
  chunkId: number;
  documentId: number;
  documentTitle: string;
  headingPath: string;
  body: string;
  tags: string[];
  score: number;
};

/**
 * Hybrid retrieval: weighted full-text plus pgvector similarity merged by reciprocal rank fusion.
 * Only enabled documents are returned.
 */
export { searchKnowledge } from './index';

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

/** Validate, version, chunk into roughly 350 tokens with overlap, and index. */
export { ingestDocument } from './index';

/** Rebuild chunks and embeddings for every current stored document. */
export { reindexAll } from './index';

/**
 * Month-3 switch: probe the embedding model's dimension, create the vector column and HNSW index,
 * store `settings.chat.embeddings`. Returns `{ ok: false, error }` (never throws) when the vector
 * extension is unavailable, as on local PGlite, or no OpenRouter key is set.
 */
export { enableEmbeddings } from './index';
