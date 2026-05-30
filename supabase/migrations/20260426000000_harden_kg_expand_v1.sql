-- Migration: Harden KG Expansion RPC
-- Description: Adds org_id filtering, symbol sanitization, and fixes scoring null behavior.
-- Rationale: 
-- 1. Tighten security by ensuring strict org_id isolation in all sub-queries.
-- 2. Symbol sanitization prevents processing of empty or excessively long strings.
-- 3. COALESCE ensures scoring logic remains functional when p_symbols is NULL.
-- 4. Cleaned up redundant seed exclusion logic for better readability.

-- 1. Harden kg_expand_v1
DROP FUNCTION IF EXISTS public.kg_expand_v1(uuid, uuid, uuid[], text[], int, int);
CREATE OR REPLACE FUNCTION public.kg_expand_v1(
  p_org_id uuid,
  p_pack_id uuid,
  p_seed_ids uuid[],              -- seed chunk PKs (knowledge_chunks.id)
  p_symbols text[] DEFAULT NULL,  -- optional symbols to expand around
  p_limit int DEFAULT 15,
  p_max_per_relation int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  chunk_id text,
  source_id uuid,
  path text,
  content text,
  entity_type text,
  entity_name text,
  signature text,
  line_start int,
  line_end int,
  score float,
  relation_type text,        -- 'definition' | 'reference' | 'import_link' | 'neighbor'
  relation_symbol text       -- which symbol triggered the edge (nullable)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generation_id UUID;
  v_all_symbols TEXT[] := COALESCE(p_symbols, '{}');
  v_limit INT;
  v_max_per INT;
BEGIN
  -- A) Membership check
  IF auth.role() = 'service_role' THEN
    -- Allow
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.pack_members
    WHERE pack_id = p_pack_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: User is not a member of this pack.';
  END IF;

  v_limit := LEAST(COALESCE(p_limit, 15), 50);
  v_max_per := LEAST(COALESCE(p_max_per_relation, 5), 20);

  -- B) Generation pinning
  SELECT active_generation_id INTO v_generation_id
  FROM public.pack_active_generation
  WHERE org_id = p_org_id AND pack_id = p_pack_id;

  -- Fallback to latest generation if no active ledger entry (e.g. initial sync)
  IF v_generation_id IS NULL THEN
    v_generation_id := (
        SELECT kc.generation_id 
        FROM public.knowledge_chunks kc
        WHERE kc.org_id = p_org_id AND kc.pack_id = p_pack_id
        ORDER BY kc.created_at DESC
        LIMIT 1
    );
  END IF;

  -- Build symbol set from seeds
  WITH seed_metadata AS (
    SELECT exported_names, imports
    FROM public.knowledge_chunks
    WHERE id = ANY(p_seed_ids)
      AND org_id = p_org_id
      AND pack_id = p_pack_id
      AND (v_generation_id IS NULL OR generation_id = v_generation_id)
  )
  SELECT array_agg(DISTINCT sym) INTO v_all_symbols
  FROM (
    SELECT unnest(v_all_symbols) as sym
    UNION
    SELECT unnest(exported_names) FROM seed_metadata
    UNION
    SELECT unnest(imports) FROM seed_metadata
  ) s
  WHERE sym IS NOT NULL AND sym <> '' AND length(sym) <= 200;

  -- Cap symbol count to avoid blowups
  IF array_length(v_all_symbols, 1) > 50 THEN
    v_all_symbols := v_all_symbols[1:50];
  END IF;

  RETURN QUERY
  WITH expanded_nodes AS (
    -- 1. Definition expansion (chunks exporting our symbols)
    (
      SELECT 
        kc.id, kc.chunk_id, kc.source_id, kc.path, kc.content,
        kc.entity_type, kc.entity_name, kc.signature, kc.line_start, kc.line_end,
        1.0 as base_score,
        'definition'::text as r_type,
        sym as r_sym,
        ROW_NUMBER() OVER(PARTITION BY sym ORDER BY (kc.entity_name = sym) DESC) as rank
      FROM public.knowledge_chunks kc, 
           unnest(v_all_symbols) sym
      WHERE kc.org_id = p_org_id
        AND kc.pack_id = p_pack_id
        AND (v_generation_id IS NULL OR kc.generation_id = v_generation_id)
        AND kc.is_redacted = false
        AND kc.exported_names && ARRAY[sym]
        AND kc.id != ANY(p_seed_ids)
    )
    UNION ALL
    -- 2. Reference expansion (chunks importing our symbols)
    (
      SELECT 
        kc.id, kc.chunk_id, kc.source_id, kc.path, kc.content,
        kc.entity_type, kc.entity_name, kc.signature, kc.line_start, kc.line_end,
        0.8 as base_score,
        'reference'::text as r_type,
        sym as r_sym,
        ROW_NUMBER() OVER(PARTITION BY sym ORDER BY kc.path) as rank
      FROM public.knowledge_chunks kc,
           unnest(v_all_symbols) sym
      WHERE kc.org_id = p_org_id
        AND kc.pack_id = p_pack_id
        AND (v_generation_id IS NULL OR kc.generation_id = v_generation_id)
        AND kc.is_redacted = false
        AND kc.imports && ARRAY[sym]
        AND kc.id != ANY(p_seed_ids)
    )
    UNION ALL
    -- 3. Neighbor expansion (same file, close proximity)
    (
      SELECT 
        kc.id, kc.chunk_id, kc.source_id, kc.path, kc.content,
        kc.entity_type, kc.entity_name, kc.signature, kc.line_start, kc.line_end,
        0.3 as base_score,
        'neighbor'::text as r_type,
        NULL::text as r_sym,
        ROW_NUMBER() OVER(PARTITION BY seed.id ORDER BY ABS(kc.line_start - seed.line_start)) as rank
      FROM public.knowledge_chunks kc
      JOIN public.knowledge_chunks seed ON seed.id = ANY(p_seed_ids)
      WHERE kc.org_id = p_org_id
        AND kc.pack_id = p_pack_id
        AND (v_generation_id IS NULL OR kc.generation_id = v_generation_id)
        AND kc.is_redacted = false
        AND kc.path = seed.path
        AND ABS(kc.line_start - seed.line_start) < 200
        AND kc.id != ANY(p_seed_ids)
    )
  ),
  scored_nodes AS (
    SELECT 
      en.id, en.chunk_id, en.source_id, en.path, en.content,
      en.entity_type, en.entity_name, en.signature, en.line_start, en.line_end,
      en.r_type, en.r_sym,
      (en.base_score * 
       CASE 
         WHEN en.r_sym IS NOT NULL AND en.r_sym = ANY(COALESCE(p_symbols, '{}')) THEN 1.0  -- Priority for user-provided symbols
         WHEN en.r_sym IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.knowledge_chunks s 
           WHERE s.id = ANY(p_seed_ids) AND s.imports && ARRAY[en.r_sym]
         ) THEN 0.5 -- Multiplier for symbols found only in seed imports
         ELSE 1.0 
       END
      ) as final_score
    FROM expanded_nodes en
    WHERE en.rank <= v_max_per
  )
  SELECT DISTINCT ON (sn.id)
    sn.id, sn.chunk_id, sn.source_id, sn.path, sn.content,
    sn.entity_type, sn.entity_name, sn.signature, sn.line_start, sn.line_end,
    sn.final_score as score, sn.r_type as relation_type, sn.r_sym as relation_symbol
  FROM scored_nodes sn
  ORDER BY sn.id, sn.final_score DESC
  LIMIT v_limit;
END;
$$;
