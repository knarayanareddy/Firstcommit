import { createTrace } from "../_shared/telemetry.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { requireUser } from "../_shared/authz.ts";
import { requirePackRole } from "../_shared/pack-access.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";

async function generateEmbeddingOpenAI(
  text: string,
  apiKey: string,
  useLocalEndpoint: boolean,
): Promise<number[] | null> {
  if (!apiKey) return null;
  try {
    const url = useLocalEndpoint
      ? ((Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1") +
        "/embeddings")
      : "https://api.openai.com/v1/embeddings";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text.replace(/\n/g, " "),
        model: Deno.env.get("EMBEDDING_MODEL") || "text-embedding-3-small",
      }),
    });
    if (!res.ok) {
      console.error("OpenAI Embedding error:", await res.text());
      return null;
    }
    const data = await res.json();
    return data.data[0].embedding;
  } catch (err) {
    console.error("OpenAI Embedding generation failed:", err);
    return null;
  }
}

async function generateEmbeddingGoogle(
  text: string,
  apiKey: string,
): Promise<number[] | null> {
  if (!apiKey) return null;
  try {
    // Google Gemini text-embedding-004 via native API (not OpenAI-compatible)
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: text.replace(/\n/g, " ") }] },
      }),
    });
    if (!res.ok) {
      console.error("Google Embedding error:", await res.text());
      return null;
    }
    const data = await res.json();
    return data.embedding?.values || null;
  } catch (err) {
    console.error("Google Embedding generation failed:", err);
    return null;
  }
}

