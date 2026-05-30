# AGENTS.md — Read This First (AI Coding Agents)

This repo powers RocketBoard’s onboarding + grounded AI system (React frontend + Supabase Postgres/RLS + Edge Functions for ingestion/retrieval/generation).

This document is **operational guardrails** for AI agents making changes. It is not a replacement for README; it’s the “don’t break the platform” checklist.

## 0) Core principle: the system is contract-driven
RocketBoard relies on strict contracts between:
- ingestion → `knowledge_chunks` schema
- retrieval → evidence spans with stable `path + line_start/line_end + chunk_id`
- generation → canonical citations + snippet placeholders
- UI → citation badges `[S#]` backed by `source_map` / referenced spans

If you change any contract, update **both** the producer and consumer, plus migrations if needed.

---

## 1) Non-negotiable invariants (DO NOT BREAK)

### 1.1 RAG invariants (groundedness + citations)
**Canonical citation format (required):**
- Canonical citations in model output must remain:
  - `[SOURCE: <filepath>:<start>-<end>]`
- Router post-processing converts canonical citations into UI badges `[S1]`, `[S2]`, etc.

**Snippet contract (required):**
- The model must not output raw repo code blocks.
- Repo code must be requested using snippet placeholders:
  - `[SNIPPET: <filepath>:<start>-<end> | lang=<lang>]`
- Server hydrates snippets from evidence spans and emits code fences with a `// SOURCE:` header.

**Ordering is important (do not reorder):**
1) enforce “no direct repo code”
2) verify claims / strip uncited technical claims
3) hydrate snippets
4) canonicalize citations → UI badges + source map

**Bounded inputs/outputs (required):**
- Evidence span count and total evidence text must remain capped.
- Conversation history must remain capped.
- Author instructions must be capped.
(These are cost + safety controls.)

**Grounding SLO Gate (required):**
- All router responses MUST pass the Grounding SLO Gate evaluation.
- Default thresholds: `min_score: 0.80`, `max_strip_rate: 0.20`.
- If a response fails, the router must retry (up to 3x) or refuse with `insufficient_evidence`.
- This ensures only verified, grounded claims reach the user.

### 1.2 Security invariants (SSRF, secrets, credentials)
**SSRF policy is mandatory for any external fetch:**
- Any URL derived from `pack_sources.config`, user input, or connector config must be validated by the shared URL policy before `fetch()`.
- Reject:
  - non-http(s) schemes
  - localhost / loopback
  - link-local / metadata IP ranges
  - private IP ranges
  - raw IP literals (unless explicitly allowlisted)
  - non-standard ports (unless explicitly allowlisted)

**Secrets: single source of truth**
- Secret detection/redaction patterns must be centralized in `supabase/functions/_shared/secret-patterns.ts`.
- Ingestion redaction is the primary gate; router redaction is defense-in-depth.

**Credentials must never be stored in PostgREST-readable columns**
- Do not store raw tokens or refresh tokens in `pack_sources.config`.
- Use Vault/RPC-based credential storage via `supabase/functions/_shared/credentials.ts`.
- Never return decrypted keys to the browser.

**No secret logging**
- Never log env var values, tokens, OAuth codes, Authorization headers, or decrypted BYOK keys.
- Error messages returned to clients must be generic.

### 1.3 Data integrity invariants (generations, locks, cleanup, dedupe)
**Generation pinning**
- Ingestion/reindex writes chunks with a `generation_id` or `job_id`.
- Only one active generation per pack (via `pack_active_generation`).
- Ensure concurrency is serialized via `supabase/migrations/20260325000000_job_locks.sql` (Concurrency Lease Locks).

**No concurrent generation writers**
- Always acquire the pack-level ingestion/reindex lock before:
  - writing chunks for a new generation
  - flipping `pack_active_generation`
  - deleting old generations

**Cleanup on failure**
- If ingestion fails mid-run, delete partial writes for that `ingestion_job_id`.

**Dedupe + embedding reuse**
- `content_hash` (SHA256) must be computed consistently across ingestion paths.
- If an identical chunk existed in a previous run, reuse its embedding via `supabase/functions/_shared/embedding-reuse.ts`.

**Data Lifecycle Invariants**
- Purge must be scoped to `(pack_id, source_id)`. Never delete across packs.
- Every manual or automated deletion must record a row in `lifecycle_audit_events`.
- Do not delete Vault credentials during source purge.
- Retention cleanup must respect the `legal_hold` flag.

