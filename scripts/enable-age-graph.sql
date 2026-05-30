-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 7 (OPT-IN, EXPERIMENTAL): Apache AGE knowledge graph for code retrieval.
-- Requires Apache AGE (https://age.apache.org) on Postgres 15/16.
-- NOT an auto-migration: AGE is not universally installed and CREATE EXTENSION age
-- would break `supabase db reset`. Run intentionally on an AGE-enabled database.
--
-- Schema-preserving: this provides *_age variants of the EXISTING traversal RPC
-- signatures. Set KG_ENGINE=age in the edge runtime to use them; the edge code
-- (detective-retrieval.ts) and the citation/span contract are unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, public;

-- 1. Create the graph (idempotent guard).
DO $$ BEGIN
  PERFORM 1 FROM ag_catalog.ag_graph WHERE name = 'rocketboard_kg';
  IF NOT FOUND THEN PERFORM ag_catalog.create_graph('rocketboard_kg'); END IF;
END $$;

-- 2. Sync nodes + edges from the existing relational symbol tables.
--    Run after ingestion (or on a schedule). Nodes = symbols; edges = defines/references/imports.
CREATE OR REPLACE FUNCTION public.sync_age_graph(p_pack_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ag_catalog, public AS $$
DECLARE r record;
BEGIN
  -- Symbol definition nodes
  FOR r IN SELECT DISTINCT symbol, chunk_id FROM public.symbol_definitions WHERE pack_id = p_pack_id LOOP
    PERFORM ag_catalog.cypher('rocketboard_kg', $q$
      MERGE (s:Symbol {name: $sym, pack: $pack})
      MERGE (c:Chunk {id: $cid})
      MERGE (s)-[:DEFINED_IN]->(c)
    $q$, jsonb_build_object('sym', r.symbol, 'pack', p_pack_id::text, 'cid', r.chunk_id));
  END LOOP;
  -- Reference edges
  FOR r IN SELECT DISTINCT symbol, chunk_id FROM public.symbol_references WHERE pack_id = p_pack_id LOOP
    PERFORM ag_catalog.cypher('rocketboard_kg', $q$
      MERGE (s:Symbol {name: $sym, pack: $pack})
      MERGE (c:Chunk {id: $cid})
      MERGE (s)-[:REFERENCED_IN]->(c)
    $q$, jsonb_build_object('sym', r.symbol, 'pack', p_pack_id::text, 'cid', r.chunk_id));
  END LOOP;
END $$;

-- 3. AGE-backed RPC variants (SAME signatures/return columns as the native ones).
--    Definitions for a set of symbols → chunk rows joined back to knowledge_chunks.
CREATE OR REPLACE FUNCTION public.definition_search_v1_age(
  p_org_id uuid, p_pack_id uuid, p_symbols text[], p_match_count int
)
RETURNS SETOF public.knowledge_chunks LANGUAGE plpgsql STABLE
SET search_path = ag_catalog, public AS $$
BEGIN
  RETURN QUERY
  WITH hits AS (
    SELECT (c.props->>'id')::text AS chunk_id
    FROM ag_catalog.cypher('rocketboard_kg', $q$
      MATCH (s:Symbol)-[:DEFINED_IN]->(c:Chunk)
      WHERE s.name IN $syms AND s.pack = $pack
      RETURN c
    $q$, jsonb_build_object('syms', to_jsonb(p_symbols), 'pack', p_pack_id::text))
      AS (c agtype)
  )
  SELECT kc.* FROM public.knowledge_chunks kc
  JOIN hits ON hits.chunk_id = kc.chunk_id
  WHERE kc.pack_id = p_pack_id
  LIMIT p_match_count;
END $$;

-- find_references_v1_age + kg_expand_v1_age follow the same pattern (REFERENCED_IN /
-- 1-2 hop neighbourhood). Implement against your AGE build, mirroring the native
-- return columns exactly. See docs/PHASE7_APACHE_AGE.md.

REVOKE ALL ON FUNCTION public.definition_search_v1_age(uuid, uuid, text[], int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definition_search_v1_age(uuid, uuid, text[], int) TO service_role;
