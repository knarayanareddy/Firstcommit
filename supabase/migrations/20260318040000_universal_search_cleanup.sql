-- Phase 5: Universal Security Hardening & Legacy RPC Revocation
-- This migration ensures NO legacy search functions remain executable by non-privileged roles.

-- 1. Dynamic "Overload Reaper" for hybrid_search_v2 and legacy surfaces
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Loop through all functions that might be legacy search surfaces
    FOR r IN (
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args, 
               pronargs as arg_count
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
          AND (
            p.proname = 'hybrid_search_v2' OR
            p.proname LIKE 'match_chunks%' OR 
            p.proname LIKE 'search_chunks%' OR
            p.proname = 'hybrid_search'
          )
    ) LOOP
        -- SPECIAL CASE: hybrid_search_v2 shadowing
        IF r.proname = 'hybrid_search_v2' AND r.arg_count != 9 THEN
            EXECUTE format('DROP FUNCTION %I.%I(%s)', r.nspname, r.proname, r.args);
            RAISE NOTICE 'DROPPED shadow overload: %.%(%)', r.nspname, r.proname, r.args;
        ELSE
            -- SECURE the canonical 9-arg function or other legacy functions
            EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM public, authenticated', r.nspname, r.proname, r.args);
            
            -- Re-grant only if it's the canonical hardened function
            IF r.proname = 'hybrid_search_v2' AND r.arg_count = 9 THEN
                EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', r.nspname, r.proname, r.args);
                RAISE NOTICE 'HARDENED canonical function: %.%(%)', r.nspname, r.proname, r.args;
            ELSE
                RAISE NOTICE 'REVOKED ALL on legacy function: %.%(%)', r.nspname, r.proname, r.args;
            END IF;
        END IF;
    END LOOP;
END $$;

-- 2. Lockdown run_analyze (Security Definer)
-- Restricted to service_role only
REVOKE EXECUTE ON FUNCTION public.run_analyze(TEXT) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.run_analyze(TEXT) TO service_role;

-- 3. Final sanity check on knowledge_chunks
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.knowledge_chunks IS 'Core knowledge repository. RLS enforced. Direct RPC access revoked for all legacy search surfaces.';
