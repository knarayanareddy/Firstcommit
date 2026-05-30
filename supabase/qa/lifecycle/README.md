# Lifecycle Controls QA Suite

This folder contains repeatable SQL scripts to verify RocketBoard's Data Lifecycle Controls (Purge, Retention, and RLS).

## Prerequisites
1. Access to the Supabase SQL Editor or `psql`.
2. Two test users:
   - **Author User**: Has 'author' or 'admin' role in the test pack.
   - **Learner User**: Has 'learner' role (or no access) to the test pack.
3. A **Test Pack ID**.

## Setup Instructions

1. **Configure Variables**:
   Open `00_vars.sql` and replace the placeholders with your test IDs.
   If using the Supabase SQL Editor, you may need to manually replace these variables in the subsequent scripts.

2. **Seed Test Data**:
   Run `01_seed.sql`. This will create:
   - 2 Pack Sources (Source A and Source B)
   - 10 Knowledge Chunks (5 per source)
   - Ingestion Jobs (Completed)
   - Backdated RAG Metrics (120 days old)

3. **Verify RLS (Learner)**:
   Run `02_rls_assertions_learner.sql` as the Learner user.
   **Expected**: 0 rows returned for policies and audit logs. Access denied for direct deletes.

4. **Verify RLS (Author)**:
   Run `03_assertions_author.sql` as the Author user.
   **Expected**: Full visibility into policies and audit logs for the pack.

5. **Manual Purge & Retention Flow**:
   Follow the steps in `04_purge_checks.md` and `05_retention_checks.md` using the "Data Lifecycle" UI or Edge Function calls.

6. **Cleanup**:
   Run `99_cleanup.sql` to remove all seeded test data.

## Automated Smoke Test
If you have a Node environment, you can run the Edge Function smoke test:
```bash
# Set env vars first: AUTHOR_JWT, PACK_ID, SOURCE_A_ID, etc.
npx ts-node rag-eval/scripts/lifecycle-smoke.ts
```
