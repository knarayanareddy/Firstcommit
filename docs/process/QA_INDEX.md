# QA_INDEX.md

This index lists the primary QA assets and test harnesses available in the repository.

## 1. RAG Evaluation Harness
- **Path**: `rag-eval/`
- **Purpose**: Verify retrieval quality and generation groundedness (Zero-Hallucination).
- **Core Commands**:
  - `npm ci` (in `rag-eval/`)
  - `npm test` (runs standard suites)
  - `node scripts/run-eval.ts --pack <id>` (targeted eval)
- **Expected Output**: Precision/Recall metrics and groundedness scores.

## 2. MCP Smoke Test
- **Path**: `scripts/mcp-smoke-test.ts`
- **Purpose**: verify MCP tool availability, auth, and tenancy isolation.
- **Core Command**:
  - `node scripts/mcp-smoke-test.ts` (requires `SUPABASE_URL` and tokens)
- **Expected Output**: Green lights for all core tools (search, identify, list).

## 3. Lifecycle & Retention QA
- **Path**: `supabase/qa/lifecycle/`
- **Purpose**: Test data purge, legal hold, and retention windows.
- **Core Commands**:
  - See `README.md` in the directory for SQL-based assertion scripts.
- **Expected Output**: Assertions return `pass`.

## 4. Roadmap & Integrity QA
- **Path**: `supabase/qa/roadmap/`
- **Purpose**: Verify Roadmap RLS and circular dependency triggers.
- **Core Command**:
  - `supabase test db supabase/qa/roadmap/`
- **Expected Output**: All pgTAP tests pass.

## 5. Ingestion & Embedding Reuse
- **Path**: `supabase/functions/ingest-source/` (Unit tests)
- **Purpose**: Verify embedding reuse via `content_hash`.
- **Core Command**:
  - `deno test --allow-env --allow-net supabase/functions/ingest-source/`
- **Expected Output**: Unit tests pass.
