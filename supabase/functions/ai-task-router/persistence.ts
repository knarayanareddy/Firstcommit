// @ts-nocheck — relocated from index.ts (itself @ts-nocheck); DB/telemetry glue, type-tightening tracked.
/**
 * persistence.ts — RAG metrics + AI audit event writers (monolith split, stage 3c).
 */
import { createServiceClient } from "../_shared/supabase-clients.ts";
import type { TraceBuilder } from "../_shared/telemetry.ts";
import { buildEvidenceManifest, sha256 } from "./grounding.ts";

export async function recordRagMetrics(trace: TraceBuilder, envelope: any) {
  try {
    const data = trace.getData();
    if (!data.generation) return;

    const supabase = createServiceClient();

    const gen = data.generation;
    const task = envelope.task || {};
    const pack = envelope.pack || {};
    const retrieval = envelope.retrieval || {};
    const detective = retrieval._detective_metrics || {};

    // Calculate aggregate retrieval metrics
    const spans = retrieval.evidence_spans || [];
    const avgRelevance = spans.length > 0
      ? spans.reduce(
        (acc: number, s: any) => acc + (s.relevance_score || 0),
        0,
      ) / spans.length
      : 0;
    const uniqueFilesCount = new Set(spans.map((s: any) => s.path)).size;

    await supabase.from("rag_metrics").insert({
      org_id: pack.org_id,
      pack_id: pack.pack_id,
      user_id: data.metadata?.userId,
      query: "[chat history or prompt redacted]",
      task_type: data.metadata?.taskType,
      request_id: data.metadata?.requestId,
      trace_id: data.traceId,

      // Retrieval Metrics
      retrieval_method: retrieval.method || "hybrid",
      chunks_retrieved: spans.length,
      chunks_after_rerank: spans.filter((s: any) =>
        (s.relevance_score || 0) >= 3
      ).length,
      avg_relevance_score: avgRelevance,
      retrieval_latency_ms: retrieval.latency_ms || 0,

      // Generation Metrics
      model_used: gen.model,
      provider_used: data.metadata?.provider || "default",
      generation_latency_ms: gen.latencyMs,
      input_tokens: gen.inputTokens,
      output_tokens: gen.outputTokens,

      // Grounding/Verification Metrics
      citations_found: gen.citationsFound || 0,
      citations_verified: (gen.citationsFound || 0) - (gen.claimsStripped || 0),
      citations_failed: gen.claimsStripped || 0,
      grounding_score: gen.groundingScore,
      attempts: gen.attempts || 1,
      strip_rate: gen.stripRate || 0,
      claims_total: gen.claimsTotal || 0,
      claims_stripped: gen.claimsStripped || 0,
      snippets_resolved: gen.snippetsResolved || 0,
      unique_files_count: uniqueFilesCount,

      // Detective Loop Metrics
      detective_enabled: detective.detective_enabled || false,
      kg_enabled: detective.kg_enabled || false,
      kg_added_spans: detective.kg_added_spans || 0,
      kg_definition_hits: detective.kg_definition_hits || 0,
      kg_reference_hits: detective.kg_reference_hits || 0,
      kg_time_ms: detective.kg_time_ms || 0,
      rerank_skipped: detective.rerank_skipped || false,
      rerank_skip_reason: detective.rerank_skip_reason || null,
      retrieval_hops: detective.hops_run || 0,
      symbols_extracted: detective.symbols_extracted || 0,
      expanded_chunks_added: (detective.hop1_added || 0) +
        (detective.hop2_added || 0) + (detective.kg_added_spans || 0),
      detective_time_ms: detective.time_ms || 0,

      total_latency_ms: Date.now() - data.startTime,

      // Grounding Gate Metrics
      grounding_gate_mode: gen.groundingPolicy?.mode || "off",
      grounding_gate_passed: gen.groundingGatePassed ?? true,
      grounding_gate_reason: gen.groundingGateReason || "ok",
      grounding_threshold_score: gen.groundingPolicy?.min_score || 0.80,
      grounding_threshold_strip: gen.groundingPolicy?.max_strip_rate || 0.20,
    });
  } catch (e) {
    console.warn("[recordRagMetrics] failed:", e.message);
  }
}

// ─── AI AUDIT LOG (Governance & Compliance) ───

export async function recordAiAudit(
  trace: TraceBuilder,
  envelope: any,
  responseMarkdown: string,
) {
  try {
    const data = trace.getData();
    if (!data.generation) return;

    const supabase = createServiceClient();

    const gen = data.generation;
    const task = envelope.task || {};
    const pack = envelope.pack || {};
    const context = envelope.context || {};
    const retrieval = envelope.retrieval || {};

    // REDACTED PREVIEWS
    const promptPreview = JSON.stringify(context.conversation?.messages || [])
      .slice(0, 200);
    const responsePreview = responseMarkdown.slice(0, 200);

    await supabase.from("ai_audit_events").insert({
      org_id: pack.org_id,
      pack_id: pack.pack_id,
      user_id: data.metadata?.userId,

      task_type: data.metadata?.taskType,
      request_id: data.metadata?.requestId || task.request_id,
      trace_id: data.traceId,
      provider_used: data.metadata?.provider || "default",
      model_used: gen.model,

      grounding_gate_passed: gen.groundingGatePassed ?? true,
      grounding_gate_reason: gen.groundingGateReason || "ok",
      attempts: gen.attempts || 1,
      strip_rate: gen.stripRate || 0,
      citations_found: gen.citationsFound || 0,
      unique_files_count: gen.uniqueFilesCount || 0,

      evidence_manifest: buildEvidenceManifest(retrieval, gen.sourceMap || []),

      prompt_hash: await sha256(
        JSON.stringify(context.conversation?.messages || []),
      ),
      response_hash: await sha256(responseMarkdown),
      prompt_preview: promptPreview,
      response_preview: responsePreview,
    });
  } catch (e) {
    console.warn("[recordAiAudit] failed:", e.message);
  }
}

// ─── ENVELOPE PREPROCESSOR (sanitization + redaction) ───