### 1.4 MCP Server invariants (mcp-lite)
**Least Privilege Tools:**
- Do not add tools that fetch arbitrary URLs, execute SQL, or read arbitrary files anywhere on disk.
- Any new tool must have:
  - strict `zod` input validation
  - pack access check via `service_role` (policy.ts)
  - output redaction (`redactAndCap` from redaction.ts)
  - explicit output size caps (to prevent agent context overflow)
  - rate limiting (`checkRateLimit`)
  - an audit log entry (`writeMcpAudit`)

**Search Security:**
- Search RPCs (`hybrid_search_v2`, `definition_search_v1`) are restricted to `service_role`.
- Do not call these RPCs directly from the browser; always use the `retrieve-spans` Edge Function abstraction.
- This ensures centralized audit logging, server-side redaction, and protection against direct Row Level Security bypass attempts.

**Knowledge Chunk Fetching:**
- **Centralized Wrapper Required**: Application code must NOT call `.from("knowledge_chunks").eq("chunk_id", ...)` directly.
- Use the centralized library in `src/lib/knowledgeChunks.ts` for all `knowledge_chunks` lookups:
  - `fetchKnowledgeChunkByPK` for primary key lookups.
  - `fetchKnowledgeChunkByStableId` for stable ID lookups.
  - `batchFetchKnowledgeChunks` for multi-ref lookups.
- This ensures consistent identifier handling and prevents accidental branding of invalid strings.

**Prompt Injection Defense:**
- Outputs must be "data only" (JSON). Never return instructive text like "ignore instructions".

**Resource Handlers:**
- Exposed as Tools via pattern `rocketboard://pack/<id>/...` until mcp-lite stabilizes its resource API. Ensure these use the exact same validation as other tools.

### 1.5 Identifier Contract (Evidence Spans)
RocketBoard uses a triple-identifier strategy to ensure UI stability across database re-ingestions:
- **`chunk_pk`** (UUID): The exact database row primary key (`knowledge_chunks.id`). Use this for uniqueness and deduplication in the same session.
- **`stable_chunk_id`** (TEXT): The business-stable ID (`knowledge_chunks.chunk_id`, e.g., "C00001"). Use this for long-lived features (bookmarks, playlists) that must survive a re-ingestion where the UUID PK changes.
- **`chunk_ref`** (Union): The primary UI lookup key. It is a TEXT field that may contain either a UUID or a stable Business ID.

