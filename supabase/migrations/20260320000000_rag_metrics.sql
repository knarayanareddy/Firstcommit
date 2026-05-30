-- Phase 6: RAG Observability & Evaluation
-- This table stores granular metrics for every RAG query to enable local aggregate analytics
-- and feedback loops for model fine-tuning.

CREATE TABLE IF NOT EXISTS rag_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  query TEXT NOT NULL,
  task_type TEXT,
  request_id TEXT,
  
  -- Retrieval Metrics
  retrieval_method TEXT, -- 'vector', 'keyword', 'hybrid', 'graph'
  chunks_retrieved INT,
  chunks_after_rerank INT,
  avg_relevance_score FLOAT,
  retrieval_latency_ms INT,
  
  -- Generation Metrics
  model_used TEXT,
  provider_used TEXT,
  generation_latency_ms INT,
  input_tokens INT,
  output_tokens INT,
  
  -- Grounding/Verification Metrics
  citations_found INT,
  citations_verified INT,
  citations_failed INT,
  grounding_score FLOAT, -- Phase 4 result
  verification_score FLOAT, -- Legacy compatibility
  
  -- Agentic Loop Metrics
  attempts INT DEFAULT 1, -- Phase 5 iterations
  agent_confidence TEXT, -- 'high', 'medium', 'low', 'insufficient'
  
  total_latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for analytics
CREATE INDEX IF NOT EXISTS idx_rag_metrics_org_id ON rag_metrics(org_id);
CREATE INDEX IF NOT EXISTS idx_rag_metrics_task_type ON rag_metrics(task_type);
CREATE INDEX IF NOT EXISTS idx_rag_metrics_created_at ON rag_metrics(created_at);

-- Multi-tenant isolation for analytics dashboard
ALTER TABLE rag_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rag_metrics_select" ON rag_metrics;
CREATE POLICY "rag_metrics_select" ON rag_metrics
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Only service role (edge functions) can insert/update
DROP POLICY IF EXISTS "rag_metrics_insert" ON rag_metrics;
-- Implicitly restricted by no policy, but being explicit:
-- No public INSERT policy means only Service Role (bypassing RLS) can write.

-- Maintenance: Auto-delete metrics older than 90 days to save space
-- Note: In a real production env, you'd use pg_cron. Here we just define the query for documentation.
-- DELETE FROM rag_metrics WHERE created_at < now() - interval '90 days';
