-- 1. Enforce only one 'processing' job per source
-- This prevents race conditions where multiple requests for the same source trigger overlapping ingestions
CREATE UNIQUE INDEX idx_ingestion_jobs_one_processing_per_source 
ON public.ingestion_jobs(source_id) 
WHERE status = 'processing';

-- 2. Enforce only one 'processing' job per pack (Serialization)
-- Only if INGEST_PACK_SERIALIZE is on by default, this ensures a pack is not overwhelmed
-- by multiple source syncs at the same time.
CREATE UNIQUE INDEX idx_ingestion_jobs_one_processing_per_pack
ON public.ingestion_jobs(pack_id)
WHERE status = 'processing';
