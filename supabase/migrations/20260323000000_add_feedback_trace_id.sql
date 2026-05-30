-- Add trace_id to chat_feedback for correlation with observability traces
ALTER TABLE IF EXISTS public.chat_feedback 
ADD COLUMN IF NOT EXISTS trace_id text;

COMMENT ON COLUMN public.chat_feedback.trace_id IS 'Langfuse/Telemetry trace ID for debugging and evaluation correlation.';
