-- Migration: v1 Minimal Trust Rollup
-- Daily aggregates for rag_metrics only

-- 1. Trigger function for updated_at (if not already exists)
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Quality Rollup Table (v1 Minimal)
CREATE TABLE IF NOT EXISTS public.pack_quality_daily (
  pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  total_requests INT NOT NULL DEFAULT 0,
  gate_passed INT NOT NULL DEFAULT 0,
  gate_refused INT NOT NULL DEFAULT 0,
  retry_requests INT NOT NULL DEFAULT 0,
  avg_attempts NUMERIC(6,3) NOT NULL DEFAULT 0,
  avg_total_latency_ms NUMERIC(10,3) NOT NULL DEFAULT 0,
  p95_total_latency_ms INT NULL,
  avg_strip_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  avg_citations_found NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pack_id, day)
);

CREATE INDEX IF NOT EXISTS idx_pack_quality_daily_lookup ON public.pack_quality_daily(pack_id, day);

ALTER TABLE public.pack_quality_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack authors can view quality rollups"
  ON public.pack_quality_daily FOR SELECT
  USING (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE TRIGGER trg_pack_quality_daily_updated_at
  BEFORE UPDATE ON public.pack_quality_daily
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- 3. RPC for v1 Aggregation
CREATE OR REPLACE FUNCTION public.rollup_pack_quality_aggregates(p_day_from DATE, p_day_to DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.pack_quality_daily (
    pack_id, day, total_requests, gate_passed, gate_refused, retry_requests,
    avg_attempts, avg_total_latency_ms, p95_total_latency_ms,
    avg_strip_rate, avg_citations_found
  )
  SELECT 
    pack_id,
    created_at::date as day,
    count(*) as total_requests,
    count(*) filter (where grounding_gate_passed = true) as gate_passed,
    count(*) filter (where grounding_gate_passed = false) as gate_refused,
    count(*) filter (where attempts > 1) as retry_requests,
    avg(attempts)::numeric(6,3) as avg_attempts,
    avg(total_latency_ms)::numeric(10,3) as avg_total_latency_ms,
    percentile_cont(0.95) within group (order by total_latency_ms)::int as p95_total_latency_ms,
    avg(COALESCE(strip_rate, 0))::numeric(6,4) as avg_strip_rate,
    avg(citations_found)::numeric(10,3) as avg_citations_found
  FROM public.rag_metrics
  WHERE pack_id IS NOT NULL 
    AND created_at::date >= p_day_from AND created_at::date <= p_day_to
  GROUP BY pack_id, created_at::date
  ON CONFLICT (pack_id, day) DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    gate_passed = EXCLUDED.gate_passed,
    gate_refused = EXCLUDED.gate_refused,
    retry_requests = EXCLUDED.retry_requests,
    avg_attempts = EXCLUDED.avg_attempts,
    avg_total_latency_ms = EXCLUDED.avg_total_latency_ms,
    p95_total_latency_ms = EXCLUDED.p95_total_latency_ms,
    avg_strip_rate = EXCLUDED.avg_strip_rate,
    avg_citations_found = EXCLUDED.avg_citations_found,
    updated_at = NOW();
END;
$$;
