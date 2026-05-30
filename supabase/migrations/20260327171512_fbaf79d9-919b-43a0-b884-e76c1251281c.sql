
-- State table for stepwise ingestion tracking
CREATE TABLE IF NOT EXISTS public.ingestion_job_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.ingestion_jobs(id) ON DELETE CASCADE,
  file_tree jsonb DEFAULT '[]'::jsonb,
  cursor integer NOT NULL DEFAULT 0,
  symbol_cursor integer NOT NULL DEFAULT 0,
  invocations_count integer NOT NULL DEFAULT 0,
  phase text NOT NULL DEFAULT 'init',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);

-- RLS
ALTER TABLE public.ingestion_job_state ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions)
CREATE POLICY "Service role full access on ingestion_job_state"
  ON public.ingestion_job_state
  FOR ALL
  USING (true)
  WITH CHECK (true);
