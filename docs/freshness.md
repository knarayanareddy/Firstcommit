# Universal Freshness Triggers

RocketBoard implements a generic "Universal Freshness Trigger" system to verify content integrity after any data ingestion step, without manually coupling ingestion runs to specific staleness checks.

## How it works

1. **Ingestion Completion Trigger:**
   Whenever an ingestion worker completes a job for any source (GitHub, Confluence, etc.), it marks the `ingestion_jobs.status` as `'completed'`.
   
   A PostgreSQL database trigger (`on_ingestion_job_completed`) detects this transition and securely inserts a new row into the `staleness_check_queue` table with a `pending` status. A unique partial index ensures that no more than one `pending` task exists per pack.

2. **Cron Scheduler:**
   A polling Edge Function worker, `process-staleness-queue`, is deployed to run on a set schedule.

3. **Staleness Worker Execution:**
   The worker:
   - Queries the queue for the oldest `pending` task.
   - Transitions its state to `processing` (using optimistic locking).
   - Locally invokes the `check-staleness` function (which crawls the Pack's sources and compares the `content_hash` of each chunk).
   - Marks the task as `done` and captures the outcome in `lifecycle_audit_events`.

## CRON Verification Setup

To schedule the queue worker, you map the deployed Edge Function to `pg_cron` (if self-hosted) or configure it via the Supabase Dashboard "Database > Triggers > Cron".

Example `pg_cron` setup to process the queue every 10 minutes:

```sql
SELECT cron.schedule(
  'process-staleness', 
  '*/10 * * * *', 
  $$
  SELECT net.http_post(
      url:='https://<PROJECT_REF>.supabase.co/functions/v1/process-staleness-queue',
      headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer <YOUR_CRON_AUTH_TOKEN>'
      )
  ) as request_id;
  $$
);
```

### Auth Protection
The endpoint checks for `CRON_AUTH_TOKEN` if defined in environment variables, returning 401 Unauthorized if the token doesn't match the incoming `Bearer <token>`.
