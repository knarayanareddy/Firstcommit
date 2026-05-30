# RELEASE_CHECKLIST.md

This checklist ensures that all cross-cutting concerns are addressed before a PR is merged into the main branch.

## Scope
The Cross-cutting acceptance checklist is **MANDATORY** for any PR touching the following directories:
- `supabase/functions/` (Edge Functions)
- `supabase/migrations/` (DB Schema)
- `vscode-extension/` (IDE Integration)
- `docs/mcp/` or `supabase/functions/rocketboard-mcp/` (MCP Server/Tools)
- `src/lib/ai-client.ts` / `src/lib/envelope-builder.ts` (Core AI Contracts)

## Validation Requirements

### 1. AGENTS.md Update
If any architectural pattern, contract, or security invariant is changed, [AGENTS.md](../../AGENTS.md) must be updated to reflect the new state. This includes "Where to change what" mappings.

### 2. Trust Console & Observability
If the change adds new metrics or changes the ingestion/retrieval schema, verify that the Trust console (or relevant monitoring dashboards) still displays accurate rollups.

### 3. Lifecycle Controls
Ensure that your changes do not compromise data retention policies or introduce accidental massive purges. Check `supabase/qa/lifecycle/` for relevant safety checks.

### 4. Security Review
- **RBAC**: Every new Edge Function MUST check user authorization.
- **SSRF**: Use the shared URL policy for any external fetch.
- **No Secret Logs**: Never log tokens or decrypted keys.
- **MCP Safety**: Tools must have output caps and redaction.

### 5. Verified QA
Every PR must include proof of verification. Refer to the [QA_INDEX.md](./QA_INDEX.md) for available testing tools and harnesses.

## Approval Process
- **Security-sensitive changes**: (Auth, SSRF, RLS) require review from the AppSec champion.
- **Contract changes**: (RAG schema, MCP protocol) require review from the Platform Architect.
