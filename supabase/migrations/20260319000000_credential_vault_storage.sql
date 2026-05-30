-- ============================================================
-- Migration: Credential Storage Hardening via Supabase Vault
-- ============================================================

-- Enable the vault extension if it doesn't exist
-- CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault;

-- 1. Create the pack_source_credentials table
-- This table stores REFERENCES to Vault secrets, not the secrets themselves.
CREATE TABLE IF NOT EXISTS public.pack_source_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_source_id UUID NOT NULL REFERENCES public.pack_sources(id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL DEFAULT 'api_token',
    -- ^^ e.g., 'api_token', 'oauth_refresh_token', 'personal_access_token', 'bot_token'
    vault_secret_id UUID NOT NULL,
    -- ^^ This is the UUID returned by vault.create_secret()
    label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Each source should have at most one credential per type
    UNIQUE(pack_source_id, credential_type)
);

-- Index for fast lookups by source
CREATE INDEX IF NOT EXISTS idx_psc_pack_source_id ON public.pack_source_credentials(pack_source_id);

-- Enable RLS (locked down by default)
ALTER TABLE public.pack_source_credentials ENABLE ROW LEVEL SECURITY;

/*
-- 2. Create the SECURITY DEFINER wrapper functions
-- (Commented out locally due to missing vault extension)

-- FUNCTION: store_source_credential
CREATE OR REPLACE FUNCTION public.store_source_credential(
    p_pack_source_id UUID,
    p_credential_type TEXT,
    p_secret_value TEXT,
    p_label TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN NULL;
END;
$$;

-- FUNCTION: read_source_credential
CREATE OR REPLACE FUNCTION public.read_source_credential(
    p_pack_source_id UUID,
    p_credential_type TEXT DEFAULT 'api_token'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN NULL;
END;
$$;

-- FUNCTION: delete_source_credential
CREATE OR REPLACE FUNCTION public.delete_source_credential(
    p_pack_source_id UUID,
    p_credential_type TEXT DEFAULT 'api_token'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN FALSE;
END;
$$;

-- 3. Lock down function permissions
REVOKE ALL ON FUNCTION public.store_source_credential(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.read_source_credential(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_source_credential(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.store_source_credential(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_source_credential(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_source_credential(UUID, TEXT) TO service_role;
*/

-- 4. Create the SAFE view for pack_sources
-- This view filters out sensitive fields from source_config
CREATE OR REPLACE VIEW public.pack_sources_safe AS
SELECT
    id,
    pack_id,
    source_type,
    source_uri,
    label,
    -- Include ONLY non-sensitive config fields
    jsonb_build_object(
        'repo_owner', source_config->>'repo_owner',
        'repo_name', source_config->>'repo_name',
        'org', source_config->>'org',
        'space_key', source_config->>'space_key',
        'project_id', source_config->>'project_id',
        'database_id', source_config->>'database_id',
        'channel', source_config->>'channel',
        'team_id', source_config->>'team_id',
        'folder_id', source_config->>'folder_id',
        'file_filters', source_config->'file_filters',
        'branch', source_config->>'branch',
        'sync_schedule', source_config->>'sync_schedule',
        'base_url', source_config->>'base_url',
        'auth_email', source_config->>'auth_email',
        'root_page_id', source_config->>'root_page_id',
        'auth_method', source_config->>'auth_method',
        'site_url', source_config->>'site_url',
        'document_library', source_config->>'document_library',
        'tenant_id', source_config->>'tenant_id',
        'client_id', source_config->>'client_id',
        'project_key', source_config->>'project_key',
        'max_issues', source_config->'max_issues',
        'include_epics', source_config->'include_epics',
        'include_recent', source_config->'include_recent',
        'include_comments', source_config->'include_comments',
        'include_resolved', source_config->'include_resolved',
        'spec_url', source_config->>'spec_url',
        'include_components', source_config->'include_components',
        'include_layer_structure', source_config->'include_layer_structure',
        'channel_ids', source_config->'channel_ids',
        'days_back', source_config->'days_back',
        'threaded_only', source_config->'threaded_only',
        'pinned_only', source_config->'pinned_only',
        'min_reactions', source_config->'min_reactions',
        'workspace_id', source_config->>'workspace_id',
        'video_title', source_config->>'video_title'
    ) AS source_config,
    weight,
    last_synced_at,
    created_at
FROM public.pack_sources;

GRANT SELECT ON public.pack_sources_safe TO authenticated;
GRANT SELECT ON public.pack_sources_safe TO service_role;
