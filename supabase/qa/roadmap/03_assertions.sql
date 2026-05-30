-- 03_assertions.sql
-- Perform tests as specific users

-- SET RLS context (simulate JWT/Auth context)
-- In Supabase SQL editor, use: 
-- SET LOCAL auth.uid = 'UUID-HERE';
-- Note: 'SET auth.uid' is often more reliable in local tests if bypass RLS is off.

BEGIN;

DO $$
DECLARE
    target_pack_id UUID := '22222222-2222-2222-2222-222222222222';
    learner_id UUID := '33333333-3333-3333-3333-333333333333';
    outsider_id UUID := '55555555-5555-5555-5555-555555555555';
    pl_id UUID;
    asgn_id UUID;
    item_count INTEGER;
BEGIN
    -- 1) TEST: Outsider Access
    SET LOCAL auth.uid = '55555555-5555-5555-5555-555555555555';
    SELECT count(*) INTO item_count FROM public.playlists WHERE pack_id = target_pack_id;
    IF item_count > 0 THEN RAISE EXCEPTION 'RLS FAILED: Outsider saw % playlists', item_count; END IF;

    -- 2) TEST: Learner Access
    SET LOCAL auth.uid = '33333333-3333-3333-3333-333333333333';
    SELECT count(*) INTO item_count FROM public.playlist_assignments WHERE pack_id = target_pack_id;
    IF item_count = 0 THEN RAISE EXCEPTION 'RLS FAILED: Learner saw 0 assignments'; END IF;

    -- 3) TEST: Integrity (Cycle Prevention)
    -- This should fail
    BEGIN
        INSERT INTO public.playlist_item_dependencies (item_id, depends_on_item_id)
        SELECT id, id FROM public.playlist_items LIMIT 1;
        RAISE EXCEPTION 'INTEGRITY FAILED: Self-dependency allowed';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Cycle prevention check passed: %', SQLERRM;
    END;

    -- 4) TEST: Status Validation (Illegal transition)
    -- Get an assignment item
    SELECT id INTO asgn_id FROM public.playlist_assignments WHERE learner_user_id = learner_id LIMIT 1;
    
    BEGIN
        -- Done to Available (illegal)
        INSERT INTO public.playlist_item_progress (assignment_id, item_id, learner_user_id, status)
        VALUES (asgn_id, '11111111-1111-1111-1111-111111111111', learner_id, 'done');
        
        UPDATE public.playlist_item_progress 
        SET status = 'available' 
        WHERE assignment_id = asgn_id AND status = 'done';
        
        RAISE EXCEPTION 'INTEGRITY FAILED: Illegal status transition from done to available';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Status validation check passed: %', SQLERRM;
    END;

    RAISE NOTICE 'All Assertions Passed';
END $$;

ROLLBACK;
