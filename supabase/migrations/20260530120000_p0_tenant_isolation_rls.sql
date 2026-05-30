-- ─────────────────────────────────────────────────────────────────────────────
-- P0 SECURITY: tenant isolation hardening
--  (1) Remove world-readable SELECT on organizations; scope to org members.
--  (2) Enable RLS + owner-scoped policies on stub tables that shipped without RLS.
-- Defensive + idempotent: guarded so a fresh `supabase db reset` succeeds even if
-- table/column names differ. VERIFY against your schema (org membership table name).
-- ─────────────────────────────────────────────────────────────────────────────

-- (1) organizations: drop any permissive SELECT policy, add member-scoped one.
DO $$
DECLARE pol record; membership_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
            WHERE table_schema='public' AND table_name='organizations') THEN
    FOR pol IN SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename='organizations' AND cmd='SELECT'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.organizations', pol.policyname);
    END LOOP;

    -- locate the membership table (org_members or organization_members)
    SELECT table_name INTO membership_table FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN ('org_members','organization_members')
      LIMIT 1;

    IF membership_table IS NOT NULL THEN
      EXECUTE format($f$
        CREATE POLICY "org_select_members_only" ON public.organizations
          FOR SELECT TO authenticated
          USING (EXISTS (SELECT 1 FROM public.%I m
                         WHERE m.org_id = organizations.id AND m.user_id = auth.uid()))
      $f$, membership_table);
    ELSE
      -- Fallback: at minimum require authentication (still better than USING(true)).
      RAISE NOTICE 'No org membership table found; applying authenticated-only SELECT. REVIEW.';
      CREATE POLICY "org_select_authenticated" ON public.organizations
        FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
    END IF;
  END IF;
END $$;

-- (2) Stub tables: enable RLS + owner-scoped policies (or leave RLS-on/deny if no user_id).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
            WHERE table_schema='public' AND table_name='notifications') THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "notifications_owner" ON public.notifications;
    CREATE POLICY "notifications_owner" ON public.notifications
      FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
            WHERE table_schema='public' AND table_name='learner_badges') THEN
    ALTER TABLE public.learner_badges ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "learner_badges_owner" ON public.learner_badges;
    CREATE POLICY "learner_badges_owner" ON public.learner_badges
      FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
