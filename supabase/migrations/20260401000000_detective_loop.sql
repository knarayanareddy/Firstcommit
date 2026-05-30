-- Phase 7: Detective Reasoning Loop (Multi-hop RAG)
-- This migration adds the required indexes and RPC for definition-following retrieval.

-- 1. Ensure GIN indexes exist for symbol lookups
-- (Redundant if already present, but SAFE for migration)
CREATE INDEX IF NOT EXISTS idx_chunks_exports_gin_detective ON public.knowledge_chunks USING GIN(exported_names);
CREATE INDEX IF NOT EXISTS idx_chunks_imports_gin_detective ON public.knowledge_chunks USING GIN(imports);
CREATE INDEX IF NOT EXISTS idx_chunks_entity_name_detective ON public.knowledge_chunks(entity_name) WHERE entity_name IS NOT NULL;

-- 2. Add Definition Search RPC
-- Primarily used by Hop 1 of the detective loop to resolve definitions for extracted symbols.
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
SET search_path = public
AS $$
DECLARE
  v_generation_id UUID;
  v_match_count INT;
BEGIN
  -- 0. Authorization: restricted to service_role (Edge Functions)
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: definition_search_v1 is restricted to service_role.';
  END IF;

  v_match_count := LEAST(COALESCE(p_match_count, 20), 50);

  -- 1. Resolve Active Generation
  SELECT active_generation_id INTO v_generation_id
  FROM pack_active_generation
  WHERE org_id = p_org_id AND pack_id = p_pack_id;

  -- Fallback to latest if no ledger entry
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
    END as score
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

-- 3. Security: Revoke PUBLIC access immediately
REVOKE EXECUTE ON FUNCTION public.definition_search_v1(UUID, UUID, TEXT[], INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definition_search_v1(UUID, UUID, TEXT[], INT, TEXT, TEXT) TO service_role;

-- 4. Extend rag_metrics for Observability
ALTER TABLE public.rag_metrics 
  ADD COLUMN IF NOT EXISTS detective_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS retrieval_hops INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS symbols_extracted INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expanded_chunks_added INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS detective_time_ms INT DEFAULT 0;

COMMENT ON COLUMN public.rag_metrics.detective_enabled IS 'Whether multi-hop retrieval was used for this task';
COMMENT ON COLUMN public.rag_metrics.retrieval_hops IS 'Number of reasoning hops completed (0 = standard RAG)';
COMMENT ON COLUMN public.rag_metrics.symbols_extracted IS 'Total number of technical symbols identified in Hop 0 evidence';
COMMENT ON COLUMN public.rag_metrics.expanded_chunks_added IS 'Number of definition chunks successfully merged into the final evidence set';
COMMENT ON COLUMN public.rag_metrics.detective_time_ms IS 'Latency specifically attributed to the detective loop logic';
