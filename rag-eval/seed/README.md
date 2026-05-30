# RAG Evaluation Seed & Staging Setup

To ensure stable and reproducible RAG regression tests, follow these steps to set up a staging environment:

## 1. Create an Eval Pack
Create a dedicated onboarding pack in your staging Supabase project named "Eval Pack (CI Generated)".

## 2. Ingest Stable Content
Ingest a small, stable subset of a repository or documentation. Avoid using a frequently changing repo as it will cause test instability.
Alternatively, use the provided `seed_eval_pack.sql` (if available) to manually insert deterministic chunks.

## 3. Configure CI User
- Create a dedicated user for CI (e.g., `ci-runner@rocketboard.ai`).
- Ensure this user is a member of the Eval Pack with at least `learner` access.

## 4. Pin Generation
- Use the `pack_active_generation` table to pin the current `active_generation_id`.
- Ensure no automated reindexing or webhooks can change this ID during CI runs.

## 5. Store Secrets
Add the following secrets to your GitHub repository or CI environment:
- `RAG_EVAL_SUPABASE_URL`
- `RAG_EVAL_SUPABASE_ANON_KEY`
- `RAG_EVAL_SUPABASE_SERVICE_ROLE_KEY` (used for reading `rag_metrics` only)
- `RAG_EVAL_USER_EMAIL`
- `RAG_EVAL_USER_PASSWORD`
- `RAG_EVAL_PACK_ID`
