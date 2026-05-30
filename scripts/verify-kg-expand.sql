-- Verification Script for KG Retrieval v2 (SQL Editor)
-- 1. Setup (Requires real IDs from your DB)
-- REPLACE THESE WITH ACTUAL VALUES FROM YOUR DB
DO $$
DECLARE
  v_org_id UUID := '00000000-0000-0000-0000-000000000000'; 
  v_pack_id UUID := '00000000-0000-0000-0000-000000000000';
  v_gen_id UUID;
  v_relation_type TEXT;
  v_seed_ids UUID[];
  v_result_count INT;
BEGIN
  -- 1a. Simulate Auth Claims (Uncomment to test membership/RLS)
  -- PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  -- PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);

  -- 2. Pick deterministic seeds from the ACTIVE generation
  SELECT active_generation_id INTO v_gen_id
  FROM public.pack_active_generation
  WHERE org_id = v_org_id AND pack_id = v_pack_id;

  IF v_gen_id IS NULL THEN
    RAISE NOTICE 'No active generation found for pack %. Falling back to latest.', v_pack_id;
    SELECT generation_id INTO v_gen_id
    FROM public.knowledge_chunks
    WHERE pack_id = v_pack_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  SELECT (array_agg(id ORDER BY created_at DESC))[1:3] INTO v_seed_ids
  FROM public.knowledge_chunks
  WHERE pack_id = v_pack_id AND generation_id = v_gen_id;

  IF v_seed_ids IS NULL OR array_length(v_seed_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No seed chunks found for generation %', v_gen_id;
  END IF;

  RAISE NOTICE 'Testing kg_expand_v1 with seeds from gen %: %', v_gen_id, v_seed_ids;

  -- 3. Call expansion and report counts
  DROP TABLE IF EXISTS tmp_expansion_results;
  CREATE TEMP TABLE tmp_expansion_results AS
  SELECT * FROM public.kg_expand_v1(v_org_id, v_pack_id, v_seed_ids);

  SELECT count(*) INTO v_result_count FROM tmp_expansion_results;
  RAISE NOTICE 'kg_expand_v1 returned % total rows.', v_result_count;

  -- Report by relation type
  FOR v_result_count, v_relation_type IN 
    SELECT count(*), relation_type::text FROM tmp_expansion_results GROUP BY relation_type
  LOOP
    RAISE NOTICE 'Relation: %, Count: %', v_relation_type, v_result_count;
  END LOOP;

  DROP TABLE tmp_expansion_results;
END $$;
