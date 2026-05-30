-- Table: staleness_check_queue
CREATE TABLE staleness_check_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
    reason TEXT NOT NULL DEFAULT 'ingestion_completed',
    source_id UUID NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, done, failed
    error_message TEXT NULL
);

-- Deduplication index enforces only one pending job per pack at any given time.
CREATE UNIQUE INDEX staleness_check_queue_pending_idx 
    ON staleness_check_queue (pack_id) 
    WHERE status = 'pending';

-- Indices for queue polling and Dashboard queries
CREATE INDEX staleness_check_queue_status_time_idx 
    ON staleness_check_queue (status, requested_at);

CREATE INDEX staleness_check_queue_pack_status_idx 
    ON staleness_check_queue (pack_id, status);

-- Enable RLS
ALTER TABLE staleness_check_queue ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for pack authors and admins (service_role bypasses inherently)
CREATE POLICY select_staleness_queue_for_authors 
    ON staleness_check_queue 
    FOR SELECT 
    TO authenticated 
    USING (public.has_pack_access(auth.uid(), pack_id, 'author'));

-- Trigger to enqueue check on ingestion job completion
CREATE OR REPLACE FUNCTION enqueue_staleness_check()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only enqueue if status changed to 'completed'
    IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status != 'completed') THEN
        INSERT INTO staleness_check_queue (pack_id, reason, source_id)
        VALUES (NEW.pack_id, 'ingestion_completed', NEW.source_id)
        ON CONFLICT (pack_id) WHERE status = 'pending' DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ingestion_job_completed
    AFTER INSERT OR UPDATE ON ingestion_jobs
    FOR EACH ROW EXECUTE FUNCTION enqueue_staleness_check();
