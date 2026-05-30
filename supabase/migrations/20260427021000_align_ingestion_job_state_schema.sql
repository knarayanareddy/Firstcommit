-- Migration: Align Ingestion Job State Schema
-- Description: Upgrades existing ingestion_job_state to match Edge function expectations and ensures idempotency.

-- 1. Add missing columns IF NOT EXISTS
ALTER TABLE public.ingestion_job_state ADD COLUMN IF NOT EXISTS pack_id UUID NULL REFERENCES public.packs(id) ON DELETE CASCADE;
ALTER TABLE public.ingestion_job_state ADD COLUMN IF NOT EXISTS source_id UUID NULL REFERENCES public.pack_sources(id) ON DELETE CASCADE;
ALTER TABLE public.ingestion_job_state ADD COLUMN IF NOT EXISTS files_json JSONB NULL;
ALTER TABLE public.ingestion_job_state ADD COLUMN IF NOT EXISTS chunk_idx INT NOT NULL DEFAULT 0;
ALTER TABLE public.ingestion_job_state ADD COLUMN IF NOT EXISTS max_invocations INT NOT NULL DEFAULT 200;
ALTER TABLE public.ingestion_job_state ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.ingestion_job_state ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Backfill columns from existing schema
-- If file_tree exists and files_json is NULL, set files_json = file_tree
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ingestion_job_state' AND column_name = 'file_tree'
    ) THEN
        UPDATE public.ingestion_job_state 
        SET files_json = file_tree 
        WHERE files_json IS NULL;
    END IF;
END $$;

-- Backfill pack_id/source_id from ingestion_jobs
UPDATE public.ingestion_job_state s
SET pack_id = j.pack_id, source_id = j.source_id
FROM public.ingestion_jobs j
WHERE s.job_id = j.id AND (s.pack_id IS NULL OR s.source_id IS NULL);

-- 3. Enforce "one state row per job_id"
-- created_at was likely already primary key or had unique constraint, but let's ensure unique index on job_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingestion_job_state_job_id_uni ON public.ingestion_job_state(job_id);

-- 4. RLS policy alignment
-- Ensure RLS is enabled
ALTER TABLE public.ingestion_job_state ENABLE ROW LEVEL SECURITY;

-- Ensure there is a SELECT policy that can reference pack_id
-- We drop and recreate to ensure it uses the new pack_id column correctly if it was missing before
DO $$
BEGIN
    -- Only recreate if pack_id is now NOT NULL (or we just want to be sure)
    -- The user asked to ensure there is a SELECT policy.
    DROP POLICY IF EXISTS "Allow members to read job state" ON public.ingestion_job_state;
    
    CREATE POLICY "Allow members to read job state"
    ON public.ingestion_job_state
    FOR SELECT TO authenticated
    USING (public.is_pack_member(auth.uid(), pack_id));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not recreate SELECT policy: %', SQLERRM;
END $$;

-- 5. Trigger alignment
-- Ensure updated_at trigger exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_ingestion_job_state_updated_at' 
        AND tgrelid = 'public.ingestion_job_state'::regclass
    ) THEN
        CREATE TRIGGER trg_ingestion_job_state_updated_at
            BEFORE UPDATE ON public.ingestion_job_state
            FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
    END IF;
END $$;
