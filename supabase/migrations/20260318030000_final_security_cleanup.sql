-- Phase 4: Final Security Cleanup (Expert Feedback Round 4)
-- This migration consolidate the "Edge-only" security posture.

-- 1. Revoke public/authenticated access to legacy search functions
DO $$ 
BEGIN
    -- Revoke from all overloads of match_chunks_hybrid
    REVOKE EXECUTE ON FUNCTION public.match_chunks_hybrid(vector, text, int, uuid, text) FROM public, authenticated;
    REVOKE EXECUTE ON FUNCTION public.match_chunks_hybrid(vector, text, int, uuid, text, float, float) FROM public, authenticated;
EXCEPTION
    WHEN undefined_function THEN
        -- Standard search functions might not exist in all environments
        RAISE NOTICE 'Legacy search functions not found, skipping revoke.';
END $$;

-- 3. Lockdown knowledge_chunks table
-- Ensure RLS is active and NO public/authenticated access exists beyond SELECT (controlled by RLS)
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Note: We already have 'org_isolation_chunks' policy. 
-- For Edge-only enforcement, we could even REVOKE SELECT FROM authenticated 
-- on knowledge_chunks, but it's safer to leave RLS as a secondary defense layer for now.

COMMENT ON FUNCTION public.hybrid_search_v2 IS 'Primary search RPC. SECURITY DEFINER, restricted to service_role to ensure Edge Function authorization check is bypassed safely.';
