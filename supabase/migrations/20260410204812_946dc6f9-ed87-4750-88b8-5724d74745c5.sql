-- Fix ingestion_job_state: was granting public role instead of service_role
DROP POLICY IF EXISTS "Service role full access on ingestion_job_state" ON public.ingestion_job_state;
CREATE POLICY "Service role full access on ingestion_job_state"
ON public.ingestion_job_state
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Fix notifications: "Service role can insert" was on public role
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT TO service_role
WITH CHECK (true);