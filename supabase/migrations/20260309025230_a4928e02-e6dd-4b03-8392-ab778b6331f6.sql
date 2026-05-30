
-- Create source-files storage bucket for document re-sync capability
INSERT INTO storage.buckets (id, name, public)
VALUES ('source-files', 'source-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Pack members with author+ access can upload files
CREATE POLICY "Authors can upload source files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'source-files'
  AND (storage.foldername(name))[1] IN (
    SELECT pm.pack_id::text FROM public.pack_members pm
    WHERE pm.user_id = auth.uid()
    AND pm.access_level IN ('author', 'admin', 'owner')
  )
);

-- RLS: Pack members can read source files
CREATE POLICY "Pack members can read source files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'source-files'
  AND (storage.foldername(name))[1] IN (
    SELECT pm.pack_id::text FROM public.pack_members pm
    WHERE pm.user_id = auth.uid()
  )
);

-- RLS: Authors can delete source files
CREATE POLICY "Authors can delete source files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'source-files'
  AND (storage.foldername(name))[1] IN (
    SELECT pm.pack_id::text FROM public.pack_members pm
    WHERE pm.user_id = auth.uid()
    AND pm.access_level IN ('author', 'admin', 'owner')
  )
);

-- Add 'url' to the valid source types
CREATE OR REPLACE FUNCTION public.validate_pack_source_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.source_type NOT IN (
    'github_repo', 'document', 'url',
    'confluence', 'notion', 'google_drive', 'sharepoint',
    'openapi_spec', 'postman_collection', 'jira', 'linear',
    'figma', 'slack_channel', 'loom_video', 'pagerduty'
  ) THEN
    RAISE EXCEPTION 'Invalid source_type: %', NEW.source_type;
  END IF;
  RETURN NEW;
END;
$function$;
