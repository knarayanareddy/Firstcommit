
-- Fix ingestion_job_state: drop any public-role policy and ensure only service_role
DROP POLICY IF EXISTS "Allow service role full access" ON public.ingestion_job_state;
DROP POLICY IF EXISTS "Service role full access on ingestion_job_state" ON public.ingestion_job_state;
DROP POLICY IF EXISTS "service_role_full_access" ON public.ingestion_job_state;

-- Re-check: drop ALL policies on ingestion_job_state to start clean
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'ingestion_job_state' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ingestion_job_state', pol.policyname);
  END LOOP;
END $$;

-- Only service_role should access this table
CREATE POLICY "Service role full access on ingestion_job_state"
ON public.ingestion_job_state
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Fix notifications: drop the permissive insert policy and restrict to service_role
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'notifications' AND schemaname = 'public'
    AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT TO service_role
WITH CHECK (true);