async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  // EMBEDDING_PROVIDER selects the embedding backend. It MUST match the provider used
  // to embed the stored chunks (same model + vector dimension) or hybrid search breaks.
  const provider = (Deno.env.get("EMBEDDING_PROVIDER") || "openai")
    .toLowerCase();
  const forceLocal = provider === "local" || provider === "ollama" ||
    provider === "llamacpp";
  const openAIApiKey = forceLocal ? "" : (Deno.env.get("OPENAI_API_KEY") || "");
  const localApiKey = Deno.env.get("LOCAL_LLM_API_KEY") ||
    (forceLocal ? "ollama" : "");
  const googleApiKey = forceLocal
    ? ""
    : (Deno.env.get("GOOGLE_AI_API_KEY") || "");

  // Local-first when forced (keeps query embeddings consistent with locally-embedded chunks)
  if (forceLocal && localApiKey) {
    const result = await generateEmbeddingOpenAI(text, localApiKey, true);
    if (result) return result;
  }

  // Try OpenAI first (default)
  if (openAIApiKey) {
    const result = await generateEmbeddingOpenAI(text, openAIApiKey, false);
    if (result) return result;
  }

  // Then local LLM endpoint
  if (localApiKey) {
    const result = await generateEmbeddingOpenAI(text, localApiKey, true);
    if (result) return result;
  }

  // Finally Google Gemini
  if (googleApiKey) {
    console.log("[RETRIEVAL] Falling back to Google text-embedding-004");
    const result = await generateEmbeddingGoogle(text, googleApiKey);
    if (result) return result;
  }

  return null;
}

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);
  const startTime = Date.now();

  let trace = createTrace({ taskType: "startup", requestId: "unknown" }, {
    enabled: false,
  });
  let requestId = "unknown";

  try {
    // 1. Authenticate user
    const { userId } = await requireUser(req, corsHeaders);

    // 2. Parse request
    const body = await readJson(req, corsHeaders);
    const {
      pack_id,
      query,
      max_spans = 10,
      module_key,
      track_key,
      match_threshold,
    } = body;

    // ─── Phase 6: Observability — create trace ── Correlate with router requestId
    trace = createTrace({
      taskType: "retrieve-spans",
      requestId,
      packId: pack_id,
      userId,
      serviceName: "retrieval",
    });

    if (!pack_id || !query || typeof query !== "string") {
      return jsonError(
        400,
        "bad_request",
        "Missing pack_id or valid query",
        {},
        corsHeaders,
      );
    }

    // Defensive Caps
    const clampedQuery = query.trim().slice(0, 500);
    const clampedMaxSpans = Math.min(Math.max(Number(max_spans) || 10, 1), 50);

    const adminClient = createServiceClient();

    // 3. Authorize pack access (Learner or higher)
    await requirePackRole(adminClient, pack_id, userId, "learner", corsHeaders);

    // Resolve org_id and verify pack exists
    const { data: packData, error: packError } = await adminClient
      .from("packs")
      .select("org_id")
      .eq("id", pack_id)
      .maybeSingle();

    if (packError || !packData) {
      return jsonError(404, "not_found", "Pack not found", {}, corsHeaders);
    }

    const org_id = packData.org_id;

    if (clampedQuery.length === 0) {
      return json(200, { spans: [] }, corsHeaders);
    }

    let embedding = null;

    const embedSpan = trace.startSpan("generate-embedding");
    embedding = await generateEmbedding(clampedQuery);
    embedSpan.end({ success: !!embedding });

    // Reliability: Fallback to keyword-only search if embedding fails
    if (!embedding) {
      console.warn(
        "[RETRIEVAL] Embedding generation failed, falling back to keyword search.",
      );
    }

    console.log(
      `[RETRIEVAL] Using hybrid_search_v2 for pack ${pack_id}, org ${org_id}. Context: ${
        module_key || "global"
      }`,
    );

    const rpcSpan = trace.startSpan("rpc:hybrid_search_v2");
    const { data: chunks, error: rpcError } = await adminClient.rpc(
      "hybrid_search_v2",
      {
        p_org_id: org_id,
        p_pack_id: pack_id,
        p_query_text: clampedQuery,
        p_query_embedding: embedding,
        p_match_count: clampedMaxSpans,
        p_match_threshold: match_threshold !== undefined
          ? Number(match_threshold)
          : undefined,
        p_module_key: module_key || null,
        p_track_key: track_key || null,
      },
    );
    rpcSpan.end({ count: chunks?.length || 0, error: !!rpcError });

    if (rpcError) {
      console.error("Hybrid Search error:", rpcError);
      return jsonError(
        500,
        "internal_error",
        "Hybrid search failed",
        {},
        corsHeaders,
      );
    }

    // ─── Phase 2: Cross-Repo Path Normalization & Identifier Resolution ───
    // 1. Resolve row UUIDs back to stable TEXT identifiers (chunk_id) and source_id conditionally
    // We only perform this follow-up query if the search RPC returned rows missing stable identifiers,
    // which happens on older migrations or specific RPC variants.
    const chunksToResolve = (chunks || []).filter((c: any) =>
      !c.chunk_id || !c.source_id || !c.path
    );
    const idsToResolve = chunksToResolve.map((c: any) => c.id).filter(Boolean);
    const idToStableMap = new Map<
      string,
      { chunk_id: string; source_id: string; path: string }
    >();

    let resolve_query_ran = false;
    let resolve_ids_count = 0;

    if (idsToResolve.length > 0) {
      resolve_query_ran = true;
      resolve_ids_count = idsToResolve.length;

      const { data: resolved, error: resolveErr } = await adminClient
        .from("knowledge_chunks")
        .select("id, chunk_id, source_id, path")
        .in("id", idsToResolve)
        .eq("pack_id", pack_id);

      if (resolveErr) {
        console.error(
          "[RETRIEVAL:Resolve] Failed to resolve stable identifiers:",
          resolveErr,
        );
      } else {
        for (const row of (resolved || [])) {
          idToStableMap.set(row.id, {
            chunk_id: row.chunk_id,
            source_id: row.source_id,
            path: row.path,
          });
        }
      }
    }

    // 2. Resolve sources for slugs
    // We need source_ids from the original chunks OR the resolved map
    const allSourceIds = new Set<string>();
    (chunks || []).forEach((c: any) => {
      const sid = c.source_id || idToStableMap.get(c.id)?.source_id;
      if (sid) allSourceIds.add(sid);
    });

    const slugMap = new Map();
    if (allSourceIds.size > 0) {
      const { data: sources } = await adminClient
        .from("pack_sources")
        .select("id, short_slug")
        .in("id", Array.from(allSourceIds));

      for (const s of (sources || [])) {
        slugMap.set(s.id, s.short_slug);
      }
    }

    const spans = (chunks || []).map((chunk: any, idx: number) => {
      const resolved = idToStableMap.get(chunk.id);
      const sourceId = chunk.source_id || resolved?.source_id;
      const slug = slugMap.get(sourceId);
      const filePath = chunk.path || resolved?.path;
      const displayPath = slug && slug.trim()
        ? `${slug}/${filePath}`
        : filePath;

      const stableChunkId = chunk.chunk_id || resolved?.chunk_id || null;
      const chunkRef = stableChunkId || chunk.id;
      const chunkRefKind = stableChunkId ? "stable" : "uuid_fallback";

      if (chunkRefKind === "uuid_fallback") {
        console.warn(
          `[RETRIEVAL] Warning: Failed to resolve stable chunk_id for UUID ${chunk.id}. Falling back.`,
        );
      }

      return {
        span_id: `S${idx + 1}`,
        path: displayPath,
        chunk_ref: chunkRef,
        chunk_pk: chunk.id, // Explicit UUID
        stable_chunk_id: stableChunkId, // Explicit stable TEXT or null
        chunk_id: stableChunkId, // Backward compatibility: TEXT OR NULL (Never UUID)
        start_line: chunk.line_start || chunk.start_line,
        end_line: chunk.line_end || chunk.end_line,
        text: chunk.content,
        metadata: {
          entity_type: chunk.entity_type,
          entity_name: chunk.entity_name,
          signature: chunk.signature,
          source_id: sourceId,
          source_slug: slug,
          chunk_ref_kind: chunkRefKind,
          resolve_query_ran,
          resolve_ids_count,
        },
      };
    });

    // Phase 7: Rich Retrieval Diagnostics
    const scores = (chunks || []).map((c: any) => c.score || 0) as number[];
    const top1Score = scores.length > 0 ? Math.max(...scores) : 0;
    const avgScore = scores.length > 0
      ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
      : 0;
    const uniqueFiles = new Set((chunks || []).map((c: any) =>
      c.path as string
    )).size;

    const latency_ms = Date.now() - startTime;

    // Update trace with advanced RAG metadata
    trace.updateMetadata({
      top1_score: top1Score,
      avg_score: avgScore,
      unique_files_count: uniqueFiles,
      embedding_model: Deno.env.get("EMBEDDING_MODEL") ||
        "text-embedding-3-small",
    });

    await trace.flush();

    return json(200, {
      spans,
      trace_id: requestId,
      latency_ms,
    }, corsHeaders);
  } catch (error: any) {
    if (error.response) return error.response;

    const latency_ms = Date.now() - startTime;
    trace.setError(error.message);
    await trace.flush();
    console.error("retrieve-spans error:", error);
    return jsonError(500, "internal_error", error.message || "Unknown error", {
      trace_id: requestId,
      latency_ms,
    }, corsHeaders);
  }
});
