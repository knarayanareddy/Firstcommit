-- Migration: Add Zero-Hallucination RAG Metrics
-- Implementation Phase 5: Telemetry + Evaluation

-- Add columns to rag_metrics for granular observability
ALTER TABLE rag_metrics 
ADD COLUMN IF NOT EXISTS strip_rate float4 DEFAULT 0,
ADD COLUMN IF NOT EXISTS claims_total int4 DEFAULT 0,
ADD COLUMN IF NOT EXISTS claims_stripped int4 DEFAULT 0,
ADD COLUMN IF NOT EXISTS snippets_resolved int4 DEFAULT 0;

-- Comment for clarity
COMMENT ON COLUMN rag_metrics.strip_rate IS 'Percentage of claims stripped due to failed grounding (0.0 - 1.0)';
COMMENT ON COLUMN rag_metrics.claims_total IS 'Total number of claims/sentences identified in the response';
COMMENT ON COLUMN rag_metrics.claims_stripped IS 'Number of claims removed during verification';
COMMENT ON COLUMN rag_metrics.snippets_resolved IS 'Number of [SNIPPET] placeholders successfully hydrated from server source';

-- Security: Ensure only service role can insert (standard for our edge functions)
-- REVOKE ALL ON rag_metrics FROM public, authenticated; -- (already handled by schema defaults in many cases, but good to be explicit)
-- GRANT SELECT ON rag_metrics TO authenticated; 
