-- Titanium Security Audit Script (Expert Feedback R7)
-- Run this script to verify that the retrieval system is "Titanium Hardened" and free of common "hatches."

DO $$
DECLARE
    v_error_count INT := 0;
    v_rec RECORD;
BEGIN
    RAISE NOTICE 'Starting Titanium Security Audit...';

    -- 1. Verify exactly one canonical hybrid_search_v2 signature exists
    SELECT count(*) INTO v_rec.count 
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.nspname = 'public' AND p.proname = 'hybrid_search_v2';
    
    IF v_rec.count != 1 THEN
        RAISE WARNING 'FAILURE: Expected 1 hybrid_search_v2 function, found %', v_rec.count;
        v_error_count := v_error_count + 1;
    ELSE
        RAISE NOTICE 'SUCCESS: Exactly 1 hybrid_search_v2 function found.';
    END IF;

    -- 2. Verify knowledge_chunks RLS is pack-scoped
    SELECT count(*) INTO v_rec.count
    FROM pg_policies
    WHERE tablename = 'knowledge_chunks'
      AND (
        qual ILIKE '%pack_members%' 
        OR qual ILIKE '%pm.user_id%'
      );
    
    IF v_rec.count = 0 THEN
        RAISE WARNING 'FAILURE: knowledge_chunks RLS does not appear to be pack-isolated.';
        v_error_count := v_error_count + 1;
    ELSE
        RAISE NOTICE 'SUCCESS: knowledge_chunks RLS is pack-isolated.';
    END IF;

    -- 3. Ensure no SECURITY DEFINER search functions are public-executable
    FOR v_rec IN 
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' 
          AND p.prosecdef = true
          AND (p.proname ILIKE '%search%' OR p.proname ILIKE '%match%')
          AND has_function_privilege('public', p.oid, 'EXECUTE')
    LOOP
        RAISE WARNING 'FAILURE: SECURITY DEFINER function %.%(%) is executable by PUBLIC.', v_rec.proname, v_rec.args;
        v_error_count := v_error_count + 1;
    END LOOP;

    -- 4. Verify no shadow overloads of legacy match_chunks_hybrid exist
    SELECT count(*) INTO v_rec.count
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'match_chunks_hybrid';
    
    IF v_rec.count > 0 THEN
        RAISE WARNING 'FAILURE: Legacy match_chunks_hybrid overloads still exist.';
        v_error_count := v_error_count + 1;
    ELSE
        RAISE NOTICE 'SUCCESS: No legacy search functions found.';
    END IF;

    -- Final Report
    IF v_error_count > 0 THEN
        RAISE EXCEPTION 'Titanium Security Audit FAILED with % errors.', v_error_count;
    ELSE
        RAISE NOTICE 'Titanium Security Audit PASSED. System is production-hardened.';
    END IF;
END $$;
