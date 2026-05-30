# Phase 5 — CI hard gates, migration hygiene, crons

- **mcp-smoke-test** no longer `continue-on-error` → a real MCP security regression now BLOCKS the PR.
- **New always-on gate** `.github/workflows/prod-hardening.yml` (no secrets required, so CI is
  never vacuously green):
  - `edge-unit-tests`: `deno test` over `supabase/functions/__tests__/` (incl. the new
    grounding-gate + faithfulness tests).
  - `frontend-gates`: `npm ci` → `typecheck` → `build` → `npm audit --audit-level=critical`.
  - `static-analysis`: `audit:edge`, `check:credentials`, `check:internal-auth` (promotes the
    existing security scripts into a blocking gate).
- **Crons**: `scripts/schedule-cron-jobs.sql` schedules `rollup-pack-quality-daily`,
  `lifecycle-retention-job`, and `process-staleness-queue` via pg_cron + pg_net (manual runbook,
  not an auto-migration since those extensions aren't universally present).
- **Migration hygiene policy**: `docs/MIGRATIONS.md`; rely on the existing `db-types-check`
  (`supabase db reset`) to keep a fresh install green.

Note: `rag-regression` still skips when its live-eval secrets are absent (it needs a real eval
env) — the new always-on gates ensure there is always a hard check regardless.
