-- Migration: KG Metrics Columns
-- Description: Adds KG-specific columns to rag_metrics for monitoring retrieval performance.

ALTER TABLE public.rag_metrics
ADD COLUMN IF NOT EXISTS kg_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS kg_added_spans INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS kg_definition_hits INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS kg_reference_hits INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS kg_time_ms INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS rerank_skipped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rerank_skip_reason TEXT;

COMMENT ON COLUMN public.rag_metrics.kg_enabled IS 'Whether KG expansion was attempted for this retrieval';
COMMENT ON COLUMN public.rag_metrics.kg_added_spans IS 'Number of new evidence spans found exclusively via KG expansion';
COMMENT ON COLUMN public.rag_metrics.kg_definition_hits IS 'Number of KG results with relation_type = "definition"';
COMMENT ON COLUMN public.rag_metrics.kg_reference_hits IS 'Number of KG results with relation_type = "reference"';
COMMENT ON COLUMN public.rag_metrics.kg_time_ms IS 'Latency of the kg_expand_v1 RPC call in milliseconds';
COMMENT ON COLUMN public.rag_metrics.rerank_skipped IS 'Whether the external LLM reranker was bypassed due to high KG confidence';
COMMENT ON COLUMN public.rag_metrics.rerank_skip_reason IS 'Reason for skipping rerank (e.g. "graph_confident")';
