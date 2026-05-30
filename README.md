# 🚀 RocketBoard — AI-Powered Developer Onboarding

> Transform your codebase, documentation, and internal knowledge into structured, interactive learning experiences — powered by evidence-grounded AI.

[![Built with Lovable](https://img.shields.io/badge/Built_with-Lovable-ff69b4)](https://lovable.dev)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev)

---

## RocketBoard AI Guide

> **Internal Docs**: AI coding agents should read [AGENTS.md](file:///c:/first%20commit/rocketboard-ai-guide/AGENTS.md).
> **IDE Integration**: Setup and user guide for the [VS Code Extension](./vscode-extension/README.md).

RocketBoard is a high-performance, grounded AI onboarding platform designed to help developers master complex codebases with zero hallucinations. It ingests your GitHub repos, Confluence docs, Notion pages, and other knowledge sources — then generates structured learning modules, quizzes, glossaries, exercises, and onboarding paths. Every piece of generated content is **grounded in evidence spans** from your actual codebase, with full citation tracking.

### Who is it for?

| Role | What they do |
|------|-------------|
| **Pack Owners / Admins** | Create organizations & packs, invite members, manage settings |
| **Authors** | Connect sources, curate AI-generated plans, review & publish modules |
| **Learners** | Read modules, take quizzes, complete exercises, track progress |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  Dashboard · Modules · Quizzes · Exercises · Glossary · Chat    │
│  Help Center · Tours · Analytics · Content Health · FAQ         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ JWT Auth + HTTPS
┌───────────────────────────▼─────────────────────────────────────┐
│                   Supabase Edge Functions (Deno 2.0)│
│                                                                 │
│  ai-task-router ─── Zero-Hallucination Engine (Groundedness Audit)  │
│  retrieve-spans ── Agentic Multi-Query Hybrid Search (Titanium)   │
│  reindex-orgs ──── AST-Aware Intelligent Ingestion             │
│  ingest-source ─── Ingestion Engine with **Integrity Audit**          │
│  github-webhook ── Staleness detection + auto-remediation      │
│  _shared/authz, _shared/cors ── Centralized Auth & CORS        │
│  _shared/telemetry ── Langfuse + Local RAG Metrics             │
│  + 18 more functions                                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│              Supabase (PostgreSQL + pgvector + Auth)            │
│                                                                 │
│  55 migrations · RLS on all tables · Hybrid search RPCs        │
│  Organizations → Packs → Sources → Chunks → Modules            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    Lovable AI Gateway                            │
│              Google Gemini 3 Flash Preview                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Features

### 💻 VS Code Extension (v0)
The official **RocketBoard VS Code Extension** lets developers select code snippets and get instant, grounded explanations directly in their IDE. It features interactive citations, secure token storage, and workspace-aware pack selection. 

For installation and configuration details, see the **[VS Code Setup Guide](./vscode-extension/README.md)**.

### 🧠 AI Task Router (14 Task Types)
The central AI orchestration engine. Every request goes through input sanitization, secret redaction, agentic multi-query retrieval, and a **4-Stage Zero-Hallucination Pipeline**:
1. **Structural Enforcement**: The AI is forbidden from writing repository code directly; it must emit `[SNIPPET]` placeholders.
2. **Claim-Level Verification**: Every sentence is audited against evidence. Ungrounded claims are stripped.
3. **Server-Side Hydration**: `[SNIPPET]` tags are resolved at the server level from the original source files, ensuring 100% code accuracy.
4. **Canonical Citation Mapping**: Citations are mapped to stable UI badges and verified for spatial proximity.

| Task Type | Description |
|-----------|-------------|
| `chat` | Module-specific Q&A with citation grounding |
| `global_chat` | Platform-wide assistant (Mission Control) |
| `module_planner` | Analyze sources and propose a learning plan |
| `generate_module` | Generate full module content from evidence |
| `refine_module` | Author-directed module improvements |
| `generate_quiz` | Evidence-grounded multiple-choice assessments |
| `generate_glossary` | Pack-specific technical term dictionary |
| `generate_paths` | Day 1 / Week 1 onboarding checklists |
| `generate_ask_lead` | Curated questions for 1:1 meetings |
| `generate_exercises` | Hands-on coding challenges with hints |
| `verify_exercise` | AI review of learner exercise submissions |
| `simplify_section` | On-demand content simplification |
| `create_template` / `refine_template` | Module structure blueprints |

### 🔑 Bring Your Own Key (BYOK)
- RocketBoard provides generative onboarding natively via Gemini 3 Flash. 
- You can plug in your own API Keys for 13+ platform providers including **OpenAI (GPT-5.4), Anthropic (Claude 4.6), Google, Mistral, xAI**, and more.
- **Zero-knowledge encryption** via `pgcrypto` AES-256 ensures maximum security.

### 📦 Source Ingestion (13 Connectors)
Connect your knowledge sources and RocketBoard ingests, chunks, and embeds them for retrieval. Every outbound request is protected by a **Titanium SSRF Guard**.

- **GitHub** — repos via OAuth, with webhook-driven staleness detection & URL validation.
- **Confluence** / **Notion** / **SharePoint** / **Google Drive** — documentation with clean Markdown normalization.
- **Slack** / **Linear** / **Jira** / **PagerDuty** — operational context with **Smart Structural Chunking**.
- **Figma** / **Loom** / **Postman** / **OpenAPI** — design & API specs with recursive link validation.
- **URL** — arbitrary web pages with deep-crawl SSRF protection.

| Feature | Description |
|-----------|-------------|
| **Smart Structural Chunker** | Heading-aware splitting (H1-H6) ensures semantic context is preserved, avoiding arbitrary data breaks. |
| **Deterministic Chunk IDs** | Stable IDs based on document path, lines, and **parallelized true SHA256 content hashes (`Promise.all()`)** enable seamless `UPSERT` and citation stability. |
| **Integrity-Verified Sync** | Every ingestion job includes an **Automated Technical Documentation Audit** (scripts/verify-technical-docs.py) to ensure source-to-parity. API properties are **Vault-Secured via Edge RPCs** (replacing unencrypted DB references). |
| **Ingestion Safeguards** | **Cooldowns** (1-hour) and **Concurrent Lease Locks** prevent API abuse and race conditions. |
| **Automatic Recovery** | Failed ingestion jobs automatically purge partial data to ensure a clean state for retries. |

### 🔍 Hybrid Search (pgvector + Full-Text)
Evidence retrieval uses `hybrid_search_v2` RPC which is **Titanium-Hardened**:
- **Semantic similarity** via pgvector embeddings.
- **Full-text search** via PostgreSQL `websearch_to_tsquery` (Safe, complex parsing).
- **AST Meta-tagging** — exact matches for function signatures, exports, and types extracted via **Integrity-Verified** tree-sitter.
- **Agentic Multi-Query** — AI generates 3-5 query variants to maximize recall.
- **Defensive Shielding** — SSRF validation for AI-service endpoints, 50-span hard caps, and query clamping.

### 🎯 Interactive Chat Citations
AI responses include inline citation badges (`[S1]`, `[S2]`) that are fully interactive:
- **Hover** for a source code preview
- **Click** to open the full file in the Source Explorer
- **Deterministic ID Mapping** — Citations remain stable even across re-ingests due to content-based hashing.

### 👤 Personalization via Learner Profiles
- **Role & Experience:** AI adjusts verbosity, code density, and depth dynamically
- **Learning Style:** Choose between Visual (diagrams), Text-heavy, or Interactive (code-centric)
- **Framework Analogies:** e.g., "I know React" prompts the AI to explain unfamiliar concepts using React comparisons
- **Tone Preference:** Direct, Conversational, or Socratic guidance

### 📊 AI Observability & Quality Monitoring (Phase 7)
Full telemetry tracing for every AI task and ingestion job using our **Unified Telemetry Wrapper**:
- **Strategic Sampling** — 100% trace capture for errors/low-scores, with cost-optimized background sampling for success.
- **Ingestion Tracing** — Every sync is instrumented with spans for `fetch`, `chunk`, `redact`, `embed`, and `db_upsert`.
- **Grounding Score** — Professional quality assessment of citation accuracy (0-1).
- **Strip Rate** — Percentage of ungrounded LLM content automatically redacted.
- **Retrieval Analytics** — `top1_score`, `avg_relevance`, and `unique_files_count` tracked per request.
- **Feedback Loop Closure** — User ratings linked to technical traces via persistent `trace_id`.
- **Local RAG Metrics** — Performance data stored in PostgreSQL `rag_metrics` for out-of-the-box SQL reporting.

### 🔄 Content Health & Auto-Remediation
- **Hardened Production Webhook** detects pushes that affect cited source files, strictly enforcing `GITHUB_WEBHOOK_SECRET` cryptography (with `401 Unauthorized` responses for unverified traffic).
- **Staleness scoring** per module based on changed chunks
- **AI Agent** reads raw git diffs and drafts precise content updates via securely routed internal traffic (dynamic `X-Rocketboard-Internal` header fallback system).
- Authors review side-by-side diffs and accept with one click

### 📚 Learning Experience
- **Modules** with expandable sections, code snippets, learning objectives
- **Quizzes** with immediate feedback and evidence-linked explanations
- **Exercises** — code find, explain, configure, debug, explore challenges
- **Glossary** with density controls and code-contextualized definitions
- **Onboarding Paths** — Day 1 & Week 1 step-by-step checklists
- **Contextual Hints** — Proactive detection of stuck learners (dwell time, chat errors, "bouncing") with escalating guidance and pre-filled AI prompts.
- **Learner Profiles** — highly personalized AI content adapting to learning style, familiarity, and tone
- **Ask Your Lead** — curated high-signal questions for 1:1 meetings
- **Notes & Bookmarks** — personal note-taking with guided prompts
- **FAQ** — AI-detected repeated questions surfaced for author curation

### 🎓 Platform Features
- **Guided Tours** — 22 interactive walkthroughs for every major page
- **Help Center** — searchable in-app articles with custom card/timeline components
- **Help Tooltips** — contextual `ⓘ` tooltips across the entire platform
- **Analytics** — module engagement, quiz performance, cohort scatter charts
- **Feedback** — learner content ratings, chat report system with trace IDs
- **Team Directory** — knowledge owners, meeting checklists, expertise areas
- **Discussions** — async threaded conversations scoped to modules/packs
- **Graduation Modal** — ticket syndication when learners complete onboarding

### 🛡️ Weekly CI Drift Pipelines
- The build is safeguarded by statically scheduled pipelines and NPM lint guards (including `db-types-check`) running weekly to detect back/front architectural drifts and flag bare edge credential dependencies.

---

## Multi-Tenant Data Model

```
Organizations
  └── Packs
        ├── Sources → Ingestion Jobs → Knowledge Chunks (with embeddings)
        ├── Generated Modules (draft / published)
        ├── Pack Tracks (Frontend, Backend, Infra, Cross-Repo)
        ├── Pack Members (with roles: admin, author, learner)
        └── User Data (progress, quiz scores, notes, chat, bookmarks)
```

- **RLS policies** on every table with `is_pack_member()` checks
- **`profiles`** table allows "view all" (social directory), all other user data is row-scoped
- **`pack_id`** written into every user-data mutation for tenant isolation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18 + TypeScript |
| **Build** | Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Animations** | Framer Motion |
| **State** | TanStack React Query + React Context |
| **Routing** | React Router v6 |
| **Charts** | Recharts |
| **Markdown** | react-markdown + custom `MarkdownRenderer` (cards, timelines, citations) |
| **Icons** | Lucide React |
| **Backend** | Supabase (PostgreSQL + pgvector + Auth + Edge Functions on **Deno 2.0**) |
| **AI** | Lovable AI Gateway → Google Gemini 3 Flash Preview |
| **Observability** | Langfuse (LLM tracing) + structured logging fallback |
| **Notifications** | Sonner (toast notifications) |

---

## Project Structure

```
src/
├── components/           # UI components
│   ├── ui/               # shadcn/ui primitives
│   ├── ModuleChatPanel.tsx    # AI chat with interactive citations
│   ├── MarkdownRenderer.tsx   # Custom markdown (cards, steps, citations)
│   ├── CitationBadge.tsx      # Hover preview + source navigation
│   ├── ChatReportDialog.tsx   # Feedback with trace_id
│   ├── TourOverlay.tsx        # Guided tour system
│   └── ...50+ components
├── data/
│   ├── help-content.ts        # Help Center articles
│   ├── tours.ts               # 22 page tours
│   ├── onboarding-data.ts     # Static module content
│   └── ...
├── hooks/                # Custom React hooks (30+)
│   ├── useProgress.ts         # Pack-aware progress tracking
│   ├── useChatFeedback.ts     # Report with trace_id
│   ├── useTelemetry.ts        # Module engagement telemetry
│   └── ...
├── lib/
│   ├── ai-client.ts           # AI task router client
│   ├── schema-validator.ts    # AI output validation
│   ├── ai-errors.ts           # Structured error handling
│   ├── fetch-spans.ts         # Evidence retrieval client
│   └── tour-system.ts         # Tour engine
├── pages/                # 20+ route pages
└── integrations/         # Auto-generated Supabase types

supabase/
├── functions/
│   ├── _shared/
│   │   └── telemetry.ts       # Langfuse tracing wrapper
│   ├── ai-task-router/        # Central AI orchestration (14 task types)
│   ├── retrieve-spans/        # Hybrid vector + full-text search
│   ├── github-webhook/        # Staleness detection
│   ├── auto-remediate-module/ # AI content repair
│   ├── check-staleness/       # Freshness scoring
│   ├── ingest-source/         # GitHub ingestion
│   ├── ingest-confluence/     # Confluence ingestion
│   ├── ingest-notion/         # Notion ingestion
│   ├── ingest-slack/          # Slack ingestion
│   └── ...13 more connectors
└── migrations/            # 55 database migrations
```

---

## Security

- **JWT & Internal Authentication** — Mandatory JWT verification for all user endpoints and `X-Rocketboard-Internal` header for secure function-to-function communication.
- **Titanium SSRF Guard** — All outbound `fetch()` calls in connectors and AI routing are validated by `parseAndValidateExternalUrl`. Blocks Localhost, Private IPs (RFC 1918), and Link-Local (RFC 3927) bypasses.
- **Centralized CORS** — All Edge Functions use `_shared/cors.ts` for strict origin allowlisting, forbidding wildcard (`*`) origins.
- **Concurrent Job Locking** — Database-backed lease locks prevent reindex jobs for the same pack from racing and corrupting generation pinning.
- **Supply-Chain Integrity** — Tree-sitter WASM grammars are pinned to v0.1.11, verified with SHA256 hashes, and support local vendoring to eliminate CDN outages.
- **Rate limiting** — 30 requests/minute per user in `ai-task-router`.
- **Secret Redaction** — 14 regex patterns (centralized in `secret-patterns.ts`) strip AWS keys, JWTs, connection strings, GitHub tokens, and API keys before AI processing.
- **RLS** on every Supabase table with **Pack-Scoped** isolation for knowledge chunks.
- **Automated Security Audit** — CI enforces `deno fmt --check` and `node scripts/audit-edge-functions.mjs` to detect CORS wildcards and missing auth guards before PR merge.
- **Grounding Integrity** — All technical documentation is verified by CI using the `verify-technical-docs.py` auditor to prevent regression in grounding standards.

---

## Ops

| Doc | Path |
|-----|------|
| **Required Secrets** | [`docs/ops/required-secrets.md`](docs/ops/required-secrets.md) |

Edge Functions emit structured, rate-limited `console.warn` messages when critical secrets are missing at runtime. See `supabase/functions/_shared/env-warnings.ts`.

---

## Getting Started

```bash
# Clone
git clone https://github.com/knarayanareddy/rocketboard-ai-guide.git
cd rocketboard-ai-guide

# Install
npm install

# Dev server
npm run dev

# 🛡️ Type Safety & Schema Synchronization
This project uses a strict type-safety gate to prevent drift between database migrations and TypeScript types.

| Command | Action | When to use |
|---------|--------|-------------|
| `npm run gen:types` | Regenerate `types.ts` from local DB | After running `supabase db reset` locally |
| `npm run check:types` | Verify critical tables are typed | In CI or before PR submission |

**Note**: Local type generation requires the Supabase CLI. If your local Docker environment is unstable, types can also be generated from a staging project using:
`npx supabase gen types typescript --project-id <ref> --schema public > src/integrations/supabase/types.ts`
```

### Environment Variables
```env
VITE_SUPABASE_URL=<your supabase url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your anon key>
```

### Edge Function Secrets (Supabase Dashboard)
```
LOVABLE_API_KEY=<lovable ai gateway key>
LANGFUSE_PUBLIC_KEY=<optional, for observability>
LANGFUSE_SECRET_KEY=<optional, for observability>
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

---

## License

Private repository. All rights reserved.
