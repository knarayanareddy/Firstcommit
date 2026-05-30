-- Migration: AI Audit Log (Governance & Compliance)
-- Durable request/response records with evidence manifests.

-- 1. Extend Lifecycle Policies
ALTER TABLE public.pack_lifecycle_policies
ADD COLUMN IF NOT EXISTS retention_audit_days INT NOT NULL DEFAULT 365;

-- 2. AI Audit Events Table
CREATE TABLE IF NOT EXISTS public.ai_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Identity / Scope
  org_id UUID NULL, -- Optional, some packs might not be org-scoped yet
  pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Request Metadata
  task_type TEXT NOT NULL,
  request_id TEXT NOT NULL,
  trace_id TEXT NULL,
  provider_used TEXT NULL,
  model_used TEXT NULL,
  
  -- Decisioning Metrics
  grounding_gate_passed BOOLEAN NOT NULL,
  grounding_gate_reason TEXT NOT NULL DEFAULT 'ok',
  attempts INT NOT NULL DEFAULT 1,
  strip_rate NUMERIC(6,4) NULL,
  citations_found INT NULL,
  unique_files_count INT NULL,
  
  -- Evidence Manifest (BADGE -> {chunk_id, path, start, end})
  evidence_manifest JSONB NOT NULL DEFAULT '{}'::JSONB,
  
  -- Content Retention (Redacted previews + Hashes)
  prompt_hash TEXT NULL,
  response_hash TEXT NULL,
  prompt_preview TEXT NULL,
  response_preview TEXT NULL
);

-- 3. Optimization Indices
CREATE INDEX IF NOT EXISTS idx_ai_audit_pack_created ON public.ai_audit_events(pack_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_request_id ON public.ai_audit_events(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_user_created ON public.ai_audit_events(user_id, created_at DESC);

-- 4. Row Level Security
ALTER TABLE public.ai_audit_events ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Pack authors/admins
CREATE POLICY "Pack authors/admins can view AI audit logs"
  ON public.ai_audit_events FOR SELECT
  USING (has_pack_access(auth.uid(), pack_id, 'author'));

-- SELECT policy: Users can view their own audit (if applicable)
-- We keep this commented out for now to ensure strict author-only governance by default.
-- CREATE POLICY "Users can view their own AI audit logs"
--   ON public.ai_audit_events FOR SELECT
--   USING (auth.uid() = user_id);

-- Append-only posture: No INSERT/UPDATE/DELETE for authenticated users.
-- Insertion is strictly via service_role in Edge Functions.
-- Deletion is strictly via retention job (service_role).

-- 5. Comments
COMMENT ON TABLE public.ai_audit_events IS 'Durable audit trail of AI interactions for compliance and investigations.';
COMMENT ON COLUMN public.ai_audit_events.evidence_manifest IS 'Snapshot of citations and evidence spans used in the final response.';
COMMENT ON COLUMN public.ai_audit_events.prompt_preview IS 'Redacted first 200 chars of the user prompt.';
COMMENT ON COLUMN public.ai_audit_events.response_preview IS 'Redacted first 200 chars of the AI response.';
