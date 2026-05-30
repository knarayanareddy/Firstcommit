# Migration hygiene policy

The original repo accumulated 157 migrations in ~2 months (53% UUID-named, no rollbacks, a
`historical_stubs.sql` placeholder, the search RPC dropped/recreated ~8×). Going forward:

1. **Descriptive names**: `YYYYMMDDHHMMSS_short_description.sql` (no bare UUID names).
2. **Idempotent**: `CREATE ... IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`
   before `CREATE POLICY`. A fresh `supabase db reset` MUST succeed (the `db-types-check`
   workflow enforces this — keep it green).
3. **Forward-only with documented rollback**: include a `-- ROLLBACK:` comment block.
4. **No destructive schema change in the default path** (e.g. embedding-dim resize lives in
   `scripts/switch-embeddings-to-local.sql`, not migrations).
5. **One concern per migration**; don't redefine the same function across many files — edit in place.
6. **Security-definer functions** must `SET search_path`.

CI: `db-types-check` runs `supabase db reset` + type generation on every migration change.
