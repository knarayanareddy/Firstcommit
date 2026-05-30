-- Migration: Add chunk_id to return tables of core search RPCs
-- This ensures the UI receives stable identifiers (e.g. C00001) directly from SQL.

-- 1. Update hybrid_search_v2
DROP FUNCTION IF EXISTS public.hybrid_search_v2(uuid, uuid, text, vector, float, int, int, text, text);
CREATE OR REPLACE FUNCTION public.hybrid_search_v2(
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
  chunk_id TEXT, -- Added stable chunk_id
  path TEXT,
  content TEXT,
  entity_type TEXT,
  entity_name TEXT,
  signature TEXT,
  line_start INT,
  line_end INT,
  score FLOAT,
  source_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generation_id UUID;
  v_match_count INT;
BEGIN
  -- 0. DEFENSE IN DEPTH: Verify membership redundantly at SQL level
  IF auth.role() = 'service_role' THEN
    -- Allow service role
  ELSIF NOT EXISTS (
    SELECT 1 FROM pack_members 
    WHERE pack_id = p_pack_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: User is not a member of this pack.';
  END IF;

  v_match_count := LEAST(COALESCE(p_match_count, 15), 50);

  -- 1. Identify Active Generation
  SELECT active_generation_id INTO v_generation_id
  FROM pack_active_generation
  WHERE org_id = p_org_id AND pack_id = p_pack_id;

  IF v_generation_id IS NULL THEN
    v_generation_id := (SELECT generation_id FROM knowledge_chunks WHERE org_id = p_org_id AND pack_id = p_pack_id ORDER BY created_at DESC LIMIT 1);
  END IF;

  RETURN QUERY
  WITH vector_matches AS (
    SELECT 
      kc.id,
      ROW_NUMBER() OVER (ORDER BY kc.embedding <=> p_query_embedding) as rank
    FROM knowledge_chunks kc
    WHERE p_query_embedding IS NOT NULL
      AND kc.org_id = p_org_id 
      AND kc.pack_id = p_pack_id 
      AND kc.is_redacted = false
      AND (v_generation_id IS NULL OR kc.generation_id = v_generation_id)
      AND (p_module_key IS NULL OR kc.module_key = p_module_key)
      AND (p_track_key IS NULL OR kc.track_key = p_track_key)
      AND 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
    LIMIT v_match_count * 2
  ),
  fts_matches AS (
    SELECT 
      kc.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(kc.fts, websearch_to_tsquery('simple', p_query_text)) DESC) as rank
    FROM knowledge_chunks kc
    WHERE kc.org_id = p_org_id 
      AND kc.pack_id = p_pack_id 
      AND kc.is_redacted = false
      AND (v_generation_id IS NULL OR kc.generation_id = v_generation_id)
      AND (p_module_key IS NULL OR kc.module_key = p_module_key)
      AND (p_track_key IS NULL OR kc.track_key = p_track_key)
      AND fts @@ websearch_to_tsquery('simple', p_query_text)
    LIMIT v_match_count * 2
  ),
  rrf_combined AS (
    SELECT 
      COALESCE(v.id, f.id) as id,
      (COALESCE(1.0 / (p_rrf_k + v.rank), 0.0) + COALESCE(1.0 / (p_rrf_k + f.rank), 0.0)) as rrf_score
    FROM vector_matches v
    FULL OUTER JOIN fts_matches f ON v.id = f.id
    ORDER BY rrf_score DESC
    LIMIT v_match_count
  ),
  base_chunks AS (
    SELECT 
      kc.id, kc.chunk_id, kc.path, kc.content, kc.entity_type, kc.entity_name, kc.signature, 
      kc.line_start, kc.line_end, kc.imports, r.rrf_score, kc.source_id
    FROM rrf_combined r
    JOIN knowledge_chunks kc ON r.id = kc.id
  ),
  graph_expansion AS (
    SELECT 
      kc.id, kc.chunk_id, kc.path, kc.content, kc.entity_type, kc.entity_name, kc.signature,
      kc.line_start, kc.line_end, kc.imports, (bc.rrf_score * 0.5) as rrf_score, kc.source_id
    FROM base_chunks bc
    JOIN knowledge_chunks kc ON kc.org_id = p_org_id AND kc.pack_id = p_pack_id AND kc.generation_id = v_generation_id
    WHERE kc.exported_names && bc.imports
      AND kc.id NOT IN (SELECT bc2.id FROM base_chunks bc2)
      AND kc.is_redacted = false
    LIMIT 5
  )
  SELECT 
    b.id, b.chunk_id, b.path, b.content, b.entity_type, b.entity_name, b.signature, b.line_start, b.line_end, b.rrf_score AS score, b.source_id
  FROM base_chunks b
  UNION ALL
  SELECT 
    g.id, g.chunk_id, g.path, g.content, g.entity_type, g.entity_name, g.signature, g.line_start, g.line_end, g.rrf_score AS score, g.source_id
  FROM graph_expansion g
  ORDER BY score DESC;
END;
$$;

-- 2. Update definition_search_v1
DROP FUNCTION IF EXISTS public.definition_search_v1(uuid, uuid, text[], int, text, text);
CREATE OR REPLACE FUNCTION public.definition_search_v1(
  p_org_id UUID,
  p_pack_id UUID,
  p_symbols TEXT[],
  p_match_count INT DEFAULT 20,
  p_module_key TEXT DEFAULT NULL,
  p_track_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  chunk_id TEXT, -- Added stable chunk_id
  path TEXT,
  content TEXT,
  entity_type TEXT,
  entity_name TEXT,
  signature TEXT,
  line_start INT,
  line_end INT,
  score FLOAT,
  source_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generation_id UUID;
  v_match_count INT;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: definition_search_v1 is restricted to service_role.';
  END IF;

  v_match_count := LEAST(COALESCE(p_match_count, 20), 50);

  SELECT active_generation_id INTO v_generation_id
  FROM pack_active_generation
  WHERE org_id = p_org_id AND pack_id = p_pack_id;

  IF v_generation_id IS NULL THEN
    v_generation_id := (
      SELECT generation_id 
      FROM knowledge_chunks 
      WHERE org_id = p_org_id AND pack_id = p_pack_id 
      ORDER BY created_at DESC 
      LIMIT 1
    );
  END IF;

  RETURN QUERY
  SELECT 
    kc.id,
    kc.chunk_id,
    kc.path,
    kc.content,
    kc.entity_type,
    kc.entity_name,
    kc.signature,
    kc.line_start,
    kc.line_end,
    CASE 
      WHEN kc.entity_name = ANY(p_symbols) THEN 1.0
      WHEN kc.exported_names && p_symbols THEN 0.8
      ELSE 0.5
    END as score,
    kc.source_id
  FROM knowledge_chunks kc
  WHERE kc.org_id = p_org_id
    AND kc.pack_id = p_pack_id
    AND kc.is_redacted = false
    AND (v_generation_id IS NULL OR kc.generation_id = v_generation_id)
    AND (p_module_key IS NULL OR kc.module_key = p_module_key)
    AND (p_track_key IS NULL OR kc.track_key = p_track_key)
    AND (
      kc.entity_name = ANY(p_symbols)
      OR kc.exported_names && p_symbols
    )
  ORDER BY score DESC, kc.created_at DESC
  LIMIT v_match_count;
END;
$$;

-- 3. Grants
-- Use explicit signatures or a loop to avoid ambiguity if overloads exist.
GRANT EXECUTE ON FUNCTION public.hybrid_search_v2(UUID, UUID, TEXT, VECTOR(1536), FLOAT, INT, INT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.definition_search_v1(UUID, UUID, TEXT[], INT, TEXT, TEXT) TO service_role;

-- 4. Verification Script (Run this in Supabase SQL Editor)
/*
DO $$
DECLARE
  v_org_id UUID := '00000000-0000-0000-0000-000000000000'; -- Replace with real ID
  v_pack_id UUID := '00000000-0000-0000-0000-000000000000'; -- Replace with real ID
BEGIN
  -- Test hybrid_search_v2
  RAISE NOTICE 'Testing hybrid_search_v2...';
  PERFORM * FROM public.hybrid_search_v2(v_org_id, v_pack_id, 'test', NULL) LIMIT 1;
  
  -- Test definition_search_v1
  RAISE NOTICE 'Testing definition_search_v1...';
  PERFORM * FROM public.definition_search_v1(v_org_id, v_pack_id, ARRAY['test']) LIMIT 1;
  
  RAISE NOTICE 'Verification successful: Columns chunk_id and source_id are present.';
END $$;
*/
