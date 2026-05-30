
-- Add missing columns to ingestion_job_state to align with controller/worker code
ALTER TABLE public.ingestion_job_state
  ADD COLUMN IF NOT EXISTS pack_id uuid,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS files_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS chunk_idx integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS max_invocations integer DEFAULT 200 NOT NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now() NOT NULL;
