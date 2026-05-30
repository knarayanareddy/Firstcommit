-- Add error_message column to ingestion_jobs so failed jobs surface the error
-- instead of staying stuck in "processing" indefinitely.
ALTER TABLE public.ingestion_jobs
  ADD COLUMN IF NOT EXISTS error_message text;
