-- Migration: Ingestion Step Worker State
-- Description: Persistent state for stepwise repo ingestion to handle Edge CPU limits.

-- 1. Ingestion Job State Table
CREATE TABLE IF NOT EXISTS public.ingestion_job_state (
    job_id UUID PRIMARY KEY REFERENCES public.ingestion_jobs(id) ON DELETE CASCADE,
    pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.pack_sources(id) ON DELETE CASCADE,
    files_json JSONB NOT NULL, -- Array of file paths to process
    cursor INT NOT NULL DEFAULT 0, -- Current file index
    chunk_idx INT NOT NULL DEFAULT 0, -- Cumulative chunk count
    symbol_cursor INT NOT NULL DEFAULT 0, -- Progress for symbol phase
    max_invocations INT NOT NULL DEFAULT 200, -- Escape condition
    invocations_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indices for management
CREATE INDEX IF NOT EXISTS idx_ingestion_job_state_pack ON public.ingestion_job_state(pack_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_job_state_source ON public.ingestion_job_state(source_id);

-- 3. RLS
ALTER TABLE public.ingestion_job_state ENABLE ROW LEVEL SECURITY;

-- service_role (Edge Functions) can manage all state
CREATE POLICY "Allow service_role full access on job state"
ON public.ingestion_job_state
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Pack members (learner+) can read state for UI visibility
CREATE POLICY "Allow members to read job state"
ON public.ingestion_job_state
FOR SELECT TO authenticated
USING (public.is_pack_member(auth.uid(), pack_id));

-- 4. Trigger for updated_at
CREATE TRIGGER trg_ingestion_job_state_updated_at
    BEFORE UPDATE ON public.ingestion_job_state
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
