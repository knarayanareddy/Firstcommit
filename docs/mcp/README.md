# RocketBoard MCP Server

The `rocketboard-mcp` Supabase Edge Function implements a standards-compliant **MCP (Model Context Protocol) server** that exposes RocketBoard's evidence-grounded onboarding capabilities to MCP clients (Claude Code, Cursor, MCP Inspector, etc.).

It uses [mcp-lite](https://github.com/supabase/mcp-utils) on Supabase Edge Functions with Streamable HTTP transport.

---

## What It Does

- Search and retrieve grounded evidence from a pack's knowledge base
- Get AI-generated answers with full citation manifests
- Retrieve conventions files (AGENTS.md) and technical docs
- Report documentation gaps
- All operations are pack-scoped, JWT-authenticated, and audited

---

## Tools Reference

All tools require `Authorization: Bearer <supabase-jwt>`.

### `list_my_packs`
Returns all packs the authenticated user belongs to.

| Field | Type | Notes |
|---|---|---|
| *(no inputs)* | — | |

**Output:** `{ packs: [{ pack_id, title, description, org_id, access_level, updated_at }], total }`  
Cap: 200 packs

---

### `search_knowledge_base`
Hybrid semantic + keyword search over a pack's indexed content.

| Field | Type | Notes |
|---|---|---|
| `pack_id` | `uuid` | required |
| `query` | `string` | max 500 chars |
| `max_spans` | `int` | 1–20, default 10 |
| `module_key` | `string?` | optional context filter |
| `track_key` | `string?` | optional track filter |

**Output:** `{ spans: [{ span_id, chunk_id, path, start_line, end_line, snippet_preview, score, metadata }], total, truncated }`  
Note: `snippet_preview` is the first 1200 chars of the chunk, secrets redacted. Not the full chunk.

---

### `explain_with_evidence`
Grounded AI answer via the RocketBoard RAG pipeline. Returns citations and an evidence manifest.

| Field | Type | Notes |
|---|---|---|
| `pack_id` | `uuid` | required |
| `question` | `string` | max 2000 chars |
| `context` | `string?` | extra context, max 8000 chars |
| `detective_mode` | `boolean` | default `true` (multi-hop) |
| `max_spans` | `int` | 1–20, default 10 |
| `debug` | `boolean` | default `false`; `canonical_response` only returned if `true` AND caller is author |

**Output:**
```json
{
  "answer_markdown": "...",
  "evidence_manifest": {
    "citations": [{ "badge": "S1", "path": "...", "start_line": 1, "end_line": 20, "chunk_id": "..." }],
    "spans_used": [{ "chunk_id": "...", "path": "...", "start_line": 1, "end_line": 20 }]
  },
  "gate_outcome": { "passed": true, "reason": "ok" },
  "truncated": false
}
```

If the grounding gate fails, `gate_outcome.passed = false` and `answer_markdown` will contain a refusal message.

---

### `get_pack_conventions`
Returns the pack's `AGENTS.md` file stitched from indexed knowledge chunks.

| Field | Type |
|---|---|
| `pack_id` | `uuid` |

**Output:** `{ content: string, found: boolean, truncated: boolean }`  
Cap: 30k chars. Returns a fallback message if `AGENTS.md` is not indexed.

---

### `get_tech_docs_index`
Lists all technical document paths in the pack under the `Technical documents/` prefix.

| Field | Type |
|---|---|
| `pack_id` | `uuid` |

**Output:** `{ paths: string[], total: number }`

---

### `get_tech_doc`
Retrieves a specific technical document.

| Field | Type | Notes |
|---|---|---|
| `pack_id` | `uuid` | |
| `path` | `string` | Must start with `Technical documents/` |

**Output:** `{ content: string, found: boolean, truncated: boolean, path: string }`  
Cap: 50k chars. Path is validated server-side; traversal sequences are blocked.

---

### `report_content_gap`
Reports a missing or incorrect documentation item for pack owner review.

| Field | Type | Notes |
|---|---|---|
| `pack_id` | `uuid` | |
| `title` | `string` | max 200 chars |
| `description` | `string` | max 2000 chars |
| `file_path` | `string?` | optional, max 300 chars |
| `symbol` | `string?` | optional, max 200 chars |
| `severity` | `"low" \| "med" \| "high"` | default `"low"` |

Rate limited: **10 reports/day/pack**. Does not trigger auto-remediation in v0.

---

## Resource Tools

MCP resources are exposed as tools (mcp-lite resource API is evolving — documented as tools for now):

| Tool | Maps to URI |
|---|---|
| `get_resource_pack_agents` | `rocketboard://pack/<id>/agents` |
| `get_resource_techdocs_index` | `rocketboard://pack/<id>/techdocs/index` |
| `get_resource_techdoc` | `rocketboard://pack/<id>/techdocs/<name>` |

`get_resource_techdoc` takes `{ pack_id, name }` where `name` is the filename within `Technical documents/`.

---

## Running Locally

**Prerequisites:** Supabase CLI, Deno

```bash
# 1. Start local Supabase
supabase start

# 2. Apply the migration
supabase db push

# 3. Serve the MCP function (--no-verify-jwt for local dev)
supabase functions serve --no-verify-jwt rocketboard-mcp

# The MCP endpoint is now:
# http://localhost:54321/functions/v1/rocketboard-mcp/mcp
```

Health check:
```bash
curl http://localhost:54321/functions/v1/rocketboard-mcp/health
# → { "status": "ok", "timestamp": "..." }
```

Tool registry:
```bash
curl http://localhost:54321/functions/v1/rocketboard-mcp/registry
```

---

## Connecting Clients

### Claude Code (HTTP transport)
```bash
claude mcp add rocketboard \
  --transport http \
  http://localhost:54321/functions/v1/rocketboard-mcp/mcp \
  --header "Authorization: Bearer <your-supabase-jwt>"
```

### MCP Inspector
```bash
npx -y @modelcontextprotocol/inspector \
  http://localhost:54321/functions/v1/rocketboard-mcp/mcp
```
Set `Authorization: Bearer <token>` in the inspector's Headers panel.

### Cursor
Cursor supports Streamable HTTP transport. Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "rocketboard": {
      "url": "http://localhost:54321/functions/v1/rocketboard-mcp/mcp",
      "headers": {
        "Authorization": "Bearer <your-supabase-jwt>"
      }
    }
  }
}
```
> If your version of Cursor does not support custom headers, run a simple local relay that injects the `Authorization` header before proxying to the MCP endpoint.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | ✅ | — | Set by Supabase runtime |
| `SUPABASE_ANON_KEY` | ✅ | — | Set by Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | Set by Supabase runtime |
| `OPENAI_API_KEY` | ⚠️ optional | — | For semantic search embeddings; falls back to keyword-only |
| `MCP_RATE_LIMIT_PER_MIN` | optional | `60` | Read tool rate limit (per user, per minute, in-memory) |
| `MCP_EXPLAIN_RATE_LIMIT_PER_MIN` | optional | `20` | `explain_with_evidence` rate limit |

## Smoke Testing (Local & CI)

A strict smoke test suite (`scripts/mcp-smoke-test.ts`) is provided for verification. It executes the Minimal MCP Smoke-Test Spec (v0) asserting cross-pack isolation, AuthN rejections, output caps, redaction safety, and rate limits.

**Required Environment Variables for Smoke Test:**
| Variable | Required | Description |
|---|---|---|
| `MCP_EVAL_SUPABASE_URL` | ✅ | The base URL of the Supabase instance |
| `MCP_EVAL_ANON_KEY` | ✅ | The anon API key for Auth |
| `MCP_EVAL_USER_EMAIL` | ✅ | Test user's email |
| `MCP_EVAL_USER_PASSWORD` | ✅ | Test user's password |
| `MCP_EVAL_PACK_ID_ALLOWED` | ✅ | A Pack ID the user *has* access to |
| `MCP_EVAL_PACK_ID_FORBIDDEN`| ⚠️ optional | A Pack ID the user *lacks* access to (tests AuthZ rejection) |
| `MCP_EVAL_RUN_RATELIMIT_TEST`| ⚠️ optional | Set to "true" to run T8 Rate Limit hammering check |

**Running locally:**
```bash
# Provide environment variables (via .env or directly)
npx tsx scripts/mcp-smoke-test.ts
# or
deno run --allow-net --allow-env scripts/mcp-smoke-test.ts
```
