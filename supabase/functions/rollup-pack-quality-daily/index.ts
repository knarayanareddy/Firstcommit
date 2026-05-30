import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";

// Local corsHeaders removed

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronToken = Deno.env.get("CRON_AUTH_TOKEN");

    // Auth check: service_role or CRON_AUTH_TOKEN
    const isAuthorized = authHeader === `Bearer ${serviceKey}` ||
      (cronToken && authHeader === `Bearer ${cronToken}`);

    if (!isAuthorized) {
      return jsonError(
        401,
        "unauthorized",
        "Invalid credentials",
        {},
        corsHeaders,
      );
    }

    const supabase = createServiceClient();

    const { pack_id, day_from, day_to, dry_run = false } = await readJson(
      req,
      corsHeaders,
    ).catch(() => ({}));

    // Default range: yesterday and today
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const from = day_from || yesterday.toISOString().split("T")[0];
    const to = day_to || now.toISOString().split("T")[0];

    console.log(
      `[rollup-v1] Aggregating from ${from} to ${to} ${
        pack_id ? `for pack ${pack_id}` : "for all packs"
      }`,
    );

    if (dry_run) {
      // In dry_run, we just select the aggregates to log them
      const { data, error } = await supabase
        .from("rag_metrics")
        .select(`
          pack_id,
          created_at.date(),
          count(*)
        `)
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59");

      return json(200, { dry_run: true, data, error }, corsHeaders);
    }

    // Perform idempotent rollup via RPC
    const { error } = await supabase.rpc("rollup_pack_quality_aggregates", {
      p_day_from: from,
      p_day_to: to,
    });

    if (error) {
      console.error("[rollup-v1] RPC Error:", error);
      throw error;
    }

    return json(200, {
      success: true,
      range: { from, to },
      processed_at: new Date().toISOString(),
    }, corsHeaders);
  } catch (err: any) {
    console.error("[rollup-v1] Error:", err.message);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
