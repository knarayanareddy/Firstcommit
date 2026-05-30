-- Add missing RLS policies for UPDATE and DELETE on ingestion_jobs
-- Authors can update ingestion jobs (for Stop button)
CREATE POLICY "Authors can update ingestion jobs"
ON public.ingestion_jobs
FOR UPDATE
TO authenticated
USING (has_pack_access(auth.uid(), pack_id, 'author'::text));

-- Authors can delete ingestion jobs (for Dismiss button)
CREATE POLICY "Authors can delete ingestion jobs"
ON public.ingestion_jobs
FOR DELETE
TO authenticated
USING (has_pack_access(auth.uid(), pack_id, 'author'::text));