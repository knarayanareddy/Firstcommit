import { supabase } from "@/integrations/supabase/client";

export interface TrustSummary {
  total_requests: number;
  pass_rate: number;
  refusal_rate: number;
  retry_rate: number;
  p95_latency: number;
  avg_strip_rate: number;
  avg_citations: number;
  detective_usage: number;
  detective_yield: number;
}

export interface PackQualityDaily {
  pack_id: string;
  day: string;
  total_requests: number;
  gate_passed: number;
  gate_refused: number;
  retry_requests: number;
  avg_attempts: number;
  p95_total_latency_ms: number | null;
  avg_total_latency_ms: number;
  avg_strip_rate: number;
  avg_citations_found: number;
  avg_unique_files: number;
  detective_requests: number;
  avg_symbols_extracted: number;
  avg_expanded_chunks_added: number;
  avg_detective_time_ms: number;
}

const emptyTrustSummary: TrustSummary = {
  total_requests: 0,
  pass_rate: 0,
  refusal_rate: 0,
  retry_rate: 0,
  p95_latency: 0,
  avg_strip_rate: 0,
  avg_citations: 0,
  detective_usage: 0,
  detective_yield: 0,
};

export async function fetchTrustSummary(packId: string, days: number = 7, useRaw: boolean = false): Promise<TrustSummary> {
  if (!useRaw) {
    const { data: rollups, error } = await supabase
      .from("pack_quality_daily")
      .select("*")
      .eq("pack_id", packId)
      .gte("day", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (!error && rollups && rollups.length > 0) {
      const total = rollups.reduce((acc: number, r: any) => acc + r.total_requests, 0);
      const passed = rollups.reduce((acc: number, r: any) => acc + r.gate_passed, 0);
      const retried = rollups.reduce((acc: number, r: any) => acc + r.retry_requests, 0);
      const detectiveTotal = rollups.reduce((acc: number, r: any) => acc + r.detective_requests, 0);
      
      return {
        total_requests: total,
        pass_rate: (passed / total) * 100,
        refusal_rate: ((total - passed) / total) * 100,
        retry_rate: (retried / total) * 100,
        p95_latency: rollups.reduce((acc: number, r: any) => Math.max(acc, r.p95_total_latency_ms || 0), 0),
        avg_strip_rate: rollups.reduce((acc: number, r: any) => acc + (r.avg_strip_rate * r.total_requests), 0) / total,
        avg_citations: rollups.reduce((acc: number, r: any) => acc + (r.avg_citations_found * r.total_requests), 0) / total,
        detective_usage: (detectiveTotal / total) * 100,
        detective_yield: detectiveTotal > 0 
          ? rollups.reduce((acc: number, r: any) => acc + (r.avg_expanded_chunks_added * r.detective_requests), 0) / detectiveTotal 
          : 0,
      };
    }
  }

  // Fallback to raw metrics
  const { data, error: rawError } = await supabase
    .from("rag_metrics")
    .select("*")
    .eq("pack_id", packId)
    .gte("created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

  if (rawError) throw rawError;
  if (!data || data.length === 0) {
    return { ...emptyTrustSummary };
  }

  const passed = data.filter((m: any) => m.grounding_gate_passed).length;
  const total = data.length;
  const retried = data.filter((m: any) => m.attempts > 1).length;
  const detectiveUsed = data.filter((m: any) => m.detective_enabled).length;
  const detectiveData = data.filter((m: any) => m.detective_enabled);

  const latencies = data.map((m: any) => m.total_latency_ms || 0).sort((a: number, b: number) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  return {
    total_requests: total,
    pass_rate: (passed / total) * 100,
    refusal_rate: ((total - passed) / total) * 100,
    retry_rate: (retried / total) * 100,
    p95_latency: p95,
    avg_strip_rate: data.reduce((acc: number, m: any) => acc + (m.strip_rate || 0), 0) / total,
    avg_citations: data.reduce((acc: number, m: any) => acc + (m.citations_found || 0), 0) / total,
    detective_usage: (detectiveUsed / total) * 100,
    detective_yield: detectiveUsed > 0 
      ? detectiveData.reduce((acc: number, m: any) => acc + (m.expanded_chunks_added || 0), 0) / detectiveUsed 
      : 0,
  };
}

export async function fetchTrustTimeSeries(packId: string, days: number = 7, useRaw: boolean = false) {
  if (!useRaw) {
    const { data: rollups, error } = await supabase
      .from("pack_quality_daily")
      .select("*")
      .eq("pack_id", packId)
      .gte("day", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order("day", { ascending: true });

    if (!error && rollups && rollups.length > 0) {
      return rollups.map((r: any) => ({
        created_at: r.day,
        total_requests: r.total_requests,
        grounding_gate_passed: r.gate_passed,
        strip_rate: r.avg_strip_rate,
        total_latency_ms: r.avg_total_latency_ms,
        expanded_chunks_added: r.avg_expanded_chunks_added,
        detective_enabled: r.detective_requests > 0
      }));
    }
  }

  const { data, error } = await supabase
    .from("rag_metrics")
    .select("created_at, grounding_gate_passed, strip_rate, total_latency_ms, expanded_chunks_added, detective_enabled")
    .eq("pack_id", packId)
    .gte("created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchLatestRequests(packId: string, limit: number = 50, offset: number = 0) {
  const { data, error } = await supabase
    .from("rag_metrics")
    .select("*")
    .eq("pack_id", packId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data;
}

export async function fetchRequestDetail(requestId: string) {
  const { data, error } = await supabase
    .from("rag_metrics")
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchIngestionSummary(packId: string) {
  const { data: jobs, error: jobsError } = await supabase
    .from("ingestion_jobs")
    .select("*")
    .eq("pack_id", packId)
    .order("started_at", { ascending: false })
    .limit(10);

  if (jobsError) throw jobsError;

  const { count: totalChunks, error: chunksError } = await supabase
    .from("knowledge_chunks")
    .select("*", { count: 'exact', head: true })
    .eq("pack_id", packId);

  if (chunksError) throw chunksError;

  return {
    latest_jobs: jobs,
    total_chunks: totalChunks || 0,
  };
}

export async function fetchFreshnessQueueSummary(packId: string) {
  const { count: pendingCount, error: pendingErr } = await supabase
    .from("staleness_check_queue")
    .select("*", { count: 'exact', head: true })
    .eq("pack_id", packId)
    .eq("status", "pending");

  if (pendingErr) throw pendingErr;

  const { data: lastProcessed, error: procErr } = await supabase
    .from("staleness_check_queue")
    .select("processed_at, status")
    .eq("pack_id", packId)
    .in("status", ["done", "failed"])
    .order("processed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (procErr) throw procErr;

  const { count: failCount, error: failErr } = await supabase
    .from("staleness_check_queue")
    .select("*", { count: 'exact', head: true })
    .eq("pack_id", packId)
    .eq("status", "failed")
    .gte("requested_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (failErr) throw failErr;

  return {
    pending_count: pendingCount || 0,
    last_processed_at: lastProcessed?.processed_at || null,
    recent_failures: failCount || 0,
  };
}
