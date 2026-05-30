import { json, jsonError, readJson } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { requireUser } from "../_shared/authz.ts";
import { requirePackRole } from "../_shared/pack-access.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    // 1. Authenticate user
    const { userId } = await requireUser(req, corsHeaders);

    // 2. Parse request
    const { pack_id, source_id, mode = "dry_run" } = await readJson(
      req,
      corsHeaders,
    ).catch(() => ({}));

    if (!pack_id || !source_id) {
      return jsonError(
        400,
        "bad_request",
        "Missing pack_id or source_id",
        {},
        corsHeaders,
      );
    }

    // 3. Authorize pack access (Author or higher)
    const serviceClient = createServiceClient();
    await requirePackRole(
      serviceClient,
      pack_id,
      userId,
      "author",
      corsHeaders,
    );

    // 4. Verify Source Context
    const { data: source, error: sourceErr } = await serviceClient
      .from("pack_sources")
      .select("id, type, config")
      .eq("id", source_id)
      .eq("pack_id", pack_id)
      .single();

    if (sourceErr || !source) {
      return jsonError(
        404,
        "not_found",
        "Source not found for this pack",
        {},
        corsHeaders,
      );
    }

    // 5. Compute Counts
    const { count: chunkCount } = await serviceClient
      .from("knowledge_chunks")
      .select("*", { count: "exact", head: true })
      .eq("pack_id", pack_id)
      .eq("source_id", source_id);

    const { count: jobCount } = await serviceClient
      .from("ingestion_jobs")
      .select("*", { count: "exact", head: true })
      .eq("pack_id", pack_id)
      .eq("source_id", source_id);

    const counts = {
      knowledge_chunks: chunkCount || 0,
      ingestion_jobs: jobCount || 0,
    };

    let result = counts;
    let status = "completed";
    let errorMsg = null;

    // 6. Execute if requested
    if (
      mode === "execute" &&
      (counts.knowledge_chunks > 0 || counts.ingestion_jobs > 0)
    ) {
      try {
        const { data, error } = await serviceClient.rpc("purge_source_v1", {
          p_pack_id: pack_id,
          p_source_id: source_id,
          p_actor_user_id: userId,
        });
        if (error) throw error;
        result = data;
      } catch (err: any) {
        status = "failed";
        errorMsg = err.message;
      }
    }

    // 7. Log Audit Event
    await serviceClient.from("lifecycle_audit_events").insert({
      pack_id,
      actor_user_id: userId,
      action: "purge_source",
      target_type: "source",
      target_id: source_id,
      parameters: { mode, source_type: source.type },
      rows_deleted: result,
      status,
      error_message: errorMsg,
    });

    if (status === "failed") {
      throw new Error(errorMsg || "Purge execution failed");
    }

    return json(200, {
      success: true,
      mode,
      counts: result,
      message: mode === "dry_run"
        ? "Dry run successful. Ready for purge."
        : "Source purged successfully.",
    }, corsHeaders);
  } catch (error: any) {
    if (error.response) return error.response;

    console.error("purge-source error:", error);
    return jsonError(
      500,
      "internal_error",
      error.message || "Unknown error",
      {},
      corsHeaders,
    );
  }
});
