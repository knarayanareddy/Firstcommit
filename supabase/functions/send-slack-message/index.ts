import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { requireUser } from "../_shared/authz.ts";
import { requirePackRole } from "../_shared/pack-access.ts";

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    // 1. Authenticate user
    const { userId } = await requireUser(req, corsHeaders);

    // 2. Parse request
    const { packId, messageType, data } = await readJson(req, corsHeaders);
    if (!packId) {
      return jsonError(400, "bad_request", "Missing packId", {}, corsHeaders);
    }

    // 3. Authorize pack access (Author or higher)
    const serviceClient = createServiceClient();
    await requirePackRole(serviceClient, packId, userId, "author", corsHeaders);

    // 4. Fetch integration
    const { data: integration, error: fetchError } = await serviceClient
      .from("slack_integrations")
      .select("*")
      .eq("pack_id", packId)
      .maybeSingle();

    if (fetchError || !integration) {
      return jsonError(
        404,
        "not_found",
        "Slack integration not found for this pack",
        {},
        corsHeaders,
      );
    }

    // 5. Construct message
    let text = "";
    if (messageType === "invite") {
      if (!integration.notify_on_invite) {
        return json(200, { skipped: true }, corsHeaders);
      }
      text = `📧 New invite sent to ${data?.email} for the pack!`;
    } else if (messageType === "module_complete") {
      if (!integration.notify_on_module_complete) {
        return json(200, { skipped: true }, corsHeaders);
      }
      text = `🎉 A user completed the module: ${data?.moduleTitle}!`;
    } else if (messageType === "new_source") {
      if (!integration.notify_on_new_source) {
        return json(200, { skipped: true }, corsHeaders);
      }
      text = `📚 New source added: ${data?.sourceLabel}!`;
    } else {
      text = `Notification: ${messageType}`;
    }

    // 6. Validate webhook_url (SSRF Protection)
    let validatedWebhookUrl: string;
    try {
      validatedWebhookUrl = parseAndValidateExternalUrl(
        integration.webhook_url,
        {
          allowedHosts: ["hooks.slack.com"],
          disallowPrivateIPs: true,
          allowHttps: true,
        },
      );
    } catch (err: any) {
      let host = "(unparseable)";
      try {
        host = new URL(integration.webhook_url).hostname;
      } catch {}
      console.error(
        `[SSRF BLOCK] Invalid Slack webhook: host=${host} packId=${packId} reason=${err.message}`,
      );
      return jsonError(
        400,
        "security_violation",
        `Invalid Slack Webhook: ${err.message}`,
        {},
        corsHeaders,
      );
    }

    // 7. Deliver to Slack
    const res = await fetch(validatedWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(
        `[SLACK ERROR] packId=${packId} status=${res.status} error=${errorText}`,
      );
      throw new Error(`Slack API error: ${res.status}`);
    }

    return json(200, { success: true }, corsHeaders);
  } catch (error: any) {
    if (error.response) return error.response;

    console.error(`[INTERNAL ERROR] ${error.message}`);
    return jsonError(500, "internal_error", error.message, {}, corsHeaders);
  }
});
