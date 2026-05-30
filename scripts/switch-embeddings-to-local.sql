-- MANUAL RUNBOOK — do NOT place in supabase/migrations (would break 1536 deployments).
-- Switch to local embeddings. Local models are not 1536-dim, so this RESIZES the
-- vector column and requires RE-EMBEDDING all chunks. Run intentionally.
-- Example: nomic-embed-text (768 dims). Change 768 to your model's dimension.

BEGIN;
  -- 1. Drop the dim-specific vector index.
  DROP INDEX IF EXISTS idx_knowledge_chunks_embedding_hnsw;
  DROP INDEX IF EXISTS idx_chunks_embedding;
  -- 2. Clear old embeddings and resize the column.
  UPDATE public.knowledge_chunks SET embedding = NULL;
  ALTER TABLE public.knowledge_chunks ALTER COLUMN embedding TYPE vector(768);
  -- 3. Recreate the HNSW index at the new dimension.
  CREATE INDEX idx_knowledge_chunks_embedding_hnsw
    ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);
COMMIT;

-- 4. Set env: EMBEDDING_PROVIDER=local, EMBEDDING_MODEL=nomic-embed-text, EMBEDDING_DIM=768
--    (pull it first: `ollama pull nomic-embed-text`)
-- 5. Trigger a full reindex (reindex-orgs) to regenerate all embeddings locally.
