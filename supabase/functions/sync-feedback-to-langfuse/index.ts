import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { Langfuse } from "npm:langfuse@2";

// Local corsHeaders removed

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    const payload = await readJson(req, corsHeaders);
    console.log("[sync-feedback] Received payload:", payload);

    // Supabase Webhooks send the row in payload.record
    const record = payload.record || payload;
    const { trace_id, rating, feedback_text, category } = record;

    if (!trace_id) {
      return json(200, { skipped: "No trace_id found in record" }, corsHeaders);
    }

    const langfuse = new Langfuse({
      publicKey: Deno.env.get("LANGFUSE_PUBLIC_KEY")!,
      secretKey: Deno.env.get("LANGFUSE_SECRET_KEY")!,
      baseUrl: Deno.env.get("LANGFUSE_BASE_URL") ||
        "https://cloud.langfuse.com",
    });

    // Map rating/category to numeric score if possible
    // e.g. Positive = 1, Negative = -1
    let scoreValue = 0;
    if (rating === "positive") scoreValue = 1;
    if (rating === "negative") scoreValue = -1;

    // We can also emit a boolean score for "has-comment"
    if (feedback_text) {
      await langfuse.score({
        traceId: trace_id,
        name: "user-comment-provided",
        value: 1,
        comment: feedback_text.slice(0, 100),
      });
    }

    await langfuse.score({
      traceId: trace_id,
      name: "user-feedback",
      value: scoreValue,
      comment: category || rating,
    });

    await langfuse.shutdownAsync();

    return json(
      200,
      { success: true, trace_id, score: scoreValue },
      corsHeaders,
    );
  } catch (err: any) {
    console.error("[sync-feedback] Error:", err.message);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
