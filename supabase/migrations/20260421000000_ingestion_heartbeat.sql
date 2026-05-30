-- Add last_heartbeat_at to track ingestion progress and prevent stale job resets for long-running tasks
ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz DEFAULT now();

-- Update existing processing jobs to have a heartbeat
UPDATE ingestion_jobs SET last_heartbeat_at = started_at WHERE status = 'processing' AND last_heartbeat_at IS NULL;
