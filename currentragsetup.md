# Current RAG Setup: Titanium-Hardened Zero-Hallucination Architecture

RocketBoard utilizes a sophisticated, non-linear Retrieval-Augmented Generation (RAG) architecture focused on **Zero-Hallucination** and **Zero-Trust Isolation**.

## 1. AST-Aware Ingestion
- **Tree-sitter Parsing**: Code is not just "split"; it's parsed using Tree-sitter backends (TypeScript, Python, Go, etc.) to identify Classes, Functions, and Exports.
- **Semantic Chunking**: Chunks are aligned to AST boundaries, ensuring that evidence spans include complete logical units rather than random line ranges.
- **PII Redaction**: A 12-pattern regex "Reaper" strips secrets (AWS, JWT, etc.) before they ever reach the embedding model or vector database.

## 2. Titanium Hybrid Search (v2)
- **Multi-Vector Retrieval**: The system fires 3-5 query variants in parallel to maximize semantic recall.
- **RRF Fusion**: Results from `pgvector` (cosine similarity) and Full-Text Search are merged using Reciprocal Rank Fusion (RRF).
- **Hardened Parsing**: Uses `websearch_to_tsquery` in SQL to handle complex user queries (quotes, plus/minus) safely, with a 500-char clamp to prevent ReDoS.
- **Zero-Trust RLS**: `knowledge_chunks` are protected by pack-scoped Row Level Security. Even with a valid JWT, users can only search chunks within packs they explicitly belong to.

## 3. The Zero-Hallucination Pipeline
- **Structural Integrity**: The LLM is strictly forbidden from generating code directly. It emits `[SNIPPET]` placeholders.
- **Grounding Audit**: Every claim is audited at runtime. If the AI makes a claim not supported by the retrieved evidence, it is stripped.
- **Server-Side Hydration**: Placeholders are resolved on the server from the *original* source file to guarantee 100% syntactical accuracy.
- **Interactive Citations**: Inline badges (`[S1]`, `[S2]`) provide click-through to the Source Explorer and hover previews.

## 4. Observability & Defensive Shields
- **Telemetry**: Full Langfuse tracing for every task, capturing latencies, token costs, and grounding scores.
- **Security Audit Gates**: Automated CI checks (audit-edge-functions.mjs) prevent CORS wildcard and insecure fetch regressions.
- **Resource Caps**: Strict 50-span retrieval limits and query length clamping (Titanium Hardened).
- **Staleness Detection**: Webhook-driven monitors track repository changes and flag stale module sections for automated AI remediation.
