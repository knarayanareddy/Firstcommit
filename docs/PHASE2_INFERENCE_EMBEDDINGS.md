# Phase 2 — Inference & configurable embeddings

- **Configurable embeddings**: `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` / `EMBEDDING_DIM`
  now drive embedding generation in `retrieve-spans`, `_shared/embedding-reuse`, and
  `reindex-orgs`. Default is unchanged (OpenAI `text-embedding-3-small`, 1536) → **no re-embed**.
- **Force-local**: setting `EMBEDDING_PROVIDER=local|ollama|llamacpp` routes query AND document
  embeddings through the local endpoint, keeping them consistent (required for hybrid search).
- **Unified duplicate**: `reindex-orgs` now imports the shared `generateEmbedding` instead of its
  own OpenAI-only copy (one embedding code path everywhere).
- **Local provider in BYOK UI**: added a first-class "Local (Ollama / llama.cpp)" provider to the
  settings catalogue (Tier 0).
- **Fully-local migration**: `scripts/switch-embeddings-to-local.sql` (manual runbook — intentionally
  NOT in migrations so default 1536 deployments are unaffected) + `docs/LOCAL_LLM.md`.

Behavior/interaction schema preserved. Verify in your env: a query embedding round-trips; if you
switch to local embeddings, run the resize script + full reindex before searching.
