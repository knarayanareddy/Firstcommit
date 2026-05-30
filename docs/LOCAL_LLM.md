# Running RocketBoard fully local (no vendor)

RocketBoard's inference is OpenAI-compatible, so any local server (Ollama or llama.cpp
`llama-server`) can power chat, reranking, and embeddings.

## Chat / reranking (default in self-host)
```bash
ollama pull llama3
# edit .env:
LOCAL_LLM_BASE_URL=http://ollama:11434/v1   # host.docker.internal if Ollama runs on the host
DEFAULT_LLM_MODEL=llama3
LOCAL_LLM_API_KEY=ollama                     # placeholder; local servers ignore it
LOCAL_LLM_HOST=ollama                        # SSRF allowlist entry
ALLOW_PRIVATE_OLLAMA=true
```
The edge functions resolve inference as: active per-user BYOK provider → local endpoint →
fail closed. BYOK cloud providers remain available via the Settings UI.

## Embeddings
The default keeps OpenAI `text-embedding-3-small` (1536-dim) so no re-embedding is needed.
To go fully local:
```bash
ollama pull nomic-embed-text
# .env:
EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIM=768
```
Because local embedding models are not 1536-dim, you must resize the vector column and
re-embed every chunk — run `scripts/switch-embeddings-to-local.sql`, then a full reindex.
Query and document embeddings MUST use the same model/dimension or hybrid search breaks.

## Reachability
A local LLM is only reachable from the edge runtime when the backend is **self-hosted**
(Supabase Docker bundle + Ollama on the same network). Supabase Cloud edge functions
cannot reach your localhost — use cloud BYOK there.
