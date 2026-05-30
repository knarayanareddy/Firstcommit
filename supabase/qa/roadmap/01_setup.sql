-- 01_setup.sql
-- Run as SERVICE_ROLE or ADMIN

-- 1) Replace these with real UUIDs from auth.users if needed
-- For manual SQL Editor testing, you can invent UUIDs if RLS functions 
-- like has_pack_access() only check public.pack_members (which they usually do).

DO $$ 
DECLARE
    pack_id UUID := '22222222-2222-2222-2222-222222222222';
    learner_id UUID := '33333333-3333-3333-3333-333333333333';
    author_id UUID := '44444444-4444-4444-4444-444444444444';
    outsider_id UUID := '55555555-5555-5555-5555-555555555555';
BEGIN
    -- Cleanup previous test run
    DELETE FROM public.pack_members WHERE pack_id = pack_id;
    DELETE FROM public.packs WHERE id = pack_id;

    -- Create Test Pack
    INSERT INTO public.packs (id, title, roadmap_enabled)
    VALUES (pack_id, 'QA Test Pack', TRUE);

    -- Setup Memberships
    INSERT INTO public.pack_members (pack_id, user_id, access_level)
    VALUES 
        (pack_id, learner_id, 'learner'),
        (pack_id, author_id, 'author');

    RAISE NOTICE 'Setup complete: Pack %, Learner %, Author %, Outsider %', pack_id, learner_id, author_id, outsider_id;
END $$;
