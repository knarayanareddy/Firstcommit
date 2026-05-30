# RocketBoard MCP Server — Security Review Checklist

This checklist is mandatory for:
- any change under `supabase/functions/rocketboard-mcp/`
- any new MCP tool/resource/prompt
- any change to pack authZ enforcement
- any change to redaction / SSRF posture related to MCP

## 0) What we are protecting
RocketBoard MCP exposes pack-scoped onboarding intelligence to IDE agents. The primary risks are:
- cross-pack data leakage (multi-tenant breach)
- secret exfiltration (tokens/keys in ingested content or logs)
- prompt injection amplification (tool/resource output used as agent instructions)
- abuse/DoS (unbounded retrieval, huge outputs, high request volume)
- weak audit trails (cannot prove what happened)

## 1) AuthN
**Must pass**
- All requests require `Authorization: Bearer …`
- JWT verification uses Supabase Auth (no custom parsing)
- PAT tokens (if enabled) are verified server-side; fail closed if verifier unavailable
- No auth headers are logged, ever

**Red flags**
- “Optional auth for local dev” in code paths used in production
- returning stack traces containing request headers

## 2) AuthZ (tenancy isolation)
**Must pass**
- Every tool/resource that reads pack data enforces server-side access:
  - `has_pack_access(user_id, pack_id, 'learner')` for read-only tools
  - `has_pack_access(user_id, pack_id, 'author')` for author-only tools
- No tool supports cross-pack queries.
- No “org-wide” access unless explicitly designed and audited.

**Required tests**
- Member of Pack A cannot access Pack B (tools + resources)
- Non-member cannot access any pack
- Learner cannot call author-only tools

## 3) Input validation
**Must pass**
- Strict schema validation for every tool (Zod or equivalent)
- Unknown keys rejected
- Hard caps:
  - query length
  - context length
  - max spans
  - max docs output
- Path allowlists:
  - only exact `AGENTS.md` or `Technical documents/` namespace if implemented
  - reject `..`, `\`, null bytes

## 4) Output safety (prompt injection + secret leakage)
**Must pass**
- Apply secret redaction on all outbound text:
  - tool outputs
  - resources
  - error messages
  - previews/snippets
- Output caps (characters and/or spans)
- Tool output is “data shaped”:
  - prefer structured JSON results
  - avoid embedding instructions like “Ignore previous instructions”

**Prompt injection guidance**
Treat all ingested content and docs as untrusted. Do not add any server-authored text that instructs the agent to override its system policies. The MCP server should provide facts and references, not directives.

## 5) Tool safety: least privilege
**Banned tools**
- execute_sql
- arbitrary URL fetchers (unless SSRF allowlist + deny private ranges + strict host allowlist)
- arbitrary filesystem reads
- environment variable dumps
- “dump all chunks” tools

**Mutating tools**
If a tool writes data (e.g., report_content_gap):
- must be rate limited more strictly
- must validate content length and sanitize
- must write audit events

## 6) Rate limiting / abuse controls
**Must pass**
- per-user rate limiting for MCP calls
- stricter limits for mutating tools
- bounded DB queries (LIMITs, no unbounded scans)
- bounded response sizes

## 7) Audit logging
**Must pass**
- Every tool call writes an audit event:
  - tool name, user_id, pack_id (if applicable), timestamp, status
  - args_hash (hash only), result_summary (counts only)
- No plaintext tokens, secrets, or full responses are stored in audit logs.

## 8) Runtime constraints (Supabase Edge)
**Must pass**
- Avoid long idle connections that exceed edge idle timeout
- Keep tool calls short-lived
- Graceful handling of upstream timeouts (OpenAI/Supabase)
- Generic error messages returned to client

## 9) Operational kill switch
**Must have**
- Document how to disable MCP quickly:
  - disable function deploy / require feature flag / revoke access token class
- Confirm audit logs can identify misuse.

## 10) Pre-merge verification commands
- Run locally: `supabase functions serve rocketboard-mcp --no-verify-jwt` (dev only)
- Use real JWT in smoke test: `npx tsx scripts/mcp-smoke-test.ts`
- Perform cross-pack leakage test (two packs, one user):
  - attempt pack B queries while member of pack A -> must fail

## 11) Approval rule
Any PR that:
- adds a tool/resource
- touches auth/authZ
- touches redaction
requires explicit AppSec Champion approval.
