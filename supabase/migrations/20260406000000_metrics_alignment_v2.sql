-- Migration: Metrics Alignment v2
-- Adds unique_files_count for RAG regression testing and ensures all grounding columns are present.

ALTER TABLE rag_metrics 
ADD COLUMN IF NOT EXISTS unique_files_count INT DEFAULT 0;

COMMENT ON COLUMN rag_metrics.unique_files_count IS 'Number of distinct files referenced in the source_map or citations';

-- Ensure all grounding columns from previous migrations are present (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rag_metrics' AND column_name='grounding_gate_passed') THEN
    ALTER TABLE rag_metrics ADD COLUMN grounding_gate_passed boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rag_metrics' AND column_name='grounding_gate_reason') THEN
    ALTER TABLE rag_metrics ADD COLUMN grounding_gate_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rag_metrics' AND column_name='grounding_gate_mode') THEN
    ALTER TABLE rag_metrics ADD COLUMN grounding_gate_mode text DEFAULT 'retry_then_refuse';
  END IF;
END $$;
