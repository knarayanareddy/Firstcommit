-- Migration: Lifecycle Controls Minimal v1
-- Derived data reporting, idempotent purging, and retention

-- 1. Retention Policy Table
CREATE TABLE IF NOT EXISTS public.pack_lifecycle_policies (
  pack_id UUID PRIMARY KEY REFERENCES public.packs(id) ON DELETE CASCADE,
  retention_rag_metrics_days INT NOT NULL DEFAULT 90,
  retention_ingestion_jobs_days INT NOT NULL DEFAULT 90,
  legal_hold BOOLEAN NOT NULL DEFAULT false, -- Column included now, logic later
  updated_by UUID NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pack_lifecycle_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack authors/admins can manage lifecycle policies"
  ON public.pack_lifecycle_policies FOR ALL
  USING (has_pack_access(auth.uid(), pack_id, 'author'));

-- 2. Lifecycle Audit Event Table
CREATE TABLE IF NOT EXISTS public.lifecycle_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  actor_user_id UUID NULL REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'purge_source', 'retention_cleanup'
  target_type TEXT NOT NULL, -- 'source', 'table'
  target_id UUID NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::JSONB,
  rows_deleted JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'completed', -- 'started','completed','failed'
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lifecycle_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack authors/admins can read lifecycle audit"
  ON public.lifecycle_audit_events FOR SELECT
  USING (has_pack_access(auth.uid(), pack_id, 'author'));

-- 3. Optimization Indices
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_pack_source ON public.knowledge_chunks(pack_id, source_id);
CREATE INDEX IF NOT EXISTS idx_rag_metrics_pack_created ON public.rag_metrics(pack_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_pack_source_started ON public.ingestion_jobs(pack_id, source_id, started_at);
CREATE INDEX IF NOT EXISTS idx_lifecycle_audit_pack_created ON public.lifecycle_audit_events(pack_id, created_at);

-- 4. RPC for Atomic Source Purge (Minimal v1)
CREATE OR REPLACE FUNCTION public.purge_source_v1(
  p_pack_id UUID,
  p_source_id UUID,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chunks_deleted INT;
  v_jobs_deleted INT;
BEGIN
  -- Perform deletions
  DELETE FROM public.knowledge_chunks
  WHERE pack_id = p_pack_id AND source_id = p_source_id;
  GET DIAGNOSTICS v_chunks_deleted = ROW_COUNT;

  DELETE FROM public.ingestion_jobs
  WHERE pack_id = p_pack_id AND source_id = p_source_id;
  GET DIAGNOSTICS v_jobs_deleted = ROW_COUNT;

  -- Reset source status if columns exist
  UPDATE public.pack_sources
  SET last_synced_at = NULL
  WHERE id = p_source_id AND pack_id = p_pack_id;

  RETURN jsonb_build_object(
    'knowledge_chunks', v_chunks_deleted,
    'ingestion_jobs', v_jobs_deleted
  );
END;
$$;

-- 5. Updated At Trigger
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pack_lifecycle_policies_updated_at
  BEFORE UPDATE ON public.pack_lifecycle_policies
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
