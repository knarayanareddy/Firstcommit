-- Update source_type validation to include new integrations
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
    'figma', 'slack_channel', 'loom_video'
  ) THEN
    RAISE EXCEPTION 'Invalid source_type: %', NEW.source_type;
  END IF;
  RETURN NEW;
END;
$function$;

-- Add source_config column if not exists
ALTER TABLE pack_sources ADD COLUMN IF NOT EXISTS source_config jsonb DEFAULT '{}'::jsonb;

-- Create integration_credentials table for secure credential storage
CREATE TABLE IF NOT EXISTS integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  credentials_encrypted text NOT NULL,
  label text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider, label)
);

-- Create validation trigger for provider
CREATE OR REPLACE FUNCTION public.validate_integration_provider()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.provider NOT IN (
    'confluence', 'notion', 'google', 'microsoft', 'github',
    'jira', 'linear', 'figma', 'slack', 'loom'
  ) THEN
    RAISE EXCEPTION 'Invalid integration provider: %', NEW.provider;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_integration_provider_trigger
  BEFORE INSERT OR UPDATE ON integration_credentials
  FOR EACH ROW EXECUTE FUNCTION validate_integration_provider();

-- Update timestamp trigger
CREATE TRIGGER integration_credentials_updated_at
  BEFORE UPDATE ON integration_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies: org admins only can manage credentials
CREATE POLICY "Org admins can view credentials"
  ON integration_credentials FOR SELECT
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can insert credentials"
  ON integration_credentials FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update credentials"
  ON integration_credentials FOR UPDATE
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can delete credentials"
  ON integration_credentials FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));