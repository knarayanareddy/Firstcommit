-- 20260327151500_fix_ingestion_rls.sql
-- Fixes the unresponsive "Stop" and "Dismiss" buttons in the Ingestion UI by adding missing RLS policies.

DO $$ 
BEGIN
    -- 1. Fix UPDATE policy (allows "Stop" button to work)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ingestion_jobs' AND policyname = 'Pack members can update ingestion jobs'
    ) THEN
        CREATE POLICY "Pack members can update ingestion jobs"
          ON public.ingestion_jobs FOR UPDATE TO authenticated
          USING (public.is_pack_member(auth.uid(), pack_id))
          WITH CHECK (public.is_pack_member(auth.uid(), pack_id));
    END IF;

    -- 2. Fix DELETE policy (allows "Dismiss/X" button to work)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ingestion_jobs' AND policyname = 'Pack members can delete ingestion jobs'
    ) THEN
        CREATE POLICY "Pack members can delete ingestion jobs"
          ON public.ingestion_jobs FOR DELETE TO authenticated
          USING (public.is_pack_member(auth.uid(), pack_id));
    END IF;
END $$;

-- 3. Emergency Cleanup: Clear any stuck processing jobs to reset the UI state
-- This is a one-time operation for the migration.
UPDATE public.ingestion_jobs 
SET status = 'failed', 
    completed_at = now(), 
    error_message = 'Reset: stale processing job cleared for manual re-sync' 
WHERE status = 'processing' 
  AND (last_heartbeat_at < now() - interval '5 minutes' OR last_heartbeat_at IS NULL);
