
ALTER TABLE public.ingestion_jobs
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
