-- Migration: 20260413000000_change_proposals.sql
-- Description: Creates the change_proposals table for GitHub PR Write-back v1.

CREATE TABLE IF NOT EXISTS public.change_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.pack_sources(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    proposal_type TEXT NOT NULL CHECK (proposal_type IN ('doc', 'code')),
    target_base_branch TEXT DEFAULT 'main',
    patch_unified TEXT NOT NULL,
    files JSONB NOT NULL DEFAULT '[]'::jsonb, -- list of {path, action}
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'pr_opened', 'rejected')),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    pr_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for performance and filtering
CREATE INDEX IF NOT EXISTS idx_change_proposals_pack_id ON public.change_proposals(pack_id);
CREATE INDEX IF NOT EXISTS idx_change_proposals_status ON public.change_proposals(status);

-- Security: Enable RLS
ALTER TABLE public.change_proposals ENABLE ROW LEVEL SECURITY;

-- 1. Selection: All pack members can view proposals in their pack
CREATE POLICY "Pack members can view proposals" 
ON public.change_proposals FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.pack_members
        WHERE pack_id = change_proposals.pack_id
        AND user_id = auth.uid()
    )
);

-- 2. Management: Authors and Admins can create, update, and delete proposals
CREATE POLICY "Authors can manage proposals" 
ON public.change_proposals FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.pack_members
        WHERE pack_id = change_proposals.pack_id
        AND user_id = auth.uid()
        AND access_level IN ('author', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.pack_members
        WHERE pack_id = change_proposals.pack_id
        AND user_id = auth.uid()
        AND access_level IN ('author', 'admin')
    )
);

-- Access control for Edge Functions (service_role)
GRANT ALL ON public.change_proposals TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.change_proposals TO authenticated;

-- Trigger for updating the updated_at timestamp
-- Note: handle_updated_at() is assumed to already exist from 20260409000000_lifecycle_minv1.sql
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_change_proposals_updated_at') THEN
            CREATE TRIGGER set_change_proposals_updated_at
            BEFORE UPDATE ON public.change_proposals
            FOR EACH ROW
            EXECUTE FUNCTION handle_updated_at();
        END IF;
    END IF;
END $$;
