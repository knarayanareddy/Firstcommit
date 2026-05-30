-- Fix: Add ON DELETE CASCADE to ingestion_jobs.source_id FK
-- This prevents the foreign key violation when deleting a source that has ingestion history.

ALTER TABLE public.ingestion_jobs
  DROP CONSTRAINT IF EXISTS ingestion_jobs_source_id_fkey;

ALTER TABLE public.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_source_id_fkey
  FOREIGN KEY (source_id) REFERENCES public.pack_sources(id) ON DELETE CASCADE;
