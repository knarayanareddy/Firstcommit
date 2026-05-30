-- Migration: Add Grounding Gate Metrics to rag_metrics
-- This enables tracking of the SLO gate decisions and thresholds used for each request.

ALTER TABLE rag_metrics 
ADD COLUMN IF NOT EXISTS grounding_gate_mode text DEFAULT 'retry_then_refuse',
ADD COLUMN IF NOT EXISTS grounding_gate_passed boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS grounding_gate_reason text,
ADD COLUMN IF NOT EXISTS grounding_threshold_score float8 DEFAULT 0.80,
ADD COLUMN IF NOT EXISTS grounding_threshold_strip float8 DEFAULT 0.20;

COMMENT ON COLUMN rag_metrics.grounding_gate_mode IS 'The enforcement mode used (off, retry_then_refuse, refuse, retry_only)';
COMMENT ON COLUMN rag_metrics.grounding_gate_passed IS 'Whether the final response passed the grounding gate';
COMMENT ON COLUMN rag_metrics.grounding_gate_reason IS 'Reason code for the gate decision (ok, low_grounding, high_strip_rate, etc.)';
COMMENT ON COLUMN rag_metrics.grounding_threshold_score IS 'The minimum grounding score required for this request';
COMMENT ON COLUMN rag_metrics.grounding_threshold_strip IS 'The maximum strip rate allowed for this request';
