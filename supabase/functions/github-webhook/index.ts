import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { warnIfMissingEnv } from "../_shared/env-warnings.ts";

function hexToUint8Array(hex: string): Uint8Array {
  const view = new Uint8Array(hex.length / 2);
  for (let i = 0; i < view.length; i++) {
    view[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return view;
}

import { enforceSignaturePolicy } from "./signature-policy.ts";

Deno.serve(async (req) => {
  warnIfMissingEnv("GITHUB_WEBHOOK_SECRET", "github-webhook HMAC verification");
  warnIfMissingEnv(
    "ROCKETBOARD_INTERNAL_SECRET",
    "github-webhook internal service calls",
  );
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createServiceClient();

    // GitHub sends events as POST
    const signature = req.headers.get("x-hub-signature-256");
    const event = req.headers.get("x-github-event");

    if (event !== "push") {
      return json(200, { message: "Ignored event" }, corsHeaders);
    }

    // 1. Verify Signature
    const webhookSecret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
    const environment = Deno.env.get("ENVIRONMENT") || "production";

    const policy = enforceSignaturePolicy(webhookSecret, environment);

    if (!policy.allowed) {
      console.error(`[WEBHOOK ERROR] ${policy.errorMsg}`);
      return jsonError(
        401,
        "unauthorized",
        policy.errorMsg || "Missing signature secret",
        {},
        corsHeaders,
      );
    }

    if (policy.warnMsg) {
      console.warn(`[WEBHOOK WARNING] ${policy.warnMsg}`);
    } else if (!signature) {
      console.error("[WEBHOOK ERROR] Missing x-hub-signature-256 header");
      return jsonError(
        401,
        "unauthorized",
        "Missing signature",
        {},
        corsHeaders,
      );
    } else {
      const bodyText = await req.text();
      const hmac = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      const sigUint8 = hexToUint8Array(signature.replace("sha256=", ""));
      const isVerified = await crypto.subtle.verify(
        "HMAC",
        hmac,
        sigUint8.buffer as ArrayBuffer,
        new TextEncoder().encode(bodyText),
      );

      if (!isVerified) {
        console.error("[WEBHOOK ERROR] Invalid HMAC signature");
        return jsonError(
          401,
          "unauthorized",
          "Invalid signature",
          {},
          corsHeaders,
        );
      }

      var payload = JSON.parse(bodyText);
    }

    if (typeof payload === "undefined") {
      payload = await readJson(req, corsHeaders);
    }
    const repoUrl = payload.repository?.html_url;

    if (!repoUrl) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find all packs that use this repository as a source
    const { data: sources, error: sErr } = await serviceClient
      .from("pack_sources")
      .select("pack_id")
      .ilike("source_uri", `%${repoUrl}%`);

    if (sErr) throw sErr;

    const packIds = [...new Set((sources || []).map((s: any) => s.pack_id))];
    console.log(
      `[WEBHOOK] Push to ${repoUrl} affects ${packIds.length} pack(s)`,
    );

    const commits = payload.commits || [];
    const changedFiles = new Set<string>();
    commits.forEach((c: any) => {
      (c.added || []).forEach((f: string) => changedFiles.add(f));
      (c.modified || []).forEach((f: string) => changedFiles.add(f));
      (c.removed || []).forEach((f: string) => changedFiles.add(f));
    });
    const changedFilesList = Array.from(changedFiles);
    const compareUrl = payload.compare;

    const internalSecret = Deno.env.get("ROCKETBOARD_INTERNAL_SECRET");
    if (!internalSecret) {
      console.warn(
        "[WEBHOOK WARNING] Missing ROCKETBOARD_INTERNAL_SECRET, falling back to Service Role Bearer token for internal calls.",
      );
    }

    const internalHeaders: Record<string, string> = internalSecret
      ? {
        "Content-Type": "application/json",
        "X-Rocketboard-Internal": internalSecret,
      }
      : {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      };

    for (const packId of packIds) {
      // 1. Mark as stale
      await fetch(`${supabaseUrl}/functions/v1/check-staleness`, {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({ pack_id: packId }),
      });
      console.log(`[WEBHOOK] Triggered staleness check for pack ${packId}`);

      // 2. Trigger async remediation drafting
      if (changedFilesList.length > 0 && compareUrl) {
        await fetch(`${supabaseUrl}/functions/v1/auto-remediate-module`, {
          method: "POST",
          headers: internalHeaders,
          body: JSON.stringify({
            pack_id: packId,
            changed_files: changedFilesList,
            compare_url: compareUrl,
          }),
        });
        console.log(`[WEBHOOK] Triggered auto-remediation for pack ${packId}`);
      }
    }

    return json(
      200,
      { success: true, affected_packs: packIds.length },
      corsHeaders,
    );
  } catch (err: any) {
    console.error("Webhook error:", err);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
