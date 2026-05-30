# Production build — status index

Transformation of `rocketboard-ai-guide` into a production-grade, vendor-independent build.
All changes are additive / behavior-preserving; defaults reproduce prior behavior.

| Phase | Scope | State |
|------|-------|-------|
| 1 | Remove Lovable; P0 security (fail-closed BYOK, search_path, rotation, tenant RLS); real SSRF (DNS+CIDR) | ✅ shipped |
| 2 | Configurable embeddings (+ force-local); unify duplicate; Local provider in UI | ✅ shipped |
| 3 | Grounding + faithfulness unit tests; semantic faithfulness gate (default-off); RLS pgTAP; golden eval | ✅ shipped |
| 4 | Route lazy-loading; ErrorBoundary; query defaults; opt-in strict tsconfig | ✅ shipped |
| 5 | CI hard gates; migration hygiene policy; cron template | ✅ shipped (2 workflow YAMLs apply manually — token lacks `workflows` scope) |
| 6 | Self-host Docker (Ollama local LLM + frontend) | ✅ shipped |
| 7 | Apache AGE graph behind `KG_ENGINE=age` | ⚗️ opt-in / experimental (validate on live AGE) |

## Verify in your environment (not runnable in the build sandbox)
- `supabase db reset` (migrations incl. tenant-isolation RLS + edited BYOK functions)
- `deno test supabase/functions/__tests__/`  ·  `supabase test db` (pgTAP RLS)
- `npm ci && npm run build && npm run typecheck`  ·  `npm run typecheck:strict` (cleanup backlog)
- OAuth + email auth against your Supabase  ·  local Ollama chat/embedding round-trip
- Apply `.github/workflows/{mcp-smoke-test.yml, prod-hardening.yml}` from the bundle
- Confirm the org-membership table name used by `20260530120000_p0_tenant_isolation_rls.sql`

## Still recommended (need a local compiler / live DB to do safely)
- Split `ai-task-router/index.ts` (4,231 lines) into per-task handlers; extract `EvidenceSpan`
  to `types.ts`; then wire the faithfulness gate into the pipeline (patch in `docs/PHASE3_*`).
- Decompose `ModuleView.tsx` (1,485 lines).
- Swap vulnerable `xlsx@0.18.5` for the maintained SheetJS CDN build or `exceljs`.
- Finish the `*_age` RPC variants and validate on a live AGE instance.
