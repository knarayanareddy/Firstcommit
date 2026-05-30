-- Add UPDATE and DELETE policies for ingestion_jobs to allow pack members to manage their ingestion tasks
-- Created: 2026-04-23

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingestion_jobs' AND policyname = 'Pack members can update ingestion jobs') THEN
        CREATE POLICY "Pack members can update ingestion jobs"
          ON public.ingestion_jobs FOR UPDATE TO authenticated
          USING (public.is_pack_member(auth.uid(), pack_id))
          WITH CHECK (public.is_pack_member(auth.uid(), pack_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingestion_jobs' AND policyname = 'Pack members can delete finished ingestion jobs') THEN
        CREATE POLICY "Pack members can delete finished ingestion jobs"
          ON public.ingestion_jobs FOR DELETE TO authenticated
          USING (public.is_pack_member(auth.uid(), pack_id) AND status IN ('completed', 'failed'));
    END IF;
END $$;
