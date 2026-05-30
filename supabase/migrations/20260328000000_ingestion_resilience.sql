-- Ingestion Resilience: Support for failure cleanup and retries

-- 1. Update knowledge_chunks to track which job created it
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS ingestion_job_id uuid REFERENCES ingestion_jobs(id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_ingestion_job_id ON knowledge_chunks(ingestion_job_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_pack_job ON knowledge_chunks(pack_id, ingestion_job_id);

-- 2. Update ingestion_jobs for retry tracking
ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0;
ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS last_error_at timestamptz;
ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS last_error_message text;

-- 3. Update reindex_progress for failure visibility
ALTER TABLE reindex_progress ADD COLUMN IF NOT EXISTS error_message text;
