-- Security Hardening: Closing the "Side Door"
-- Addressing Expert Feedback R3: Revoke execute from authenticated to ensure Edge membership check is the only entry point

-- Revoke from public/authenticated to prevent direct client-side RPC calls
REVOKE EXECUTE ON FUNCTION hybrid_search_v2(UUID, UUID, TEXT, VECTOR(1536), FLOAT, INT, INT, TEXT, TEXT) FROM authenticated, public;

-- Ensure only the service_role (used by the Edge Function) and postgres (owner/admin) can execute
GRANT EXECUTE ON FUNCTION hybrid_search_v2(UUID, UUID, TEXT, VECTOR(1536), FLOAT, INT, INT, TEXT, TEXT) TO service_role;
