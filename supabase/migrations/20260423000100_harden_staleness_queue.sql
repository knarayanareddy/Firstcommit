-- Migration: Harden Staleness Check Queue
-- Adds observability columns and explicit RLS for worker operations.

-- 1. Ensure Table exists (Robustness for environments where 20260411 was skipped)
CREATE TABLE IF NOT EXISTS public.staleness_check_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
    reason TEXT NOT NULL DEFAULT 'ingestion_completed',
    source_id UUID NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, done, failed
    error_message TEXT NULL
);

-- 2. Core Indices (Ensure they exist)
CREATE UNIQUE INDEX IF NOT EXISTS staleness_check_queue_pending_idx 
    ON public.staleness_check_queue (pack_id) 
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS staleness_check_queue_status_time_idx 
    ON public.staleness_check_queue (status, requested_at);

-- 3. Add observability columns
ALTER TABLE public.staleness_check_queue 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

-- 4. Add explicit RLS policies for management
ALTER TABLE public.staleness_check_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_manage_queue ON public.staleness_check_queue;
CREATE POLICY service_role_manage_queue
    ON public.staleness_check_queue
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


