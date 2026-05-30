
-- Add phase tracking columns to ingestion_jobs for granular monitoring
ALTER TABLE public.ingestion_jobs ADD COLUMN IF NOT EXISTS phase text DEFAULT 'pending';
ALTER TABLE public.ingestion_jobs ADD COLUMN IF NOT EXISTS current_file text;
ALTER TABLE public.ingestion_jobs ADD COLUMN IF NOT EXISTS current_file_index integer DEFAULT 0;
ALTER TABLE public.ingestion_jobs ADD COLUMN IF NOT EXISTS elapsed_ms integer DEFAULT 0;

-- Reset any currently stalled processing jobs
UPDATE public.ingestion_jobs 
SET status = 'failed', completed_at = now(), error_message = 'Reset: adding phase tracking columns' 
WHERE status = 'processing';
