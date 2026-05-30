-- Migration 1: KG Retrieval v2 Expansion
-- Creates GIN index on imports and kg_expand_v1, definition_search_v1, find_references_v1 functions

CREATE INDEX IF NOT EXISTS knowledge_chunks_imports_gin ON public.knowledge_chunks USING gin (imports);

-- kg_expand_v1
CREATE OR REPLACE FUNCTION public.kg_expand_v1(
  p_org_id uuid,
  p_pack_id uuid,
  p_seed_ids uuid[],
  p_symbols text[] DEFAULT NULL,
  p_limit int DEFAULT 15,
  p_max_per_relation int DEFAULT 5
)
RETURNS TABLE (
  id uuid, chunk_id text, source_id uuid, path text, content text,
  entity_type text, entity_name text, signature text,
  line_start int, line_end int, score float,
  relation_type text, relation_symbol text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_generation_id UUID;
  v_all_symbols TEXT[] := COALESCE(p_symbols, '{}');
  v_limit INT;
  v_max_per INT;
BEGIN
  IF auth.role() = 'service_role' THEN NULL;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.pack_members WHERE pack_id = p_pack_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: User is not a member of this pack.';
  END IF;

  v_limit := LEAST(COALESCE(p_limit, 15), 50);
  v_max_per := LEAST(COALESCE(p_max_per_relation, 5), 20);

  SELECT active_generation_id INTO v_generation_id
  FROM public.pack_active_generation
  WHERE org_id = p_org_id AND pack_id = p_pack_id;

  IF v_generation_id IS NULL THEN
    v_generation_id := (
      SELECT kc.generation_id FROM public.knowledge_chunks kc
      WHERE kc.pack_id = p_pack_id ORDER BY kc.created_at DESC LIMIT 1
    );
  END IF;

  WITH seed_metadata AS (
    SELECT exported_names, imports FROM public.knowledge_chunks
    WHERE id = ANY(p_seed_ids) AND pack_id = p_pack_id
      AND (v_generation_id IS NULL OR generation_id = v_generation_id)
  )
  SELECT array_agg(DISTINCT sym) INTO v_all_symbols
  FROM (
    SELECT unnest(v_all_symbols) as sym
    UNION SELECT unnest(exported_names) FROM seed_metadata
    UNION SELECT unnest(imports) FROM seed_metadata
  ) s;

  IF array_length(v_all_symbols, 1) > 50 THEN
    v_all_symbols := v_all_symbols[1:50];
  END IF;

  RETURN QUERY
  WITH expanded_nodes AS (
    (SELECT kc.id, kc.chunk_id, kc.source_id, kc.path, kc.content,
      kc.entity_type, kc.entity_name, kc.signature, kc.start_line, kc.end_line,
      1.0 as base_score, 'definition'::text as r_type, sym as r_sym,
      ROW_NUMBER() OVER(PARTITION BY sym ORDER BY (kc.entity_name = sym) DESC) as rank
    FROM public.knowledge_chunks kc, unnest(v_all_symbols) sym
    WHERE kc.pack_id = p_pack_id
      AND (v_generation_id IS NULL OR kc.generation_id = v_generation_id)
      AND kc.is_redacted = false AND kc.exported_names && ARRAY[sym]
      AND kc.id != ANY(p_seed_ids))
    UNION ALL
    (SELECT kc.id, kc.chunk_id, kc.source_id, kc.path, kc.content,
      kc.entity_type, kc.entity_name, kc.signature, kc.start_line, kc.end_line,
      0.8 as base_score, 'reference'::text as r_type, sym as r_sym,
      ROW_NUMBER() OVER(PARTITION BY sym ORDER BY kc.path) as rank
    FROM public.knowledge_chunks kc, unnest(v_all_symbols) sym
    WHERE kc.pack_id = p_pack_id
      AND (v_generation_id IS NULL OR kc.generation_id = v_generation_id)
      AND kc.is_redacted = false AND kc.imports && ARRAY[sym]
      AND kc.id != ANY(p_seed_ids))
    UNION ALL
    (SELECT kc.id, kc.chunk_id, kc.source_id, kc.path, kc.content,
      kc.entity_type, kc.entity_name, kc.signature, kc.start_line, kc.end_line,
      0.3 as base_score, 'neighbor'::text as r_type, NULL::text as r_sym,
      ROW_NUMBER() OVER(PARTITION BY seed.id ORDER BY ABS(kc.start_line - seed.start_line)) as rank
    FROM public.knowledge_chunks kc
    JOIN public.knowledge_chunks seed ON seed.id = ANY(p_seed_ids)
    WHERE kc.pack_id = p_pack_id
      AND (v_generation_id IS NULL OR kc.generation_id = v_generation_id)
      AND kc.is_redacted = false AND kc.path = seed.path
      AND ABS(kc.start_line - seed.start_line) < 200
      AND kc.id != ANY(p_seed_ids))
  ),
  scored_nodes AS (
    SELECT en.id, en.chunk_id, en.source_id, en.path, en.content,
      en.entity_type, en.entity_name, en.signature, en.start_line, en.end_line,
      en.r_type, en.r_sym,
      (en.base_score * CASE
        WHEN en.r_sym IS NOT NULL AND en.r_sym = ANY(p_symbols) THEN 1.0
        WHEN en.r_sym IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.knowledge_chunks s WHERE s.id = ANY(p_seed_ids) AND s.imports && ARRAY[en.r_sym]
        ) THEN 0.5
        ELSE 1.0
      END) as final_score
    FROM expanded_nodes en WHERE en.rank <= v_max_per
  )
  SELECT DISTINCT ON (sn.id)
    sn.id, sn.chunk_id, sn.source_id, sn.path, sn.content,
    sn.entity_type, sn.entity_name, sn.signature, sn.start_line, sn.end_line,
    sn.final_score as score, sn.r_type as relation_type, sn.r_sym as relation_symbol
  FROM scored_nodes sn ORDER BY sn.id, sn.final_score DESC LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.kg_expand_v1(uuid, uuid, uuid[], text[], int, int) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.kg_expand_v1(uuid, uuid, uuid[], text[], int, int) TO service_role;

