// Modern Deno.serve is built-in, no import needed for server.ts
import { storeSourceCredential } from "../_shared/credentials.ts";
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

/**
 * Edge Function to securely configure or update a source.
 */
Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req, ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);

  try {
    // 1. Authenticate user
    const { userId } = await requireUser(req, corsHeaders);

    // 2. Parse request
    const body = await readJson(req, corsHeaders);
    const {
      pack_id,
      source_id,
      source_type,
      source_uri,
      label,
      source_config,
      credentials,
    } = body;

    if (!pack_id || !source_type) {
      return jsonError(
        400,
        "bad_request",
        "Missing required fields (pack_id, source_type)",
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

    let targetSourceId = source_id;

    // 4. Upsert the pack_source record (without credentials)
    const sourceData = {
      pack_id,
      source_type,
      source_uri,
      label,
      source_config: source_config || {},
    };

    if (targetSourceId) {
      const { error: updateErr } = await serviceClient
        .from("pack_sources")
        .update(sourceData)
        .eq("id", targetSourceId);
      if (updateErr) throw updateErr;
    } else {
      const { data: newSource, error: insertErr } = await serviceClient
        .from("pack_sources")
        .insert(sourceData)
        .select()
        .single();
      if (insertErr) throw insertErr;
      targetSourceId = newSource.id;
    }

    // 5. Store credentials in Vault if provided
    if (credentials && typeof credentials === "object") {
      for (const [type, value] of Object.entries(credentials)) {
        if (value && typeof value === "string") {
          console.log(
            `[CONFIGURE-SOURCE] Storing credential ${type} for source ${targetSourceId}`,
          );
          await storeSourceCredential(
            serviceClient,
            targetSourceId,
            value,
            type,
            `${source_type} ${type} (secure)`,
          );
        }
      }
    }

    return json(200, {
      success: true,
      source_id: targetSourceId,
    }, corsHeaders);
  } catch (error: any) {
    if (error.response) return error.response;

    console.error("[CONFIGURE-SOURCE] Error:", error.message);
    return jsonError(500, "internal_error", error.message, {}, corsHeaders);
  }
});
