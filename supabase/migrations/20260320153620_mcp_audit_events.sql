-- Migration: MCP Audit Events Table
-- Tracks MCP tool invocations for security review and forensics.
-- Distinct from ai_audit_events (which tracks AI pipeline calls).
-- Timestamp: 2026-03-20T15:40:27+01:00

-- ─── mcp_audit_events table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mcp_audit_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL    DEFAULT NOW(),

  -- Identity / Scope
  user_id       UUID        NULL        REFERENCES auth.users(id) ON DELETE SET NULL,
  pack_id       UUID        NULL        REFERENCES public.packs(id) ON DELETE SET NULL,

  -- Invocation Identity
  tool_name     TEXT        NOT NULL,
  request_id    UUID        NOT NULL,

  -- SECURITY: Only store a hash of args — never raw values
  args_hash     TEXT        NOT NULL,

  -- Result metadata (counts only — no content)
  result_summary JSONB      NOT NULL    DEFAULT '{}'::JSONB,

  -- Outcome
  status        TEXT        NOT NULL
    CHECK (status IN ('ok', 'error')),
  error_code    TEXT        NULL
);

-- ─── Indices ──────────────────────────────────────────────────────────────────

-- For per-user forensics / audit review
CREATE INDEX IF NOT EXISTS idx_mcp_audit_user_created
  ON public.mcp_audit_events (user_id, created_at DESC);

-- For per-pack audit queries and daily rate-limit lookups
CREATE INDEX IF NOT EXISTS idx_mcp_audit_pack_tool_created
  ON public.mcp_audit_events (pack_id, tool_name, created_at DESC);

-- For request correlation (cross-function tracing)
CREATE INDEX IF NOT EXISTS idx_mcp_audit_request_id
  ON public.mcp_audit_events (request_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.mcp_audit_events ENABLE ROW LEVEL SECURITY;

-- Authors and admins can view audit logs for their packs
CREATE POLICY "Pack authors can view MCP audit logs"
  ON public.mcp_audit_events
  FOR SELECT
  USING (
    pack_id IS NOT NULL
    AND has_pack_access(auth.uid(), pack_id, 'author')
  );

-- For events with no pack_id (e.g. list_my_packs), users can view their own
CREATE POLICY "Users can view their own MCP audit logs (no pack)"
  ON public.mcp_audit_events
  FOR SELECT
  USING (
    pack_id IS NULL
    AND auth.uid() = user_id
  );

-- INSERT: service_role only (Edge Function via adminClient)
-- No INSERT policy for authenticated users — append-only via service_role

-- UPDATE/DELETE: not permitted for any user role
-- Retention cleanup is handled by the lifecycle-retention-job (service_role)

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.mcp_audit_events IS
  'MCP tool invocation audit trail. Distinct from ai_audit_events. '
  'Stores only hashed args and count-based result summaries — never raw content.';

COMMENT ON COLUMN public.mcp_audit_events.args_hash IS
  'SHA-256 of canonical JSON of tool arguments. Used for forensics without exposing content.';

COMMENT ON COLUMN public.mcp_audit_events.result_summary IS
  'Count-based summary only (e.g. spans_returned, total_chars). Never full content.';

COMMENT ON COLUMN public.mcp_audit_events.request_id IS
  'UUID per tool call. Correlates MCP invocations across logs.';
