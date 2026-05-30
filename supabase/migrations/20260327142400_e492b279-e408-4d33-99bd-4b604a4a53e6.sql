UPDATE public.ingestion_jobs
SET status = 'failed',
    completed_at = now(),
    error_message = 'Reset: stalled job cleared (tree-sitter WASM crash)'
WHERE id = 'a19835ae-ac5a-4b15-89e3-a57695995156'
  AND status = 'processing';