**Non-negotiable Contract Rules**:
1. **Producer Guarantee**: [retrieve-spans/index.ts](file:///c:/first%20commit/rocketboard-ai-guide/supabase/functions/retrieve-spans/index.ts) and the AI Router MUST explicitly emit all three fields.
2. **Ambiguity Ban**: The property name `chunk_id` must NEVER be used to carry a UUID in TypeScript/API payloads. If it exists in a payload, it must exclusively contain a stable TEXT identifier or `null` for backward compatibility.
3. **UI Resilience**: All UI components must use `normalizeChunkRef` from `src/types/evidence.ts` when processing identifiers from chat history or external inputs.
4. **Type Safety (Branded Identifiers)**: RocketBoard uses "Branded Types" to prevent accidental identifier misuse at compile time.
   - `PackId`, `SourceId`: Branded UUID strings.
   - `ChunkPK`: Branded UUID representing the database row ID.
   - `StableChunkId`: Branded TEXT representing the human-readable stable ID (e.g., "C00001").
   - `ChunkRef`: union of `ChunkPK | StableChunkId`.
   - **Contract**: Never assign a raw `string` to a branded field without using a validator (`asPackId`, `asChunkPK`, `normalizeChunkRef`).
5. **SQL RPCs**: Core search functions like `hybrid_search_v2` MUST return both `id` (UUID) and `chunk_id` (TEXT).

### 1.5.1 Chunk ID Format Spec
RocketBoard enforces two canonical formats for stable chunk identifiers. All ingestion connectors MUST produce IDs matching these patterns:

| Format Type | Regex Pattern | Example | Produced By | Logic Location |
| :--- | :--- | :--- | :--- | :--- |
| **Sequential** | `^C\d{5}$` | `C00001` | Linear, Figma, GDrive, GitHub, Docs | Manual padStart(5, '0') |
| **Deterministic** | `^H-[0-9a-f]{16}$` | `H-a1b2c3d4e5f6g7h8` | Confluence, Notion, Slack, Jira, URL | `computeDeterministicChunkId` |

**Validation Rule**: Use `isStableChunkIdString(s)` in `src/types/brands.ts` to verify these patterns at runtime.

### 1.6 KG Retrieval Invariants (v2)
**Deterministic Expansion (required):**
- All symbol-based neighbor discovery must use the `kg_expand_v1` RPC.
- Expansion must be pinned to the `active_generation_id` from `public.pack_active_generation`.
- `org_id` filtering is mandatory for all query branches (definitions, references, neighbors).

**Rerank Skip Policy (performance):**
- The external LLM reranker may be bypassed ("rerank skip") if:
  - KG expansion returns `kg_definition_hits >= 1` AND `kg_reference_hits >= 1`.
  - Total evidence spans are `≤ 12`.
- When skipping, spans must be locally ranked by `(relevance_score) + (relation_type_weight)` where definitions are prioritized.

**Observability (required):**
- All retrieval attempts must emit `kg_enabled` (bool: attempted) and `kg_time_ms` (RPC latency).
- Successful expansions must record `kg_added_spans`, `kg_definition_hits`, and `kg_reference_hits` in `rag_metrics`.
- `expanded_chunks_added` must be the sum of all hops (Hop 1 + Hop 2 + KG).

**Safety & Budget (required):**
- KG expansion must respect the `KG_MAX_TIME_MS` budget.
- If the elapsed time from retrieval start exceeds `KG_MAX_TIME_MS` before the expansion starts, the attempt must be skipped.

---

### 1.7 LLM Fallback Chain Invariants
**Trigger Conditions (required):**
- The fallback chain activates when the primary Lovable AI Gateway returns 402 (payment required), 429 (rate limited), or >= 500 (server error), AND the user is NOT using a custom BYOK provider.
- **Environment Gating**: Ollama fallback ONLY activates if ENABLE_OLLAMA_FALLBACK="true".
- BYOK users are never routed through the fallback chain; their errors surface directly.

**Fallback Order (strict sequence):**
1. **OpenAI Direct** (OPENAI_API_KEY env var) -> model: gpt-4o-mini
2. **Google AI Direct** (GOOGLE_AI_API_KEY env var) -> model: gemini-2.5-flash
3. **Local Ollama** (OLLAMA_ENDPOINT + optional OLLAMA_MODEL env vars) -> default model: llama3

**Ollama Security (Hardened):**
- **Strict Validation**: The terminal fetch() to Ollama MUST use parseAndValidateExternalUrl. No unconditional bypasses allowed.
- **Regional Access Control**: 
  - **Local Mode** (detected via empty DENO_REGION): Allows access to localhost and host.docker.internal on ports 11434, 8080, 80, 443. Private IP literals are blocked unless ALLOW_PRIVATE_OLLAMA="true".
  - **Cloud Mode**: Strictly forbids private IPs, localhost, and HTTP. Requires HTTPS and public DNS.
- The `OLLAMA_ENDPOINT` must point to the OpenAI-compatible completions path (e.g., `http://host.docker.internal:11434/v1/chat/completions`).

**Observability (required):**
- Each fallback attempt must be logged with a `[FALLBACK]` prefix including the status of enabling flags.
- If Ollama succeeds, `costUsd` must be recorded as `0` in the trace generation.
- The `model` field in `rag_metrics` must reflect the actual model used (e.g., `llama3`), not the originally requested model.

---

## 2) Where to change what (map of the codebase)

### Frontend (React)
- Envelope building (task request contract): `src/lib/envelope-builder.ts`
- AI task client: `src/lib/ai-client.ts`
- Retrieval clients: `src/lib/fetch-spans.ts`
- Output schema validation: `src/lib/schema-validator.ts`, `src/lib/output-schemas.ts`
- Citation UI: `src/components/chat/CitationBadge.tsx`, `src/components/chat/EvidenceSpanViewer.tsx`.

### Supabase Edge Functions (backend)
- Evidence retrieval gateway: `supabase/functions/retrieve-spans/`
- AI router / grounded pipeline: `supabase/functions/ai-task-router/`
- Ingestion hub / dispatcher: `supabase/functions/ingest-source/`
- Connector functions: `supabase/functions/ingest-*` (confluence, notion, jira, slack, url, etc.)
- Webhooks / remediation: `supabase/functions/github-webhook/`, `check-staleness/`, `auto-remediate-module/`

### Shared backend libraries (must reuse; do not fork copies)
- Secret patterns / redaction: `supabase/functions/_shared/secret-patterns.ts`
- SSRF-safe URL validation: `supabase/functions/_shared/external-url-policy.ts`
- AST chunking: `supabase/functions/_shared/ast-chunker.ts`
- Smart chunking / normalizers (docs sources): `supabase/functions/_shared/smart-chunker.ts`, `content-normalizers.ts`, `hash-utils.ts`
- Vault credentials: `supabase/functions/_shared/credentials.ts`
- Telemetry: `supabase/functions/_shared/telemetry.ts`
- Ingestion guards (cooldowns/caps): `supabase/functions/_shared/ingestion-guards.ts`
- Embedding reuse: `supabase/functions/_shared/embedding-reuse.ts`

### SQL / migrations
- Never edit old migrations.
- Add a new migration file in `supabase/migrations/` for schema changes or SQL function changes.
- Keep RPC security tight (revoke PUBLIC; grant only what is required).
- Any changes to retrieval functions must consider RLS + pack isolation.

---

## 3) Common gotchas (read before editing)
- **RLS vs service_role:** `service_role` bypasses RLS. Make sure only Edge Functions hold `service_role` keys.
- **RPC privileges:** Do not accidentally grant execute on sensitive RPCs to `authenticated` or `public`.
- **Edge runtime constraints:** Avoid large in-memory arrays for massive repos; batch DB writes; cap fetch concurrency.
- **Citation validity:** Routers may strip technical claims if citations are missing or invalid.
- **Snippet hydration proximity:** Snippet placeholders require nearby matching canonical citations to hydrate.
- **Do not regress SSRF checks:** Every config-derived URL must be validated.
- **Do not regress redaction:** Always run secret assessment on ingestion; router redaction is a second pass.

---

## 4) Playbooks (how to implement changes safely)

### 4.1 Adding a new connector (checklist)
When adding `ingest-<source>`:
1) **Credentials**
   - Use Vault/RPC storage via shared credentials helper (`supabase/functions/_shared/credentials.ts`).
   - Never store tokens in `pack_sources.config`.
