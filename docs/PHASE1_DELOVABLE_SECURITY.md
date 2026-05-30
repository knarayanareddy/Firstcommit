# Phase 1 — Vendor Independence (de-Lovable) + P0 Security

This branch/repo is the production-hardening fork of `rocketboard-ai-guide`. Phase 1
removes all Lovable platform coupling and fixes the P0 security findings, while
**preserving behavior and the interaction schema** (envelope contract, citation/span
model, DB schema, API shapes).

## What changed

### A. Vendor independence (no Lovable)
- **Auth:** replaced `@lovable.dev/cloud-auth-js` with native `supabase.auth.signInWithOAuth`
  (`src/integrations/auth/index.ts`; `src/integrations/lovable/` deleted; `AuthPage.tsx` updated).
- **Build:** removed `lovable-tagger` from `vite.config.ts` and `@lovable.dev/cloud-auth-js`
  + `lovable-tagger` from `package.json`.
- **Inference gateway removed:** every `ai.gateway.lovable.dev` call and `LOVABLE_API_KEY`
  read in the edge functions (`ai-task-router`, `reranker`, `retrieve-spans`,
  `embedding-reuse`, `auto-remediate-module`, `module-chat`, `ingest-url`,
  `rocketboard-mcp/tools/*`) now routes to a configurable **local/BYOK** endpoint
  (`LOCAL_LLM_BASE_URL`, default `http://ollama:11434/v1`). `LOVABLE_API_KEY` → `LOCAL_LLM_API_KEY`.
- **Provider default:** `PLATFORM_DEFAULT` and `PROVIDER_ENDPOINTS.default` now point at the
  self-hosted local LLM instead of the Lovable gateway. BYOK (12 providers) unchanged.
- **CORS:** removed the unconditional `isLovableOrigin()` allow; origins come only from `ALLOWED_ORIGINS`.
- **Branding:** `index.html` + email/help strings rebranded to RocketBoard.

### B. P0 security
- **BYOK encryption fail-closed:** removed the hard-coded `dev-fallback-passphrase-change-in-prod`.
  `save_byok_key` / `get_decrypted_byok_key` now `RAISE EXCEPTION` if
  `app.byok_encryption_passphrase` is unset/<16 chars (`20260315200000_user_ai_settings.sql`).
- **search_path hardening:** all BYOK `SECURITY DEFINER` functions now set
  `search_path = public, extensions, pg_temp`.
- **Key rotation:** added `rotate_byok_passphrase(old, new)` (service-role only).
- **Tenant isolation:** new migration `20260530120000_p0_tenant_isolation_rls.sql` removes the
  world-readable `organizations` SELECT (`USING (true)`) and scopes it to org members;
  enables RLS + owner policies on the `notifications` / `learner_badges` stub tables.
  (Defensive/guarded so a fresh `db reset` succeeds; VERIFY org-membership table name.)

### C. SSRF guard (real)
- `_shared/external-url-policy.ts` rewritten: the `PRIVATE_CIDR_V4/V6` lists are now used for
  **real CIDR containment**; `safeFetch` **resolves DNS and validates every resolved IP**
  (defeats DNS-rebinding to metadata/private ranges) and re-validates on each redirect.
- Configurable local allowlist (`LOCAL_LLM_HOST`, `ALLOW_PRIVATE_OLLAMA`) permits the
  self-hosted LLM (incl. `http`) without a blanket private-network bypass.
- `callAI`'s endpoint allowlist updated: removed the gateway host, added the missing BYOK
  provider hosts (x.ai, deepseek, fireworks, together, sambanova, cerebras), and permits the
  local host.

## New / changed env (see `.env.example`)
`LOCAL_LLM_BASE_URL`, `DEFAULT_LLM_MODEL`, `OLLAMA_MODEL`, `LOCAL_LLM_API_KEY`,
`LOCAL_LLM_HOST`, `ALLOW_PRIVATE_OLLAMA`, `BYOK_ENCRYPTION_PASSPHRASE` (now **required**),
`ALLOWED_ORIGINS`.

## Verification status
**Verified in the build sandbox:** `package.json` valid & free of Lovable deps; zero Lovable
runtime references remain; fallback passphrase removed; `search_path` applied; all JSON parses.

**Must be verified in your environment (no Deno/Supabase/Ollama in the build sandbox):**
- [ ] `supabase db reset` succeeds (new RLS migration + edited BYOK functions).
- [ ] `deno check` / edge-function tests pass.
- [ ] `npm install && npm run build && npm run typecheck` (frontend).
- [ ] OAuth + email auth work against your Supabase project.
- [ ] Local LLM round-trip via Ollama (`ENABLE_OLLAMA_FALLBACK`/`LOCAL_LLM_*`).
- [ ] Confirm the org-membership table name used by the RLS migration matches your schema.

## Not yet done (later phases)
Embedding-dim configurability + local-embeddings migration (Phase 2), RLS/grounding test
suites + semantic faithfulness gate (Phase 3), TS strict + monolith split + lazy routes
(Phase 4), CI hard gates + migration hygiene + crons (Phase 5), self-host Docker bundle +
Ollama (Phase 6), optional Apache AGE graph (Phase 7). See the master transformation plan.
