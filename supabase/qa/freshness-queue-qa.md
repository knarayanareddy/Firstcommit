# Universal Freshness Triggers QA

This document outlines the manual Quality Assurance (QA) steps required to verify that the universal `staleness_check_queue` properly triggers, dedupes, and runs against ingestion jobs, fulfilling the "Universal Freshness Triggers" milestone.

## Test 1: Ingestion Job Enqueue & Deduplication

**Objective**: Verify that completing an ingestion job enqueues exactly one `pending` row for the pack, and doing it again dedupes correctly.

**Steps**:
1. Go to the Supabase Studio SQL Editor (or connect via `psql`).
2. Identify a valid `pack_id` and a simulated (or real) `ingestion_job`.
3. Insert or update an `ingestion_jobs` row to have `status = 'completed'` for `pack_id = X`.
4. Run `SELECT * FROM staleness_check_queue WHERE pack_id = X AND status = 'pending';`
   * **Expected**: Exactly 1 row is returned with `reason = 'ingestion_completed'`.
5. Insert another `ingestion_jobs` row with `status = 'completed'` for the SAME `pack_id = X`.
6. Rerun the same SELECT query.
   * **Expected**: Still exactly 1 row is returned (the unique `(pack_id) WHERE status='pending'` index blocked duplicates).

## Test 2: Worker Processing & Serialization

**Objective**: Verify the Edge Function `process-staleness-queue` correctly picks up tasks, locks them, executes staleness checks, and completes them securely.

**Steps**:
1. Check the local DB or prod DB to ensure there is at least one `pending` task in `staleness_check_queue`.
2. Invoke the edge function via cURL (simulating the CRON):
   ```bash
   curl -X POST "http://localhost:54321/functions/v1/process-staleness-queue" \
        -H "Authorization: Bearer <YOUR_CRON_AUTH_TOKEN>"
   ```
   *(If testing locally without token enforcement, omitting the header should still work based on environment config)*
3. **Expected Output**: The JSON payload should indicate how many tasks were processed (e.g., `{"processed": 1, "results": [...]}`).
4. Run `SELECT id, status, processed_at, error_message FROM staleness_check_queue;`
   * **Expected**: The row's status transitioned from `pending` -> `processing` -> `done` (or `failed` if there was an actual staleness-check exception). `processed_at` should be populated.
5. Check `lifecycle_audit_events` table:
   * **Expected**: An audit row exists with `action = 'staleness_queue_processed'` noting the result.
6. Verify Trust Dashboard UX:
   * **Expected**: `http://localhost:3000/packs/<pack_id>/trust` shows `0 pending`, `Last processed: <Recent Time>`.

## Test 3: Security & Invariants

**Objective**: Confirm RLS policies and auth headers prevent unauthorized access.

**Steps**:
1. Try to invoke the Edge Function with an invalid CRON token.
   * **Expected**: `HTTP 401 Unauthorized`.
2. As a standard authenticated user (Learner/Reader), try to execute an `INSERT` into `staleness_check_queue` via standard PostgREST API.
   * **Expected**: Permission Denied / Forbidden.
3. Validate Edge Function logs out of Supabase Dashboard.
   * **Expected**: NO secrets, tokens, or encryption keys are logged.

If all steps pass, the Milestone 1: Universal Freshness Triggers PR Acceptance Checklist is satisfied.