2) **SSRF**
   - Validate every outbound URL with the shared URL policy (`supabase/functions/_shared/external-url-policy.ts`).
3) **Normalization + chunking**
   - Convert source content into normalized Markdown/text using `supabase/functions/_shared/content-normalizers.ts`.
   - Use `supabase/functions/_shared/smart-chunker.ts` (heading-aware).
   - Generate stable `chunk_id` and compute `content_hash` using `supabase/functions/_shared/hash-utils.ts`.
4) **Redaction**
   - Run shared secret assessment per chunk (`supabase/functions/_shared/secret-patterns.ts`).
5) **Embeddings**
   - Reuse embeddings by `content_hash` using `supabase/functions/_shared/embedding-reuse.ts`.
6) **Job tracking**
   - Create/update `ingestion_jobs`.
   - Enforce cooldowns + caps using `supabase/functions/_shared/ingestion-guards.ts`.
7) **Telemetry**
   - Create a trace using `supabase/functions/_shared/telemetry.ts`.
8) **Tests**
   - Add tests for URL validation and redaction behavior.

### 4.3 Modifying Roadmap / Playlists (Hardening)
1) **Integrity**
   - Circular dependencies must be prevented at the DB level (trigger).
   - Status transitions must follow allowed paths (blocked -> available -> in_progress -> done).
2) **Tenancy**
   - Every read must go through `has_pack_access` or `is_pack_member` RLS.
   - Every write must check pack ownership/author level.
3) **QA Verification**
   - Any change to Roadmap RLS must be verified using the SQL test harness in `supabase/qa/roadmap/`.
4) **Rollout**
   - Use the `roadmap_enabled` flag on the `packs` table for a phased rollout.
---

## 5) Verification checklist (must run before final output)
- [ ] Typecheck/lint passes (`deno check`, `tsc`)
- [ ] Migrations apply cleanly on a fresh DB
- [ ] Ingestion: run a small test; verify cooldowns/caps and embedding reuse.
- [ ] Retrieval: verify pack membership gate and stable anchors.
- [ ] Router: verify citations appear and snippets hydrate correctly.
- [ ] Security: confirm no secrets/tokens in logs.
- [ ] Tenancy: confirm no cross-pack leakage.

---

## 6) Updating this file
If you add a connector, change retrieval, or change the router contract, update this `AGENTS.md` in the same PR.

---

## 7) Cross-cutting acceptance checklist (required)
**Required for all PRs touching backend/DB/edge/IDE/MCP.**

### Checklist items:
- [ ] **AGENTS.md updated**: (“where to change what” / invariants)
- [ ] **Trust console updated**: (if metrics/schema changed)
- [ ] **Lifecycle controls safe**: (no dangerous purges/deletions)
- [ ] **Security review**: (RBAC, SSRF, no secret logs, output caps+redaction)
- [ ] **CI / Manual QA**: (verified via `scripts/mcp-smoke-test.ts` or `rag-eval`)

### Release discipline:
If you forgot to include this checklist in your PR, create a backfill PR to update the documentation and verify the changes.
