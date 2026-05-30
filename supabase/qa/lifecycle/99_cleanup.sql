-- 99_cleanup.sql
-- Remove all seeded test data.

DELETE FROM public.knowledge_chunks WHERE pack_id = '{{PACK_ID}}';
DELETE FROM public.ingestion_jobs WHERE pack_id = '{{PACK_ID}}';
DELETE FROM public.rag_metrics WHERE pack_id = '{{PACK_ID}}';
DELETE FROM public.lifecycle_audit_events WHERE pack_id = '{{PACK_ID}}';
DELETE FROM public.pack_sources WHERE pack_id = '{{PACK_ID}}';
-- Note: Do NOT delete the pack itself or its lifecycle policy unless you want to reset everything.
-- DELETE FROM public.pack_lifecycle_policies WHERE pack_id = '{{PACK_ID}}';
