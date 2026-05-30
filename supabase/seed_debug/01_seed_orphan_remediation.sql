-- Seed Script: Orphan Remediation
-- This script inserts a remediation row that cannot be linked to any pack.
-- This is used to test that the fix_remediation_pack_id migration handles orphans gracefully.

-- 1. Insert a dummy pack so we have at least one record in packs
INSERT INTO public.packs (id, title, description, org_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Pack', 'A pack for testing', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert an orphan remediation
INSERT INTO public.module_remediations (module_key, section_id, original_content, proposed_content, status)
VALUES ('orphan_module_key_999', 'intro', 'Old content', 'New content', 'pending');

-- 3. Insert a valid remediation (will be backfilled)
INSERT INTO public.generated_modules (pack_id, module_key, title, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'valid_module_key_123', 'Valid Module', 'draft')
ON CONFLICT DO NOTHING;

INSERT INTO public.module_remediations (module_key, section_id, original_content, proposed_content, status)
VALUES ('valid_module_key_123', 'summary', 'Old summary', 'New summary', 'pending');
