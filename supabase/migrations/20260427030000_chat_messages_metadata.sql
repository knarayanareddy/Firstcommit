-- Add metadata column to chat_messages
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.chat_messages.metadata IS 'Optional message metadata for UI/debug/trace context';
