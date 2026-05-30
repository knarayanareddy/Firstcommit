
-- 1. knowledge_chunks table
CREATE TABLE public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.pack_sources(id) ON DELETE CASCADE,
  chunk_id text NOT NULL,
  path text NOT NULL,
  start_line integer NOT NULL,
  end_line integer NOT NULL,
  content text NOT NULL,
  content_hash text NOT NULL,
  metadata jsonb DEFAULT '{}',
  is_redacted boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pack_id, chunk_id)
);
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_knowledge_chunks_pack_path ON public.knowledge_chunks(pack_id, path);
CREATE INDEX idx_knowledge_chunks_pack_chunk ON public.knowledge_chunks(pack_id, chunk_id);

-- Full-text search index
ALTER TABLE public.knowledge_chunks ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX idx_knowledge_chunks_fts ON public.knowledge_chunks USING gin(fts);

-- RLS: readable by pack members, writable only by service_role (no insert/update/delete policies for authenticated)
CREATE POLICY "Pack members can read knowledge chunks"
  ON public.knowledge_chunks FOR SELECT TO authenticated
  USING (public.is_pack_member(auth.uid(), pack_id));

-- 2. ingestion_jobs table
CREATE TABLE public.ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.pack_sources(id),
  status text NOT NULL DEFAULT 'pending',
  total_chunks integer DEFAULT 0,
  processed_chunks integer DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ingestion_jobs_pack ON public.ingestion_jobs(pack_id);
CREATE INDEX idx_ingestion_jobs_source ON public.ingestion_jobs(source_id);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_ingestion_job_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'processing', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid ingestion job status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_ingestion_job_status
  BEFORE INSERT OR UPDATE ON public.ingestion_jobs
  FOR EACH ROW EXECUTE FUNCTION public.validate_ingestion_job_status();

-- RLS: readable by pack members
CREATE POLICY "Pack members can read ingestion jobs"
  ON public.ingestion_jobs FOR SELECT TO authenticated
  USING (public.is_pack_member(auth.uid(), pack_id));

-- Enable realtime for ingestion_jobs so UI can poll/subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE public.ingestion_jobs;
