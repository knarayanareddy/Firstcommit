# Lovable Task: Deploy and Verify Stepwise Ingestion Stability

## Context
We have overhauled the ingestion pipeline into a **Stepwise Controller-Worker architecture** to bypass Supabase Edge CPU/Memory limits. This involves a new state table, a batch processor, and a dedicated symbol graph worker.

## Objective
Deploy the new architecture and confirm that it successfully ingests large repositories (>500 files) without hitting runtime limits.

## Steps to Execute

### 1. Finalize Deployment
- Apply the migration: `supabase/migrations/20260427020000_ingestion_step_worker.sql`.
- Deploy the updated/new edge functions:
  - `supabase/functions/ingest-source/index.ts` (Controller)
  - `supabase/functions/ingest-source-worker/index.ts` (Batch Processor)
  - `supabase/functions/build-symbol-graph/index.ts` (Symbol Analyzer)

### 2. Trigger Ingestion Run
- In the RocketBoard Sources tab, trigger a fresh "Re-Sync" for a large GitHub repository (e.g., >500 files).

### 3. Real-time Monitoring
- Run the following SQL to monitor the pipeline's progress across multiple isolates:
  ```sql
  SELECT 
    j.id as job_id,
    j.phase,
    j.status,
    s.cursor as files_processed,
    s.symbol_cursor as symbols_processed,
    s.invocations_count,
    j.elapsed_ms
  FROM public.ingestion_jobs j
  JOIN public.ingestion_job_state s ON j.id = s.job_id
  WHERE j.status = 'processing'
  ORDER BY s.updated_at DESC;
  ```

### 4. Monitor Worker Logs
- Go to the Supabase Dashboard -> Functions -> `ingest-source-worker` -> Logs.
- Check for `[WORKER] Processing batch` messages and ensure no `CPU Time exceeded` errors occur.

## Deliverables
1. **Success Confirmation**: Confirm if the job reaches `status='completed'`.
2. **Performance Metrics**: Provide the total `invocations_count` and final `elapsed_ms`.
3. **Data Integrity**: Confirm that `knowledge_chunks` and `symbol_definitions` are fully populated for the new `job_id`.
