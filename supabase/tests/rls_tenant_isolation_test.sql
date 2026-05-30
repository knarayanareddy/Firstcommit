-- pgTAP regression: tenant isolation (Phase 3).
-- Run with: supabase test db   (requires the pgtap extension in the test DB)
-- Guards the P0 fixes from Phase 1 against regression.

BEGIN;
SELECT plan(6);

-- RLS must be enabled on the previously-unprotected stub tables.
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notifications'::regclass),
  'RLS enabled on notifications'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.learner_badges'::regclass),
  'RLS enabled on learner_badges'
);

-- organizations must NOT have a world-readable (USING true) SELECT policy.
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'organizations'
       AND cmd = 'SELECT' AND qual = 'true'),
  0,
  'no world-readable SELECT policy on organizations'
);

-- organizations must still have at least one (scoped) SELECT policy.
SELECT ok(
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'organizations' AND cmd = 'SELECT') >= 1,
  'organizations has a scoped SELECT policy'
);

-- BYOK key decryptor must not be executable by anon/authenticated.
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.get_decrypted_byok_key(uuid, text)', 'EXECUTE'),
  'get_decrypted_byok_key not executable by authenticated'
);

-- core tenant table has RLS.
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.knowledge_chunks'::regclass),
  'RLS enabled on knowledge_chunks'
);

SELECT * FROM finish();
ROLLBACK;
