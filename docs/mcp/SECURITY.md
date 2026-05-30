# RocketBoard MCP Server — Security Model

> **Note to Approvers**: Every PR modifying this server or adding tools MUST pass the [MCP Security Review Checklist](SECURITY_REVIEW.md).

## Threat Model

The RocketBoard MCP server is exposed to AI agents and developer tools. The primary threats we design against:

| Threat | Risk | Mitigation |
|---|---|---|
| **Prompt injection** | Malicious tool outputs that instruct the AI agent to take harmful actions | Tool outputs are "data only" — structured JSON. All free-text outputs are redacted and capped. |
| **Exfiltration** | Tool returns sensitive data (secrets, credentials, cross-user content) | No "read anything" tool. All outputs redacted via `secret-patterns.ts`. No connector secrets, Vault keys, or PATs are ever returned. |
| **Cross-tenant leakage** | User A reads User B's pack data | Every tool call with a `pack_id` runs a server-side `has_pack_access` check via `service_role` — never trusts client claims. |
| **DoS / abuse** | Flooding the server with expensive RAG calls | In-memory rate limiter (60 req/min for read tools, 20/min for explain, 10/day for report_content_gap). |
| **Path traversal** | User-supplied paths reading arbitrary files | `validatePath()` enforces allowlist prefixes (`AGENTS.md`, `Technical documents/`), blocks `..`, `\`, null bytes. |
| **Secret leakage in outputs** | Knowledge chunks may contain secrets despite ingestion redaction | All tool outputs (previews, stitched docs, answer markdown) are run through `redactText()` from `_shared/secret-patterns.ts` as defense-in-depth. |
| **Token logging** | JWT or PAT appearing in server logs | `auth.ts` never logs token values. Only masked user_id and authType are logged. |

---

## Authentication

**Required for all requests:** `Authorization: Bearer <token>`

### JWT Flow (supported)
1. MCP client sends `Authorization: Bearer <supabase-jwt>`
2. Server creates anon Supabase client with that token and calls `auth.getUser()`
3. If valid, `user.id` is the authenticated identity for all subsequent checks
4. If invalid, server returns `401 Unauthorized` (no detail about why)

### PAT Flow (stub — not yet wired)
- Tokens prefixed with `rb_pat_` return a safe `401 PAT auth not configured`
- No hints about PAT infrastructure are exposed

---

## Authorization (Pack RBAC)

Every tool that touches pack data requires the user to be a pack member at the required level:

| Tool | Required Level |
|---|---|
| `list_my_packs` | None (user-scoped) |
| `search_knowledge_base` | `learner` |
| `explain_with_evidence` | `learner` |
| `get_pack_conventions` | `learner` |
| `get_tech_docs_index` | `learner` |
| `get_tech_doc` | `learner` |
| `report_content_gap` | `learner` |
| All resource tools | `learner` |

Authorization checks use the `service_role` (bypass RLS) to call `has_pack_access` RPC. If the RPC is unavailable, a fallback `pack_members` join is used (mirrors the pattern in `retrieve-spans`).

---

## Tool Permission Philosophy

**Least-privilege toolset:**
- No tool allows arbitrary SQL execution
- No tool allows arbitrary URL fetching
- No tool allows reading files outside `AGENTS.md` or `Technical documents/`
- No tool returns connector credentials, Vault secrets, or OAuth tokens
- The only mutating tool (`report_content_gap`) inserts into a single user-scoped table and does not trigger downstream actions

**Dangerous tools we intentionally omit:**
- ❌ `execute_sql` — arbitrary data exfiltration risk
- ❌ `fetch_url` — SSRF and exfiltration risk
- ❌ `read_file` — arbitrary file read risk
- ❌ `get_connector_config` — credential exposure risk

---

## Prompt Injection Mitigations

MCP server outputs can be fed back into an AI agent's context. To reduce prompt injection risk:

1. **Structured JSON outputs** — tools return JSON objects, not free-form instructive text
2. **Secrets redacted** — `redactText()` runs on all free-text fields before return
3. **Hard output caps** — protects against padding attacks that try to overflow the agent's context with injected instructions
4. **No tool augments other tool outputs** — each tool is independent; MCP clients compose

Clients should treat all tool outputs as **untrusted content** from an external data source.

---

## Logging and Redaction Rules

| What | Rule |
|---|---|
| `Authorization` header value | **Never logged** |
| JWT or PAT token | **Never logged** |
| Tool args (raw) | **Never stored** — only `sha256(canonical_json(args))` in `mcp_audit_events` |
| Tool outputs (raw) | **Never stored** — only count summaries in `result_summary` |
| Errors to clients | Generic only (`"Internal server error"`) — no stack traces, no internal paths |
| User ID in logs | Masked (first 8 chars + `…`) |

---

## Audit Trail

Every tool invocation writes to `mcp_audit_events`:

```
user_id, pack_id, tool_name, request_id, args_hash, result_summary, status, error_code
```

RLS ensures:
- Pack authors can query audit events for their packs
- Users can view their own no-pack-id events (e.g. `list_my_packs`)
- Inserts are service_role only (Edge Function)
- No UPDATE/DELETE for authenticated users

---

## Rate Limits

| Tool / Group | Limit |
|---|---|
| Most read tools | 60 requests / user / minute (in-memory) |
| `explain_with_evidence` | 20 requests / user / minute (in-memory) |
| `report_content_gap` | 10 requests / user / pack / day (DB-backed) |

Rate limit errors return HTTP 429 with `{ "error": "Too many requests", "code": "rate_limited" }`.

---

## Incident Response

### Revoke a user's access immediately
1. Invalidate their session in Supabase Auth: `supabase auth admin sign-out <user-id>`
2. Remove them from `pack_members` if pack-level revocation is needed

### Disable the MCP function entirely
```bash
supabase functions delete rocketboard-mcp
```
Or navigate to Functions dashboard and disable.

### Review audit logs for a user
```sql
SELECT * FROM mcp_audit_events
WHERE user_id = '<user-uuid>'
ORDER BY created_at DESC
LIMIT 100;
```

### Review audit logs for a pack
```sql
SELECT tool_name, status, error_code, result_summary, created_at
FROM mcp_audit_events
WHERE pack_id = '<pack-uuid>'
ORDER BY created_at DESC
LIMIT 200;
```

### Check for rate-limited users
```sql
SELECT user_id, COUNT(*) as calls, MAX(created_at) as last_call
FROM mcp_audit_events
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY user_id
ORDER BY calls DESC;
```
