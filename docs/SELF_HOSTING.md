# Self-hosting RocketBoard (no vendor, optional fully-local LLM)

RocketBoard runs on a self-hosted Supabase stack plus a local Ollama for inference.
Nothing depends on the Lovable platform.

## Topology
```
┌───────────── Docker network: rocketboard ─────────────┐
│  frontend (nginx)  ──HTTP──►  Supabase Kong/Gateway    │
│                                  │                     │
│                         Edge Runtime (Deno)  ──────────┼──► ollama (local LLM + embeddings)
│                                  │                     │
│                         Postgres + pgvector + pgcrypto │
└────────────────────────────────────────────────────────┘
```

## Steps

### 1. Shared network
```bash
docker network create rocketboard
```

### 2. Supabase self-host bundle (Postgres + Auth + Edge Runtime + Studio)
```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```
- Add `rocketboard` (external) to the `functions` and `db` services' `networks:` in
  `docker-compose.yml`.
- Put the RocketBoard edge env (from `.env.docker.example`) into this `.env`:
  `BYOK_ENCRYPTION_PASSPHRASE` (**required, ≥16 chars**), `LOCAL_LLM_BASE_URL=http://ollama:11434/v1`,
  `DEFAULT_LLM_MODEL`, `LOCAL_LLM_HOST=ollama`, `ALLOW_PRIVATE_OLLAMA=true`,
  `ROCKETBOARD_INTERNAL_SECRET`, `GITHUB_WEBHOOK_SECRET`, `ALLOWED_ORIGINS`, and the `EMBEDDING_*` vars.
```bash
docker compose up -d
```
The self-host image already includes **pgvector** and **pgcrypto** — no extra extension work.

### 3. Apply the schema
```bash
# from the rocketboard-prod repo:
supabase db push        # or: psql "$DB_URL" -f <each migration>
# set the BYOK passphrase at the DB level:
psql "$DB_URL" -c "ALTER DATABASE postgres SET app.byok_encryption_passphrase = 'your-strong-passphrase';"
```

### 4. Ollama + frontend (this repo)
```bash
cp .env.docker.example .env     # set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (= anon key)
docker compose -f docker-compose.selfhost.yml up -d --build
```
`ollama-init` pulls the chat model (`DEFAULT_LLM_MODEL`) and embedding model. The app is at
http://localhost:8080.

### 5. (Optional) fully-local embeddings
Default keeps OpenAI 1536 (set `OPENAI_API_KEY`). To remove that last cloud dependency:
```bash
# set EMBEDDING_PROVIDER=local, EMBEDDING_MODEL=nomic-embed-text, EMBEDDING_DIM=768
psql "$DB_URL" -f scripts/switch-embeddings-to-local.sql   # resize vector column + rebuild index
# then trigger a full reindex (reindex-orgs) so all chunks are re-embedded locally
```

### 6. Scheduled jobs (rollups / retention / staleness)
```bash
psql "$DB_URL" -f scripts/schedule-cron-jobs.sql   # requires pg_cron + pg_net
```

## Cloud-BYOK alternative
Prefer managed Supabase? Use it directly (no Lovable) and set per-user BYOK keys in Settings.
A local Ollama is NOT reachable from Supabase **Cloud** edge functions — use cloud BYOK there.
