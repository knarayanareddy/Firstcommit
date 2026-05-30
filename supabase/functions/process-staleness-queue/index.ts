import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { requireInternal } from "../_shared/authz.ts";
import { warnIfMissingEnv } from "../_shared/env-warnings.ts";

// Local corsHeaders removed

Deno.serve(async (req) => {
  warnIfMissingEnv(
    "ROCKETBOARD_INTERNAL_SECRET",
    "process-staleness-queue auth gate",
  );
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    // Mandatory Auth Validation: Ensure caller is an authorized internal service.
    // This utilizes the repository-standard ROCKETBOARD_INTERNAL_SECRET.
    const internal = requireInternal(req, corsHeaders);
    if (!internal.success) {
      console.warn("process-staleness-queue: Unauthorized access attempt");
      return internal.response;
    }

    const serviceClient = createServiceClient();

    console.log("process-staleness-queue: Checking for pending tasks...");

    // 1. Fetch up to 20 pending items.
    // We only fetch the IDs first to lock them reliably.
    const { data: pendingRows, error: fetchErr } = await serviceClient
      .from("staleness_check_queue")
      .select("id, pack_id, attempts")
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .limit(20);

    if (fetchErr) throw fetchErr;

    if (!pendingRows || pendingRows.length === 0) {
      console.log("process-staleness-queue: No pending tasks found.");
      return json(
        200,
        { message: "No pending tasks", processed: 0 },
        corsHeaders,
      );
    }

    const results = [];

    // 2. Iterate and process
    for (const row of pendingRows) {
      // Optimistic lock: attempt to transition from 'pending' to 'processing'
      // We also increment 'attempts' and set 'started_at'
      const { data: updated, error: updateErr } = await serviceClient
        .from("staleness_check_queue")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
          attempts: (row as any).attempts ? (row as any).attempts + 1 : 1,
        })
        .eq("id", row.id)
        .eq("status", "pending")
        .select()
        .single();

      if (updateErr || !updated) {
        // Either another worker grabbed it or it's no longer pending.
        console.log(
          `process-staleness-queue: Task ${row.id} already picked up. Skipping.`,
        );
        continue;
      }

      console.log(
        `process-staleness-queue: Processing pack_id: ${row.pack_id}`,
      );

      let errorMessage = null;
      let finalStatus = "done";

      try {
        // Enforce Per-pack serialization safely. The DB effectively enforces 1 pending per pack right now.
        // But what if one is already 'processing' for this pack?
        // We can do a quick check if there's any OTHER processing task for this pack.
        // If so, we can fail or requeue.
        const { data: activeOthers } = await serviceClient
          .from("staleness_check_queue")
          .select("id")
          .eq("pack_id", row.pack_id)
          .eq("status", "processing")
          .neq("id", row.id)
          .limit(1);

        if (activeOthers && activeOthers.length > 0) {
          throw new Error(
            "Another staleness task is actively processing for this pack. Skipping to avoid collision.",
          );
        }

        // Invoke existing check-staleness edge function over internal HTTP / invoke.
        const { data: funcData, error: funcErr } = await serviceClient.functions
          .invoke("check-staleness", {
            body: { pack_id: row.pack_id },
          });

        if (funcErr) {
          throw funcErr;
        }

        console.log(
          `process-staleness-queue: Successfully checked staleness for pack_id: ${row.pack_id}. Results:`,
          funcData,
        );
      } catch (checkErr: any) {
        console.error(
          `process-staleness-queue: Error processing pack ${row.pack_id}:`,
          checkErr.message,
        );
        errorMessage = checkErr.message;
        finalStatus = "failed";
      }

      // Finalize status
      await serviceClient.from("staleness_check_queue").update({
        status: finalStatus,
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      }).eq("id", row.id);

      // Audit Record
      await serviceClient.from("lifecycle_audit_events").insert({
        pack_id: row.pack_id,
        action: "staleness_queue_processed",
        actor_id: null,
        details: {
          status: finalStatus,
          error_message: errorMessage,
          queue_id: row.id,
        },
      });

      results.push({ id: row.id, pack_id: row.pack_id, status: finalStatus });
    }

    return json(200, { processed: results.length, results }, corsHeaders);
  } catch (err: any) {
    console.error("process-staleness-queue: Uncaught error:", err.message);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
