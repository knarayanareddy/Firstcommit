-- 02_seed.sql
-- Run as SERVICE_ROLE or ADMIN

DO $$
DECLARE
    target_pack_id UUID := '22222222-2222-2222-2222-222222222222';
    author_id UUID := '44444444-4444-4444-4444-444444444444';
    target_learner_id UUID := '33333333-3333-3333-3333-333333333333';
    pl_id UUID;
    item1_id UUID;
    item2_id UUID;
    asgn_id UUID;
BEGIN
    -- Create Playlist
    INSERT INTO public.playlists (pack_id, title, phase, created_by, owner_user_id)
    VALUES (target_pack_id, 'QA Roadmap', 'day_1_30', author_id, author_id)
    RETURNING id INTO pl_id;

    -- Create Items
    INSERT INTO public.playlist_items (playlist_id, title, item_type, sort_order)
    VALUES 
        (pl_id, 'Prerequisite Task', 'task', 10),
        (pl_id, 'Dependent Task', 'task', 20)
    RETURNING id INTO item1_id; -- Note: This returns only first ID usually in PL/pgSQL simple INTO
    -- Let's re-query IDs
    SELECT id INTO item1_id FROM public.playlist_items WHERE playlist_id = pl_id AND title = 'Prerequisite Task';
    SELECT id INTO item2_id FROM public.playlist_items WHERE playlist_id = pl_id AND title = 'Dependent Task';

    -- Create Dependency (item2 depends on item1)
    INSERT INTO public.playlist_item_dependencies (item_id, depends_on_item_id)
    VALUES (item2_id, item1_id);

    -- Create Assignment for Learner
    INSERT INTO public.playlist_assignments (pack_id, playlist_id, learner_user_id, assigned_by)
    VALUES (target_pack_id, pl_id, target_learner_id, author_id)
    RETURNING id INTO asgn_id;

    RAISE NOTICE 'Seed complete: Playlist %, Assignment %', pl_id, asgn_id;
END $$;
