-- Hardening hybrid_search_v2: Fixes alias bugs, adds redaction filters, and supports context filtering
CREATE OR REPLACE FUNCTION hybrid_search_v2(
  p_org_id UUID,
  p_pack_id UUID,
  p_query_text TEXT,
  p_query_embedding VECTOR(1536),
  p_match_threshold FLOAT DEFAULT 0.5,
  p_match_count INT DEFAULT 15,
  p_rrf_k INT DEFAULT 60,
  p_module_key TEXT DEFAULT NULL,
  p_track_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  path TEXT,
  content TEXT,
  entity_type TEXT,
  entity_name TEXT,
  signature TEXT,
  line_start INT,
  line_end INT,
  score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_generation_id UUID;
BEGIN
  -- 1. Identify Active Generation
  SELECT active_generation_id INTO v_generation_id
  FROM pack_active_generation
  WHERE org_id = p_org_id AND pack_id = p_pack_id;

  -- Fallback if no ledger exists (graceful degradation)
  IF v_generation_id IS NULL THEN
    v_generation_id := (SELECT generation_id FROM knowledge_chunks WHERE org_id = p_org_id AND pack_id = p_pack_id ORDER BY created_at DESC LIMIT 1);
  END IF;

  RETURN QUERY
  WITH vector_matches AS (
    SELECT 
      kc.id,
      ROW_NUMBER() OVER (ORDER BY kc.embedding <=> p_query_embedding) as rank
    FROM knowledge_chunks kc
    WHERE kc.org_id = p_org_id 
      AND kc.pack_id = p_pack_id 
      AND kc.is_redacted = false -- SECURITY: Filter redacted chunks
      AND (v_generation_id IS NULL OR kc.generation_id = v_generation_id)
      -- OPTIONAL: Context filtering
      AND (p_module_key IS NULL OR kc.module_key = p_module_key)
      AND (p_track_key IS NULL OR kc.track_key = p_track_key)
      AND (p_query_embedding IS NULL OR (1 - (kc.embedding <=> p_query_embedding) > p_match_threshold))
    LIMIT p_match_count * 2
  ),
  fts_matches AS (
    SELECT 
      kc.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(kc.fts, to_tsquery('simple', p_query_text)) DESC) as rank
    FROM knowledge_chunks kc
    WHERE kc.org_id = p_org_id 
      AND kc.pack_id = p_pack_id 
      AND kc.is_redacted = false -- SECURITY: Filter redacted chunks
      AND (v_generation_id IS NULL OR kc.generation_id = v_generation_id)
      -- OPTIONAL: Context filtering
      AND (p_module_key IS NULL OR kc.module_key = p_module_key)
      AND (p_track_key IS NULL OR kc.track_key = p_track_key)
      AND kc.fts @@ to_tsquery('simple', p_query_text)
    LIMIT p_match_count * 2
  ),
  rrf_combined AS (
    SELECT 
      COALESCE(v.id, f.id) as id,
      (COALESCE(1.0 / (p_rrf_k + v.rank), 0.0) + COALESCE(1.0 / (p_rrf_k + f.rank), 0.0)) as rrf_score
    FROM vector_matches v
    FULL OUTER JOIN fts_matches f ON v.id = f.id
    ORDER BY rrf_score DESC
    LIMIT p_match_count
  ),
  base_chunks AS (
    SELECT 
      kc.id, kc.path, kc.content, kc.entity_type, kc.entity_name, kc.signature, 
      kc.line_start, kc.line_end, kc.imports, r.rrf_score
    FROM rrf_combined r
    JOIN knowledge_chunks kc ON r.id = kc.id
  ),
  graph_expansion AS (
    -- Simple 1-step expansion: find chunks that export names that base_chunks import
    SELECT 
      kc.id, kc.path, kc.content, kc.entity_type, kc.entity_name, kc.signature,
      kc.line_start, kc.line_end, kc.imports, (bc.rrf_score * 0.5) as rrf_score
    FROM base_chunks bc
    JOIN knowledge_chunks kc ON kc.org_id = p_org_id AND kc.pack_id = p_pack_id AND kc.generation_id = v_generation_id
    WHERE kc.exported_names && bc.imports
      AND kc.id NOT IN (SELECT bc2.id FROM base_chunks bc2)
      AND kc.is_redacted = false -- SECURITY: Filter redacted chunks
    LIMIT 5
  )
  SELECT 
    b.id, b.path, b.content, b.entity_type, b.entity_name, b.signature, b.line_start, b.line_end, b.rrf_score AS score
  FROM base_chunks b
  UNION ALL
  SELECT 
    g.id, g.path, g.content, g.entity_type, g.entity_name, g.signature, g.line_start, g.line_end, g.rrf_score AS score
  FROM graph_expansion g
  ORDER BY score DESC; -- FIX: Explicit alias 'score' now exists
END;
$$;
