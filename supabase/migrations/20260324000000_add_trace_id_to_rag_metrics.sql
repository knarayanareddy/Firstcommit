-- Phase 7: Advanced Diagnostics & Loop Closure
-- This migration adds a dedicated trace_id column to rag_metrics for direct Langfuse correlation.

ALTER TABLE rag_metrics ADD COLUMN IF NOT EXISTS trace_id TEXT;
CREATE INDEX IF NOT EXISTS idx_rag_metrics_trace_id ON rag_metrics(trace_id);

COMMENT ON COLUMN rag_metrics.trace_id IS 'Direct link to Langfuse trace ID for deep diagnostics';
