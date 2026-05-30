# Required Secrets — Production Operations Guide

> **Rule: Never log secret values.** All runtime checks emit structured warnings
> with key _names_ only; values are never printed.

## Required Secrets

| Secret | Used By | What Breaks If Missing |
|--------|---------|------------------------|
| `SUPABASE_URL` | All Edge Functions (`_shared/supabase-clients.ts`, MCP, webhooks) | Every function crashes — cannot create Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service client creation, internal auth fallback (`_shared/authz.ts`) | DB writes fail; internal service-to-service auth broken |
| `SUPABASE_ANON_KEY` | Anonymous client creation (`_shared/supabase-clients.ts`, MCP) | User-facing queries fail |
| `ROCKETBOARD_INTERNAL_SECRET` | Internal service-to-service auth (`_shared/authz.ts`); webhook → check-staleness / auto-remediate calls | Webhook cannot trigger staleness pipeline; queue worker auth fails |
| `GITHUB_WEBHOOK_SECRET` | HMAC signature verification in `github-webhook` | Webhook accepts unsigned payloads — **security risk** |
| `OPENAI_API_KEY` | Embedding generation (`_shared/embedding-reuse.ts`); AI task router; MCP explain; auto-remediation | Embedding + LLM calls fail unless `LOVABLE_API_KEY` is set as fallback |
| `LOVABLE_API_KEY` | AI gateway proxy for task router, reranker, embeddings | Falls back to `OPENAI_API_KEY` / `GOOGLE_AI_API_KEY`; if none set, AI calls fail |

## Optional Secrets

| Secret | Used By | Notes |
|--------|---------|-------|
| `LANGFUSE_PUBLIC_KEY` | `_shared/telemetry.ts` | Observability tracing; degrades gracefully |
| `LANGFUSE_SECRET_KEY` | `_shared/telemetry.ts` | Required alongside public key |
| `LANGFUSE_BASE_URL` | `_shared/telemetry.ts` | Defaults to `https://cloud.langfuse.com` |
| `GITHUB_TOKEN` | `auto-remediate-module`, `reindex-orgs` | GitHub API access for diff fetching; remediation degrades |
| `GOOGLE_AI_API_KEY` | `retrieve-spans` | Google AI fallback for embeddings |
| `GOOGLE_CLIENT_ID` | `google-oauth-callback` | Google Drive OAuth; only needed if Drive ingestion is enabled |
| `GOOGLE_CLIENT_SECRET` | `google-oauth-callback` | Same as above |
| `GOOGLE_REDIRECT_URI` | `google-oauth-callback` | Same as above |
| `RESEND_API_KEY` | `send-email` | Transactional email; notifications degrade |
| `ALLOWED_ORIGINS` | `_shared/cors.ts` | Defaults to Lovable preview URLs if unset |
| `STRICT_CORS` | `_shared/cors.ts` | Set to `"true"` to reject non-allowlisted origins |

## Tuning Variables (not secrets)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MCP_RATE_LIMIT_PER_MIN` | `60` | MCP tool call rate limit |
| `MCP_EXPLAIN_RATE_LIMIT_PER_MIN` | `20` | MCP explain tool rate limit |
| `TRACE_SAMPLE_RATE` | `0.05` | Telemetry sampling (0.0–1.0) |
| `LANGFUSE_SAMPLE_RATE` | `1.0` | Langfuse trace sampling |
| `KG_EXPAND_LIMIT` | `12` | Knowledge graph expansion limit |
| `KG_MAX_SYMBOLS` | `20` | Max symbols in KG retrieval |
| `KG_MAX_TIME_MS` | `1500` | KG retrieval timeout |
| `MAX_CHUNKS_PER_PACK` | `50000` | Ingestion guard |
| `MAX_NEW_CHUNKS_PER_RUN` | `20000` | Ingestion guard per run |
| `ENABLE_AST_CHUNKING` | `"true"` | Set `"false"` to disable AST chunker |
| `INGEST_PACK_SERIALIZE` | `"true"` | Set `"false"` to allow parallel pack ingestion |

## Runtime Warnings

Edge Functions import `_shared/env-warnings.ts` which provides `warnIfMissingEnv()`.
This helper:

- Checks `Deno.env.get(name)` at call time
- Emits a structured `console.warn` **once per key per process** (deduped via module-level `Set`)
- **Never prints secret values** — only the key name and the calling context

Currently wired into:
- `github-webhook` — warns if `GITHUB_WEBHOOK_SECRET` or `ROCKETBOARD_INTERNAL_SECRET` missing
- `process-staleness-queue` — warns if `ROCKETBOARD_INTERNAL_SECRET` missing
- `auto-remediate-module` — warns if `OPENAI_API_KEY` and `LOVABLE_API_KEY` both missing

## How to Verify

### Local smoke test
```bash
# Start local Supabase
npx supabase start

# Trigger webhook (should warn about missing secrets in function logs)
curl -X POST http://localhost:54321/functions/v1/github-webhook \
  -H "Content-Type: application/json" \
  -H "x-github-event: push" \
  -d '{"repository":{"html_url":"https://github.com/test/test"}}'

# Run staleness queue (should warn if ROCKETBOARD_INTERNAL_SECRET not set)
curl -X POST http://localhost:54321/functions/v1/process-staleness-queue \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### CI validation
The `db-types-check` workflow runs `supabase db reset` + `npm run check:types`.
Secrets are injected via GitHub repo secrets; verify they are set in
**Settings → Secrets and variables → Actions**.
