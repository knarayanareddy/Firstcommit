# Cross-cutting acceptance (Required for backend/DB/edge/IDE/MCP)
- [ ] **AGENTS.md updated**: (“where to change what” / invariants)
- [ ] **Trust console updated**: (if metrics/schema changed)
- [ ] **Lifecycle controls safe**: (no dangerous purges/deletions)
- [ ] **Security review**: (RBAC, SSRF, no secret logs, output caps+redaction)
- [ ] **CI / Manual QA**: (verified via `scripts/mcp-smoke-test.ts` or `rag-eval`)

# Summary
<!-- What does this PR change? Keep it short. -->

# Screenshots / Demo
<!-- Optional -->

# Risk level
- [ ] Low (docs/tests only)
- [ ] Medium (new feature path)
- [ ] High (auth/RLS/tooling/Edge Function changes)

# MCP Security Review Checklist (Required for any changes under supabase/functions/rocketboard-mcp/)
## 1) AuthN / Token handling
- [ ] All MCP routes require `Authorization: Bearer …` (no anonymous access, no dev bypass in prod)
- [ ] Authorization headers/tokens are never logged or returned in errors
- [ ] JWT verification uses Supabase Auth (`auth.getUser()` or equivalent)
- [ ] PAT support (if enabled) verifies server-side and fails closed when not configured

## 2) AuthZ / Tenancy isolation (Most critical)
- [ ] Every tool/resource that accepts `pack_id` enforces server-side pack access (`has_pack_access`)
- [ ] No tool/resource supports “all packs” or cross-pack queries
- [ ] Verified cross-pack isolation:
  - [ ] user in Pack A cannot access Pack B via any tool/resource
  - [ ] user outside pack cannot access pack data

## 3) Input validation
- [ ] Zod (or strict schema) validation exists for every tool input
- [ ] Unknown keys are rejected (strict schemas)
- [ ] All string/int inputs are clamped (query length, context length, max_spans, etc.)
- [ ] Any path parameter is allowlisted and traversal-safe (`..`, `\`, null bytes rejected)

## 4) Output safety (prompt injection + secret leakage)
- [ ] Output redaction is applied to ALL returned text (tools + resources + errors)
- [ ] Output size caps exist and are enforced (truncate with marker)
- [ ] Tool outputs are data-oriented (no “instructional” text that could amplify prompt injection)

## 5) Tool safety (least privilege)
- [ ] No dangerous tools added (SQL exec, arbitrary URL fetch, arbitrary file read, env dump)
- [ ] Mutating tools are explicitly justified and rate-limited (e.g., report_content_gap)

## 6) Rate limiting / abuse controls
- [ ] Per-user rate limiting is enforced for tool calls
- [ ] Stricter limit exists for mutating tools (if present)

## 7) Audit logging
- [ ] MCP invocations are written to mcp_audit_events (hashes/metadata only)
- [ ] No raw secrets, tokens, or full responses are stored in audit logs

## 8) Runtime & transport safety
- [ ] Supabase Edge timeouts are respected (no long-idle SSE without keepalive)
- [ ] Error handling is generic (no stack traces to clients)

## 9) Tests / Verification
- [ ] `scripts/mcp-smoke-test.ts` passes locally against staging
- [ ] New tools have at least one test case added (unit or integration)
- [ ] CI updated to run MCP smoke test (or explicitly waived with reason)

# QA Steps Performed
<!-- Paste commands you ran and outcomes -->
- [ ] Local run: `supabase functions serve rocketboard-mcp`
- [ ] Smoke test: `node scripts/mcp-smoke-test.ts`
- [ ] Cross-pack authZ check performed
