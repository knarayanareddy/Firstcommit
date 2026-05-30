
-- Add missing columns to rag_metrics to align with ai-task-router recordRagMetrics insert
-- Also change request_id from UUID to TEXT to accept string request IDs

ALTER TABLE public.rag_metrics ALTER COLUMN request_id TYPE TEXT USING request_id::TEXT;

ALTER TABLE public.rag_metrics 
  ADD COLUMN IF NOT EXISTS org_id UUID,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS query TEXT,
  ADD COLUMN IF NOT EXISTS trace_id TEXT,
  ADD COLUMN IF NOT EXISTS retrieval_method TEXT DEFAULT 'hybrid',
  ADD COLUMN IF NOT EXISTS avg_relevance_score DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retrieval_latency_ms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS model_used TEXT,
  ADD COLUMN IF NOT EXISTS provider_used TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS generation_latency_ms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retrieval_hops INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_latency_ms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grounding_gate_mode TEXT DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS grounding_threshold_score DOUBLE PRECISION DEFAULT 0.80,
  ADD COLUMN IF NOT EXISTS grounding_threshold_strip DOUBLE PRECISION DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS detective_time_ms INTEGER DEFAULT 0;
