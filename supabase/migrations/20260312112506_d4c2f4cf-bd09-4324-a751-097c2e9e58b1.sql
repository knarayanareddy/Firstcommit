-- Add ON DELETE CASCADE to ingestion_jobs.source_id -> pack_sources
ALTER TABLE public.ingestion_jobs
  DROP CONSTRAINT IF EXISTS ingestion_jobs_source_id_fkey;
ALTER TABLE public.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_source_id_fkey
  FOREIGN KEY (source_id) REFERENCES public.pack_sources(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to knowledge_chunks.source_id -> pack_sources
ALTER TABLE public.knowledge_chunks
  DROP CONSTRAINT IF EXISTS knowledge_chunks_source_id_fkey;
ALTER TABLE public.knowledge_chunks
  ADD CONSTRAINT knowledge_chunks_source_id_fkey
  FOREIGN KEY (source_id) REFERENCES public.pack_sources(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to ingestion_jobs.pack_id -> packs
ALTER TABLE public.ingestion_jobs
  DROP CONSTRAINT IF EXISTS ingestion_jobs_pack_id_fkey;
ALTER TABLE public.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_pack_id_fkey
  FOREIGN KEY (pack_id) REFERENCES public.packs(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to knowledge_chunks.pack_id -> packs
ALTER TABLE public.knowledge_chunks
  DROP CONSTRAINT IF EXISTS knowledge_chunks_pack_id_fkey;
ALTER TABLE public.knowledge_chunks
  ADD CONSTRAINT knowledge_chunks_pack_id_fkey
  FOREIGN KEY (pack_id) REFERENCES public.packs(id) ON DELETE CASCADE;