// @ts-nocheck
import { json, jsonError, readJson } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { requireUser } from "../_shared/authz.ts";
import { requirePackRole } from "../_shared/pack-access.ts";

const ALLOWED_ORIGINS = parseAllowedOrigins();

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req, ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);

  try {
    const { pack_id, source_id } = await readJson(req, corsHeaders);

    if (!pack_id) {
      return jsonError(400, "bad_request", "Missing pack_id", {}, corsHeaders);
    }

    // 1. Authenticate user
    const { userId } = await requireUser(req, corsHeaders);

    // 2. Authorize pack access (Authors/Admins only)
    const serviceClient = createServiceClient();
    await requirePackRole(
      serviceClient,
      pack_id,
      userId,
      "author",
      corsHeaders,
    );

    // 3. Mark the job as failed if it's processing and hasn't had a heartbeat in 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const query = serviceClient
      .from("ingestion_jobs")
      .update({
        status: "failed",
        error_message: "Reset: stalled job cleared for manual re-sync",
        completed_at: new Date().toISOString(),
      })
      .match({ pack_id, status: "processing" })
      .lt("last_heartbeat_at", tenMinutesAgo);

    if (source_id) {
      query.eq("source_id", source_id);
    }

    const { data: updatedJobs, error: updateError } = await query.select();

    if (updateError) {
      console.error("[RESET] Failed to reset jobs:", updateError);
      return jsonError(
        500,
        "reset_failed",
        updateError.message,
        {},
        corsHeaders,
      );
    }

    if (!updatedJobs || updatedJobs.length === 0) {
      return json(
        200,
        { success: true, message: "No stalled jobs found." },
        corsHeaders,
      );
    }

    // 4. Audit Log
    // Schema: lifecycle_audit_events(id, pack_id, actor_user_id, action, target_type, target_id, parameters, status, created_at)
    await serviceClient.from("lifecycle_audit_events").insert({
      pack_id,
      action: "source_reset",
      target_type: "source",
      target_id: source_id || null, // null if pack-wide reset
      actor_user_id: userId,
      status: "completed",
      parameters: {
        job_ids: updatedJobs.map((j) => j.id),
        source_id: source_id || "all",
        reason: "manual_reset_stalled",
      },
    });

    console.log(
      `[RESET] Successfully reset ${updatedJobs.length} jobs for pack ${pack_id}${
        source_id ? ` and source ${source_id}` : ""
      }`,
    );

    return json(200, {
      success: true,
      message:
        `Successfully reset ${updatedJobs.length} stalled ingestion job(s).`,
    }, corsHeaders);
  } catch (err: any) {
    console.error("[RESET] Error:", err.message);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
