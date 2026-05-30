-- Migration: Restrict hybrid_search_v2 to Edge-only execution (Model A)
-- This enforces least privilege by revoking direct browser access to the search RPC.

-- 1. Revoke access from authenticated users
-- This prevents direct .rpc("hybrid_search_v2") calls from the browser.
REVOKE ALL ON FUNCTION public.hybrid_search_v2(UUID, UUID, TEXT, VECTOR(1536), FLOAT, INT, INT, TEXT, TEXT) FROM authenticated;

-- 2. Grant access only to service_role
-- This enables Edge Functions and other internal services to perform searches.
GRANT EXECUTE ON FUNCTION public.hybrid_search_v2(UUID, UUID, TEXT, VECTOR(1536), FLOAT, INT, INT, TEXT, TEXT) TO service_role;

-- 3. Note: Any client-side search must now flow through the 'retrieve-spans' Edge Function.
