-- Add metadata column to ingestion_jobs to track metrics like embedding reuse
ALTER TABLE public.ingestion_jobs
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Add metadata column to reindex_progress for consistency
ALTER TABLE public.reindex_progress
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Index for better performance on metadata queries
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_metadata ON public.ingestion_jobs USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_reindex_progress_metadata ON public.reindex_progress USING gin(metadata);
