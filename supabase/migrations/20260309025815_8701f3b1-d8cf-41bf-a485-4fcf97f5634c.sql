
-- GIN indexes for full-text search
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON public.knowledge_chunks USING GIN (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_notes_fts ON public.learner_notes USING GIN (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_chat_fts ON public.chat_messages USING GIN (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_modules_fts ON public.generated_modules USING GIN (to_tsvector('english', module_data::text));
CREATE INDEX IF NOT EXISTS idx_glossaries_fts ON public.generated_glossaries USING GIN (to_tsvector('english', glossary_data::text));
