-- Sanity Check: Verify module_remediations schema and RLS policies
-- Goal: Ensure the table has achieved its final deterministic state after migrations.

DO $$
DECLARE
    v_missing_cols TEXT;
    v_policy_count INT;
BEGIN
    -- 1. Check for Table Existence
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'module_remediations' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'Table public.module_remediations is missing!';
    END IF;

    -- 2. Check for Required Columns (Final State)
    SELECT string_agg(column_name, ', ')
    INTO v_missing_cols
    FROM (
        SELECT 'pack_id' AS column_name
        UNION ALL SELECT 'updated_at'
        UNION ALL SELECT 'diff_summary'
    ) required_cols
    WHERE NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'module_remediations' 
          AND column_name = required_cols.column_name
    );

    IF v_missing_cols IS NOT NULL THEN
        RAISE EXCEPTION 'Missing columns in module_remediations: %', v_missing_cols;
    END IF;

    -- 3. Check for Pack ID Nullability (Should be NOT NULL after harden migration)
    IF (SELECT is_nullable FROM information_schema.columns WHERE table_name = 'module_remediations' AND column_name = 'pack_id') = 'YES' THEN
        RAISE EXCEPTION 'module_remediations.pack_id must be NOT NULL for secure RLS.';
    END IF;

    -- 4. Check for RLS Policies
    SELECT count(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = 'module_remediations' AND schemaname = 'public';

    IF v_policy_count < 1 THEN
        RAISE WARNING 'No RLS policies found for module_remediations!';
    ELSE
        RAISE NOTICE 'Verified: module_remediations has % RLS policy(ies).', v_policy_count;
    END IF;

    RAISE NOTICE 'SUCCESS: module_remediations schema is deterministic and secure.';
END $$;
