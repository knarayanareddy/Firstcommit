-- Migration: Seed Orphan Data for Testing
-- This ensures that during a db reset, we have problematic data before the hardening migration runs.

DO $$
BEGIN
    -- 1. Insert an orphan remediation (no matching pack/module)
    INSERT INTO public.module_remediations (module_key, section_id, original_content, proposed_content, status)
    VALUES ('orphan_module_key_999', 'intro', 'Old content', 'New content', 'pending');

    -- 2. Insert a valid remediation (will be backfilled later)
    -- We need a pack first
    INSERT INTO public.packs (id, title, description, org_id)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Test Pack', 'A pack for testing', '00000000-0000-0000-0000-000000000001')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.generated_modules (pack_id, module_key, title, status)
    VALUES ('00000000-0000-0000-0000-000000000001', 'valid_module_key_123', 'Valid Module', 'draft')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.module_remediations (module_key, section_id, original_content, proposed_content, status)
    VALUES ('valid_module_key_123', 'summary', 'Old summary', 'New summary', 'pending');
END $$;
