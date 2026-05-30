
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Add embedding column to knowledge_chunks
ALTER TABLE public.knowledge_chunks
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create HNSW index for fast ANN search
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
ON public.knowledge_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create module_remediations table
CREATE TABLE IF NOT EXISTS public.module_remediations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  section_id text NOT NULL,
  original_content text NOT NULL,
  proposed_content text NOT NULL,
  diff_summary text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.module_remediations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read remediations" ON public.module_remediations;
CREATE POLICY "Authenticated users can read remediations"
  ON public.module_remediations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can insert remediations" ON public.module_remediations;
CREATE POLICY "Service role can insert remediations"
  ON public.module_remediations FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update remediations" ON public.module_remediations;
CREATE POLICY "Authenticated users can update remediations"
  ON public.module_remediations FOR UPDATE
  TO authenticated
  USING (true);

-- Create the hybrid search RPC function
CREATE OR REPLACE FUNCTION public.match_chunks_hybrid(
  query_embedding vector(1536),
  query_text text,
  match_count int DEFAULT 10,
  target_pack_id uuid DEFAULT NULL,
  path_filter text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id text,
  path text,
  content text,
  start_line int,
  end_line int,
  similarity float,
  fts_rank float,
  rrf_score float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  k constant int := 60;
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      kc.chunk_id,
      kc.path,
      kc.content,
      kc.start_line,
      kc.end_line,
      1 - (kc.embedding <=> query_embedding) AS sim,
      ROW_NUMBER() OVER (ORDER BY kc.embedding <=> query_embedding) AS vec_rank
    FROM public.knowledge_chunks kc
    WHERE kc.pack_id = target_pack_id
      AND kc.is_redacted = false
      AND kc.embedding IS NOT NULL
      AND (path_filter IS NULL OR kc.path ILIKE path_filter)
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  fts_results AS (
    SELECT
      kc.chunk_id,
      kc.path,
      kc.content,
      kc.start_line,
      kc.end_line,
      ts_rank(kc.fts, websearch_to_tsquery('english', query_text)) AS rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank(kc.fts, websearch_to_tsquery('english', query_text)) DESC) AS fts_r
    FROM public.knowledge_chunks kc
    WHERE kc.pack_id = target_pack_id
      AND kc.is_redacted = false
      AND kc.fts @@ websearch_to_tsquery('english', query_text)
      AND (path_filter IS NULL OR kc.path ILIKE path_filter)
    ORDER BY rank DESC
    LIMIT match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.chunk_id, f.chunk_id) AS chunk_id,
      COALESCE(v.path, f.path) AS path,
      COALESCE(v.content, f.content) AS content,
      COALESCE(v.start_line, f.start_line) AS start_line,
      COALESCE(v.end_line, f.end_line) AS end_line,
      COALESCE(v.sim, 0) AS similarity,
      COALESCE(f.rank, 0) AS fts_rank,
      (1.0 / (k + COALESCE(v.vec_rank, match_count * 3 + 1))) +
      (1.0 / (k + COALESCE(f.fts_r, match_count * 3 + 1))) AS rrf_score
    FROM vector_results v
    FULL OUTER JOIN fts_results f ON v.chunk_id = f.chunk_id
  )
  SELECT
    combined.chunk_id,
    combined.path,
    combined.content,
    combined.start_line,
    combined.end_line,
    combined.similarity,
    combined.fts_rank,
    combined.rrf_score
  FROM combined
  ORDER BY combined.rrf_score DESC
  LIMIT match_count;
END;
$$;
