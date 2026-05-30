# Phase 6 — Self-host packaging (vendor-independent deployment)

Makes the whole platform runnable on your own infrastructure with a local LLM — the
payoff of the de-Lovable work in Phases 1–2.

## Added
- **`docker-compose.selfhost.yml`** — Ollama (local chat + embeddings, with a model-pull
  init + healthcheck, optional GPU) and the built frontend, on an external `rocketboard`
  network so the Supabase Edge Runtime can reach `ollama`.
- **`Dockerfile`** — multi-stage frontend build (Vite → nginx). `VITE_*` are passed as
  **build args** (Vite inlines them at build time).
- **`docker/nginx.conf`** — SPA fallback + sensible caching (immutable assets, no-cache SW).
- **`.env.docker.example`** — one consolidated env for the self-host stack (frontend +
  edge), with `BYOK_ENCRYPTION_PASSPHRASE` marked **required**.
- **`docs/SELF_HOSTING.md`** — full runbook: shared network → official Supabase bundle →
  schema/push → Ollama + frontend → optional fully-local embeddings → cron jobs.

## Why "alongside the official Supabase bundle"
The Supabase self-host stack is ~13 services (Postgres+pgvector+pgcrypto, GoTrue, Kong,
Edge Runtime, Storage, Studio, …). Rather than fork/duplicate it (and drift), we compose
our two add-ons (Ollama + frontend) onto its network. This keeps the bundle authoritative
and upgradeable, and is the supported Supabase pattern.

## Result
`docker network create rocketboard` → bring up Supabase → `docker compose -f
docker-compose.selfhost.yml up -d --build` → a fully self-hosted, Lovable-free RocketBoard,
optionally with zero external AI calls (local chat + local embeddings).

_Phase 6 of 7. Remaining optional: Phase 7 — Apache AGE graph layer behind `KG_ENGINE=age`._
