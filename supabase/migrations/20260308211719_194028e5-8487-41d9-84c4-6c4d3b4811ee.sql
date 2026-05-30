
-- Generation cascade tracking table
CREATE TABLE public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  module_key text,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for job_type
CREATE OR REPLACE FUNCTION public.validate_generation_job_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.job_type NOT IN ('module', 'quiz', 'glossary', 'paths', 'ask_lead') THEN
    RAISE EXCEPTION 'Invalid generation job_type: %', NEW.job_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_generation_job_type
  BEFORE INSERT OR UPDATE ON public.generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.validate_generation_job_type();

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_generation_job_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('queued', 'generating', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid generation job status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_generation_job_status
  BEFORE INSERT OR UPDATE ON public.generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.validate_generation_job_status();

-- RLS
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack members can read generation jobs"
  ON public.generation_jobs FOR SELECT TO authenticated
  USING (is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Authors can insert generation jobs"
  ON public.generation_jobs FOR INSERT TO authenticated
  WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can update generation jobs"
  ON public.generation_jobs FOR UPDATE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can delete generation jobs"
  ON public.generation_jobs FOR DELETE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'author'));

-- Enable realtime for generation_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_jobs;
