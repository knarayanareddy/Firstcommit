-- Add metadata column to chat_messages to persist RAG source maps and citations
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Comment for clarity
COMMENT ON COLUMN chat_messages.metadata IS 'Stores RAG response metadata including source_map, referenced_sections, and metrics';