-- definition_search_v1
CREATE OR REPLACE FUNCTION public.definition_search_v1(
  p_org_id uuid, p_pack_id uuid, p_symbols text[], p_match_count int DEFAULT 15
)
RETURNS TABLE (
  id uuid, chunk_id text, path text, content text, line_start int, line_end int,
  source_id uuid, entity_type text, entity_name text, signature text, score double precision
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT kc.id, kc.chunk_id, kc.path, kc.content, kc.start_line, kc.end_line,
    kc.source_id, kc.entity_type, kc.entity_name, kc.signature,
    1.0::double precision as score
  FROM public.knowledge_chunks kc
  WHERE kc.pack_id = p_pack_id AND kc.is_redacted = false
    AND kc.exported_names && p_symbols
  ORDER BY kc.created_at DESC
  LIMIT LEAST(COALESCE(p_match_count, 15), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.definition_search_v1(uuid, uuid, text[], int) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.definition_search_v1(uuid, uuid, text[], int) TO service_role;

-- find_references_v1
CREATE OR REPLACE FUNCTION public.find_references_v1(
  p_pack_id uuid, p_symbol text, p_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid, chunk_id text, path text, content text, line_start int, line_end int,
  source_id uuid, entity_type text, entity_name text, score double precision
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT kc.id, kc.chunk_id, kc.path, kc.content, kc.start_line, kc.end_line,
    kc.source_id, kc.entity_type, kc.entity_name,
    0.8::double precision as score
  FROM public.knowledge_chunks kc
  WHERE kc.pack_id = p_pack_id AND kc.is_redacted = false
    AND kc.imports && ARRAY[p_symbol]
  ORDER BY kc.path
  LIMIT LEAST(COALESCE(p_limit, 5), 20);
END;
$$;

REVOKE ALL ON FUNCTION public.find_references_v1(uuid, text, int) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.find_references_v1(uuid, text, int) TO service_role;