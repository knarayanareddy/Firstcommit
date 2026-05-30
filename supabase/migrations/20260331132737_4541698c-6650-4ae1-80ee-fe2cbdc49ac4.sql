CREATE OR REPLACE FUNCTION public.hybrid_search_v2_impl(
  p_org_id uuid,
  p_pack_id uuid,
  p_query_text text,
  p_query_embedding extensions.vector DEFAULT NULL,
  p_match_count integer DEFAULT 10,
  p_match_threshold double precision DEFAULT NULL,
  p_module_key text DEFAULT NULL,
  p_track_key text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  chunk_id text,
  path text,
  content text,
  line_start integer,
  line_end integer,
  source_id uuid,
  entity_type text,
  entity_name text,
  signature text,
  score double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_count integer := GREATEST(1, LEAST(COALESCE(p_match_count, 10), 50));
  fts_query text := replace(p_query_text, '_', ' ');
BEGIN
  IF p_query_embedding IS NULL THEN
    RETURN QUERY
    SELECT
      kc.id,
      kc.chunk_id,
      kc.path,
      kc.content,
      kc.start_line,
      kc.end_line,
      kc.source_id,
      (kc.metadata->>'entity_type')::text AS entity_type,
      (kc.metadata->>'entity_name')::text AS entity_name,
      (kc.metadata->>'signature')::text AS signature,
      ts_rank(kc.fts, plainto_tsquery('english', fts_query))::double precision AS score
    FROM public.knowledge_chunks kc
    WHERE kc.pack_id = p_pack_id
      AND kc.is_redacted = false
      AND kc.fts @@ plainto_tsquery('english', fts_query)
      AND (p_module_key IS NULL OR COALESCE(kc.metadata->>'module_key', '') = p_module_key)
      AND (p_track_key IS NULL OR COALESCE(kc.metadata->>'track_key', '') = p_track_key)
      AND (p_match_threshold IS NULL OR ts_rank(kc.fts, plainto_tsquery('english', fts_query))::double precision >= p_match_threshold)
    ORDER BY ts_rank(kc.fts, plainto_tsquery('english', fts_query)) DESC, kc.created_at DESC
    LIMIT safe_count;
    RETURN;
  END IF;

  RETURN QUERY
  WITH vector_results AS (
    SELECT
      kc.id,
      kc.chunk_id,
      kc.path,
      kc.content,
      kc.start_line,
      kc.end_line,
      kc.source_id,
      (kc.metadata->>'entity_type')::text AS entity_type,
      (kc.metadata->>'entity_name')::text AS entity_name,
      (kc.metadata->>'signature')::text AS signature,
      1 - (kc.embedding OPERATOR(extensions.<=>) p_query_embedding) AS sim,
      ROW_NUMBER() OVER (ORDER BY kc.embedding OPERATOR(extensions.<=>) p_query_embedding) AS vec_rank
    FROM public.knowledge_chunks kc
    WHERE kc.pack_id = p_pack_id
      AND kc.is_redacted = false
      AND kc.embedding IS NOT NULL
      AND (p_module_key IS NULL OR COALESCE(kc.metadata->>'module_key', '') = p_module_key)
      AND (p_track_key IS NULL OR COALESCE(kc.metadata->>'track_key', '') = p_track_key)
    ORDER BY kc.embedding OPERATOR(extensions.<=>) p_query_embedding
    LIMIT safe_count * 3
  ),
  fts_results AS (
    SELECT
      kc.id,
      kc.chunk_id,
      kc.path,
      kc.content,
      kc.start_line,
      kc.end_line,
      kc.source_id,
      (kc.metadata->>'entity_type')::text AS entity_type,
      (kc.metadata->>'entity_name')::text AS entity_name,
      (kc.metadata->>'signature')::text AS signature,
      ts_rank(kc.fts, plainto_tsquery('english', fts_query)) AS rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank(kc.fts, plainto_tsquery('english', fts_query)) DESC) AS fts_rank
    FROM public.knowledge_chunks kc
    WHERE kc.pack_id = p_pack_id
      AND kc.is_redacted = false
      AND kc.fts @@ plainto_tsquery('english', fts_query)
      AND (p_module_key IS NULL OR COALESCE(kc.metadata->>'module_key', '') = p_module_key)
      AND (p_track_key IS NULL OR COALESCE(kc.metadata->>'track_key', '') = p_track_key)
    ORDER BY ts_rank(kc.fts, plainto_tsquery('english', fts_query)) DESC
    LIMIT safe_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.id, f.id) AS id,
      COALESCE(v.chunk_id, f.chunk_id) AS chunk_id,
      COALESCE(v.path, f.path) AS path,
      COALESCE(v.content, f.content) AS content,
      COALESCE(v.start_line, f.start_line) AS line_start,
      COALESCE(v.end_line, f.end_line) AS line_end,
      COALESCE(v.source_id, f.source_id) AS source_id,
      COALESCE(v.entity_type, f.entity_type) AS entity_type,
      COALESCE(v.entity_name, f.entity_name) AS entity_name,
      COALESCE(v.signature, f.signature) AS signature,
      COALESCE((1.0 / (60 + v.vec_rank)), 0) + COALESCE((1.0 / (60 + f.fts_rank)), 0) AS score
    FROM vector_results v
    FULL OUTER JOIN fts_results f ON v.chunk_id = f.chunk_id
  )
  SELECT
    c.id,
    c.chunk_id,
    c.path,
    c.content,
    c.line_start,
    c.line_end,
    c.source_id,
    c.entity_type,
    c.entity_name,
    c.signature,
    c.score
  FROM combined c
  WHERE p_match_threshold IS NULL OR c.score >= p_match_threshold
  ORDER BY c.score DESC
  LIMIT safe_count;
END;
$$;