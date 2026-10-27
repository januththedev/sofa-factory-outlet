-- Trigram matching for fuzzy product-name and FAQ search. Must exist before
-- the gin_trgm_ops indexes in the next migration. pgvector is enabled later by
-- the "turn on embeddings" admin action, once an embedding model is chosen.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
