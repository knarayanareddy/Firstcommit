// @ts-nocheck
import { extractSymbols } from "../_shared/symbol-extractor.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { updateHeartbeat } from "../_shared/ingestion-guards.ts";
import { requireInternal } from "../_shared/authz.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";

const ALLOWED_ORIGINS = parseAllowedOrigins();

const SYMBOL_BATCH_SIZE = 50; // Process 50 chunks for symbols per invocation

async function runSymbolBatch(
  serviceClient: any,
  jobId: string,
  functionUrl: string,
) {
  // 1. Fetch current state
  const { data: state, error: stateErr } = await serviceClient
    .from("ingestion_job_state")
    .select("*")
    .eq("job_id", jobId)
    .single();

  if (stateErr || !state) {
    console.error("[SYMBOL_WORKER] Failed to fetch job state:", stateErr);
    return;
  }

  // Update phase to build_symbol_graph
  await serviceClient.from("ingestion_jobs").update({
    phase: "build_symbol_graph",
    elapsed_ms: state.created_at
      ? (Date.now() - new Date(state.created_at).getTime())
      : 0,
  }).eq("id", jobId);

  // 2. Fetch chunks in batch
  const { data: chunks, error: chunksErr } = await serviceClient
    .from("knowledge_chunks")
    .select("*")
    .eq("generation_id", jobId)
    .order("chunk_id") // Consistent ordering
    .range(state.symbol_cursor, state.symbol_cursor + SYMBOL_BATCH_SIZE - 1);

  if (chunksErr) throw chunksErr;

  if (!chunks || chunks.length === 0) {
    // Phase 3: Atomic Swap & Complete
    console.log(
      `[SYMBOL_WORKER] Symbol building complete for job ${jobId}. Finalizing...`,
    );

    const { data: job } = await serviceClient.from("ingestion_jobs").select(
      "pack_id, source_id",
    ).eq("id", jobId).single();
    if (!job) throw new Error("Job not found");
    const { data: pack } = await serviceClient.from("packs").select("org_id")
      .eq("id", job.pack_id).single();

    await serviceClient.from("pack_active_generation").upsert({
      org_id: pack.org_id,
      pack_id: job.pack_id,
      active_generation_id: jobId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,pack_id" });

    await serviceClient.from("pack_sources").update({
      last_synced_at: new Date().toISOString(),
    }).eq("id", job.source_id);

    await serviceClient.from("ingestion_jobs").update({
      phase: "completed",
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    // Cleanup state
    await serviceClient.from("ingestion_job_state").delete().eq(
      "job_id",
      jobId,
    );
    return;
  }

  console.log(
    `[SYMBOL_WORKER] Processing symbols for chunks ${state.symbol_cursor} to ${
      state.symbol_cursor + chunks.length
    }`,
  );

  const definitions: any[] = [];
  const references: any[] = [];

  for (const chunk of chunks) {
    if (chunk.is_redacted) continue;

    // Definitions
    const symbols = new Set([
      chunk.entity_name,
      ...(chunk.exported_names || []),
    ]);
    symbols.delete("anonymous");
    symbols.delete("file_scope");
    symbols.delete(undefined);
    symbols.delete(null);

    for (const s of symbols) {
      if (!s) continue;
      definitions.push({
        pack_id: chunk.pack_id,
        source_id: chunk.source_id,
        symbol: s,
        chunk_id: chunk.chunk_id,
        path: chunk.path,
        line_start: chunk.start_line,
        line_end: chunk.end_line,
      });
    }

    // References
    const ext = (chunk.path || "").split(".").pop() || "ts";
    const refs = extractSymbols(chunk.content, ext);
    for (const r of refs) {
      if (!symbols.has(r)) {
        references.push({
          pack_id: chunk.pack_id,
          source_id: chunk.source_id,
          symbol: r,
          from_chunk_id: chunk.chunk_id,
          from_path: chunk.path,
          from_line_start: chunk.start_line,
          from_line_end: chunk.end_line,
          confidence: 1.0,
        });
      }
    }
  }

  if (definitions.length > 0) {
    const { error: defErr } = await serviceClient.from("symbol_definitions")
      .upsert(definitions);
    if (defErr) {
      console.error("[SYMBOL_WORKER] Definition upsert error:", defErr);
    }
  }

  if (references.length > 0) {
    const { error: refErr } = await serviceClient.from("symbol_references")
      .upsert(references);
    if (refErr) {
      console.error("[SYMBOL_WORKER] Reference upsert error:", refErr);
    }
  }

  // Update cursor
  const nextCursor = state.symbol_cursor + chunks.length;
  await serviceClient.from("ingestion_job_state").update({
    symbol_cursor: nextCursor,
    updated_at: new Date().toISOString(),
  }).eq("job_id", jobId);

  // Self-schedule next batch
  const internalSecret = Deno.env.get("ROCKETBOARD_INTERNAL_SECRET");
  if (!internalSecret) {
    console.warn(
      "[SYMBOL_WORKER WARNING] Missing ROCKETBOARD_INTERNAL_SECRET, falling back to Service Role Bearer token for internal calls.",
    );
  }
  const internalHeaders = internalSecret
    ? {
      "Content-Type": "application/json",
      "X-Rocketboard-Internal": internalSecret,
    }
    : {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    };

  fetch(functionUrl, {
    method: "POST",
    headers: internalHeaders,
    body: JSON.stringify({ jobId }),
  }).catch((e) => console.error("[SYMBOL_WORKER] Self-scheduling failed:", e));
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req, ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);

  const authz = requireInternal(req, corsHeaders);
  if (!authz.success) return authz.response;

  try {
    const { jobId, job_id } = await readJson(req, corsHeaders);
    const effectiveJobId = jobId || job_id;
    const serviceClient = createServiceClient();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const functionUrl = `${supabaseUrl}/functions/v1/build-symbol-graph`;

    const task = runSymbolBatch(serviceClient, effectiveJobId, functionUrl);

    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(task);
    else task.catch((e) => console.error("[SYMBOL_WORKER] Task failed:", e));

    return json(202, { success: true }, corsHeaders);
  } catch (err: any) {
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
