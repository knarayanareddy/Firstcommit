# 🚀 RocketBoard — AI-Powered Developer Onboarding

> Turn your codebase, docs, and internal knowledge into structured, **evidence-grounded** onboarding — learning modules, quizzes, exercises, glossaries, and a citation-backed chat. **Vendor-independent: bring your own key, or run it fully local.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E)](https://supabase.com)
[![Deno](https://img.shields.io/badge/Edge-Deno-000000)](https://deno.com)
[![Local LLM](https://img.shields.io/badge/LLM-BYOK%20%7C%20Ollama%20%7C%20llama.cpp-ff6b3d)](https://ollama.com)

> **Production-hardened, self-hostable build.** No proprietary AI-gateway dependency — inference runs through the provider key *you* supply (BYOK) or a **local** Ollama / llama.cpp. See **[docs/PRODUCTION_BUILD_STATUS.md](docs/PRODUCTION_BUILD_STATUS.md)** for the full state and the pre-deploy verification checklist.

---

## What it is

RocketBoard ingests your GitHub repos, Confluence / Notion / Jira / Slack / and other sources, then generates structured learning content in which **every claim is tied to evidence spans from your actual sources**, with full citation tracking. Three roles:

| Role | What they do |
|------|--------------|
| **Pack Owners / Admins** | Create organizations & packs, invite members, manage settings |
| **Authors** | Connect sources, curate AI-generated plans, review & publish modules |
| **Learners** | Read modules, take quizzes, complete exercises, track progress |

## Vendor independence

- **No proprietary AI gateway.** Inference is OpenAI-compatible and configurable.
- **BYOK** across 12 providers (OpenAI, Anthropic, Google, Mistral, xAI, Cohere, DeepSeek, Groq, Fireworks, Together, SambaNova, Cerebras) **or** a fully **local** server (Ollama / llama.cpp) — the self-host default.
- **Embeddings** default to OpenAI `text-embedding-3-small` (1536-dim) and are configurable; a fully-local option (`nomic-embed-text`) is supported via a documented re-embed step.
- **Self-hostable end to end** (Supabase Docker bundle + Ollama) — optionally with **zero external AI calls**.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React 18 Frontend (Vite)                 │
│  Dashboard · Modules · Quizzes · Exercises · Glossary · Chat │
│  Analytics · Content Health · Guided Tours · Help Center     │
└───────────────────────────┬──────────────────────────────────┘
                            │ JWT (Supabase Auth) + HTTPS
┌───────────────────────────▼──────────────────────────────────┐
│              Supabase Edge Functions (Deno)                   │
│  ai-task-router · retrieve-spans · 13 ingest-* connectors     │
│  github-webhook · auto-remediate · rocketboard-mcp            │
│  _shared: authz · cors · external-url-policy (SSRF) ·         │
│           secret-patterns · ingestion-guards · telemetry      │
└───────────────────────────┬──────────────────────────────────┘
                            │ service_role · RPC
┌───────────────────────────▼──────────────────────────────────┐
│            PostgreSQL + pgvector + pgcrypto + Auth            │
│  RLS tenant isolation · hybrid_search RPCs · BYOK key vault   │
│  Organizations → Packs → Sources → Chunks → Modules           │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS (SSRF-guarded: DNS + CIDR)
┌───────────────────────────▼──────────────────────────────────┐
│   Inference: your BYOK provider  OR  local Ollama / llama.cpp │
│   Telemetry: Langfuse (optional) + local RAG metrics          │
└───────────────────────────────────────────────────────────────┘
```

---

## Core capabilities

- **AI Task Router (14 task types)** with a 4-stage grounding pipeline: structural `[SNIPPET]` enforcement → claim/citation verification → **server-side snippet hydration** (inserted code comes from the source file, not the model) → canonical citation mapping.
- **Optional semantic faithfulness gate** (`FAITHFULNESS_CHECK`, **default off**): an NLI / LLM-judge pass that verifies the cited evidence actually *entails* each claim — the base verifier checks citation validity (token + line range); this gate adds entailment. Enable it to harden grounding.
- **Graph-augmented hybrid retrieval:** Reciprocal Rank Fusion over pgvector semantic + Postgres full-text search, plus a multi-hop symbol "detective" loop and an LLM reranker. Optional **Apache AGE** graph backend (`KG_ENGINE=age`, experimental).
- **13 ingestion connectors** with AST-aware + heading-aware chunking, deterministic content-hash chunk IDs, and embedding reuse.
- **Content health:** HMAC-verified GitHub webhook detects pushes touching cited files → staleness scoring → AI-drafted updates → author-reviewed diffs.
- **Learning experience:** modules, quizzes, exercises, glossary, Day-1/Week-1 paths, analytics, discussions, guided tours.

---

## Security

- **Real SSRF guard** (`_shared/external-url-policy.ts`): DNS resolution + **CIDR containment** on resolved IPs + per-redirect re-validation; explicit, config-driven local allowlist (no blanket private-network bypass).
- **Fail-closed BYOK encryption:** API keys are encrypted with `pgcrypto`; there is **no fallback passphrase** — `BYOK_ENCRYPTION_PASSPHRASE` is required or key operations refuse. Includes a `rotate_byok_passphrase()` routine. `SECURITY DEFINER` functions set `search_path`.
- **Tenant isolation:** Postgres RLS scoped to org/pack membership (no world-readable org listing).
- **Defense in depth:** secret redaction before LLM calls, centralized CORS allowlisting, internal-call header auth, per-pack ingestion concurrency + cooldowns + caps.
- **CI gates:** Deno unit tests, frontend typecheck + build, `npm audit`, edge-security static analysis (`audit:edge`, `check:credentials`, `check:internal-auth`), and a pgTAP RLS regression suite.

> Honesty note: the grounding pipeline is strong by design, but treat "zero-hallucination" as a *goal enforced by the faithfulness gate*, not an unconditional guarantee — run the eval harness (`rag-eval/`) against your data.

---

## Quickstart

### Option A — Self-hosted, fully local (recommended)
```bash
docker network create rocketboard
# 1) Bring up the Supabase self-host bundle (see docs/SELF_HOSTING.md), joined to the
#    `rocketboard` network, with the edge env from .env.docker.example.
# 2) Then start the local LLM + frontend:
cp .env.docker.example .env          # set BYOK_ENCRYPTION_PASSPHRASE (>=16 chars), etc.
docker compose -f docker-compose.selfhost.yml up -d --build
# App → http://localhost:8080  (Ollama pulls the chat + embedding models on first run)
```

### Option B — Managed Supabase + BYOK
Use a managed Supabase project (no vendor lock-in) and set per-user provider keys in **Settings → AI**. A local Ollama is **not** reachable from Supabase Cloud edge functions — use cloud BYOK there.

### Local development
```bash
git clone https://github.com/knarayanareddy/Firstcommit.git
cd Firstcommit
npm install
npm run dev            # Vite dev server
npm run build && npm run typecheck
npm test               # vitest (frontend)  ·  deno test supabase/functions/__tests__/ (edge)
```

---

## Environment

**Frontend (build-time)**
```env
VITE_SUPABASE_URL=<your supabase url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your supabase anon key>
```

**Edge functions**
```env
# Inference (default = self-hosted local LLM; OpenAI-compatible)
LOCAL_LLM_BASE_URL=http://ollama:11434/v1
DEFAULT_LLM_MODEL=llama3
LOCAL_LLM_API_KEY=ollama            # placeholder; local servers ignore it
LOCAL_LLM_HOST=ollama               # SSRF allowlist entry
ALLOW_PRIVATE_OLLAMA=true

# Embeddings (default keeps OpenAI 1536 — no re-embed; see docs/LOCAL_LLM.md to go local)
EMBEDDING_PROVIDER=openai           # openai | local | ollama | llamacpp
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536

# Security (REQUIRED — no insecure fallback exists)
BYOK_ENCRYPTION_PASSPHRASE=<>=16 chars>
ROCKETBOARD_INTERNAL_SECRET=<secret>
GITHUB_WEBHOOK_SECRET=<secret>
ALLOWED_ORIGINS=http://localhost:8080

# Optional
FAITHFULNESS_CHECK=false            # true to enforce semantic entailment of citations
FAITHFULNESS_ENGINE=heuristic       # heuristic | nli | llm
KG_ENGINE=native                    # native | age (Apache AGE, experimental)
LANGFUSE_PUBLIC_KEY= / LANGFUSE_SECRET_KEY=   # optional observability
```
There is **no `LOVABLE_API_KEY`** — that dependency was removed.

---

## Documentation

| Topic | Path |
|-------|------|
| Build status + verification checklist | [`docs/PRODUCTION_BUILD_STATUS.md`](docs/PRODUCTION_BUILD_STATUS.md) |
| Self-hosting (Docker + Ollama) | [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) |
| Local LLM + embeddings | [`docs/LOCAL_LLM.md`](docs/LOCAL_LLM.md) |
| Migration hygiene policy | [`docs/MIGRATIONS.md`](docs/MIGRATIONS.md) |
| Phase changelogs | `docs/PHASE1_*.md … PHASE7_*.md` |
| AI agent guide | [`AGENTS.md`](AGENTS.md) |

---

## Status

A production-grade, vendor-independent build with behavior and the interaction schema preserved from the original. **Before deploying, run the verification checklist** in `docs/PRODUCTION_BUILD_STATUS.md` (`supabase db reset`, `deno test`, `npm ci && build && typecheck`, the pgTAP RLS suite, an OAuth round-trip, and a local Ollama call). The semantic faithfulness gate is **opt-in** (default off) and the Apache AGE graph backend is **experimental** (validate on a live AGE instance).

## License

Private repository. All rights reserved.
