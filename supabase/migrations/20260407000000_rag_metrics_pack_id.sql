-- Migration: Add pack_id to rag_metrics for Trust Console
-- This enables efficient pack-scoped reporting and RLS.

ALTER TABLE rag_metrics 
ADD COLUMN IF NOT EXISTS pack_id UUID REFERENCES packs(id) ON DELETE SET NULL;

-- Index for performance in Trust Console
CREATE INDEX IF NOT EXISTS idx_rag_metrics_pack_id ON rag_metrics(pack_id);

-- Update RLS to allow pack authors to view metrics
DROP POLICY IF EXISTS "Pack authors can view metrics" ON rag_metrics;
CREATE POLICY "Pack authors can view metrics" ON rag_metrics
FOR SELECT USING (
  has_pack_access(auth.uid(), pack_id, 'author')
);

COMMENT ON COLUMN rag_metrics.pack_id IS 'The specific onboarding pack associated with this AI request';
