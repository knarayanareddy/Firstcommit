-- Prerequisite: Add missing columns to knowledge_chunks and create missing tables for KG v2

-- 1. Add missing columns to knowledge_chunks
ALTER TABLE public.knowledge_chunks
ADD COLUMN IF NOT EXISTS org_id UUID,
ADD COLUMN IF NOT EXISTS generation_id UUID,
ADD COLUMN IF NOT EXISTS entity_type TEXT,
ADD COLUMN IF NOT EXISTS entity_name TEXT,
ADD COLUMN IF NOT EXISTS signature TEXT,
ADD COLUMN IF NOT EXISTS imports TEXT[],
ADD COLUMN IF NOT EXISTS exported_names TEXT[];

-- 2. Create pack_active_generation table
CREATE TABLE IF NOT EXISTS public.pack_active_generation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  active_generation_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, pack_id)
);

ALTER TABLE public.pack_active_generation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pack_active_generation"
  ON public.pack_active_generation
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Create rag_metrics table
CREATE TABLE IF NOT EXISTS public.rag_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID,
  pack_id UUID REFERENCES public.packs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  query_text TEXT,
  total_spans INT DEFAULT 0,
  hop0_count INT DEFAULT 0,
  hop1_added INT DEFAULT 0,
  hop2_added INT DEFAULT 0,
  symbols_extracted INT DEFAULT 0,
  rerank_kept INT DEFAULT 0,
  time_ms INT DEFAULT 0,
  expanded_chunks_added INT DEFAULT 0,
  detective_enabled BOOLEAN DEFAULT false
);

ALTER TABLE public.rag_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on rag_metrics"
  ON public.rag_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);