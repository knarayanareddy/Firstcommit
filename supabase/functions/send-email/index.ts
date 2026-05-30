import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { requireUser } from "../_shared/authz.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// In-memory rate limiting: 5 emails per 10 minutes per user
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_EMAILS_PER_WINDOW = 5;
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

function checkRateLimit(
  userId: string,
): { allowed: boolean; remaining?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || (now - entry.lastReset) > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, lastReset: now });
    return { allowed: true, remaining: MAX_EMAILS_PER_WINDOW - 1 };
  }

  if (entry.count >= MAX_EMAILS_PER_WINDOW) {
    return { allowed: false };
  }

  entry.count += 1;
  return { allowed: true, remaining: MAX_EMAILS_PER_WINDOW - entry.count };
}

serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    // 1. Get the session or user object securely
    const { userId: authedUserId } = await requireUser(req, corsHeaders);

    // 1.1 Rate limiting check
    const rateLimit = checkRateLimit(authedUserId);
    if (!rateLimit.allowed) {
      return jsonError(
        429,
        "rate_limit_exceeded",
        "Too many emails sent. Please try again later.",
        {},
        corsHeaders,
      );
    }

    // 2. Parse request
    const { to, subject, html, userId, type } = await readJson(
      req,
      corsHeaders,
    );

    // 2.1 Allow raw HTML gate
    const allowRawHtml = Deno.env.get("ALLOW_RAW_EMAIL_HTML") !== "false";
    const safeTypes = [
      "invite",
      "module_published",
      "milestone",
      "weekly_digest",
    ];

    if (!allowRawHtml && html && !safeTypes.includes(type)) {
      console.warn(
        `[SECURITY] Raw HTML email rejected for user ${authedUserId} (type: ${type})`,
      );
      return jsonError(
        403,
        "security_violation",
        "Raw HTML is restricted for this email type.",
        {},
        corsHeaders,
      );
    }

    if (!RESEND_API_KEY) {
      throw new Error(
        "RESEND_API_KEY is not configured. Please add it to your Supabase project secrets.",
      );
    }

    // 3. Optional: Check notification preferences (requires Admin access)
    if (userId && type) {
      const supabaseAdmin = createServiceClient();

      const { data: prefs } = await supabaseAdmin
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (prefs) {
        if (type === "invite" && !prefs.email_invites) {
          return json(
            200,
            { skipped: true, reason: "user preference" },
            corsHeaders,
          );
        }
        if (type === "module_published" && !prefs.email_module_published) {
          return json(
            200,
            { skipped: true, reason: "user preference" },
            corsHeaders,
          );
        }
        if (type === "milestone" && !prefs.email_milestones) {
          return json(
            200,
            { skipped: true, reason: "user preference" },
            corsHeaders,
          );
        }
        if (type === "weekly_digest" && !prefs.email_weekly_digest) {
          return json(
            200,
            { skipped: true, reason: "user preference" },
            corsHeaders,
          );
        }
      }
    }

    // 4. Deliver email
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "RocketBoard <onboarding@resend.dev>",
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resData)}`);
    }

    return json(200, { success: true, data: resData }, corsHeaders);
  } catch (error: any) {
    console.error(`[INTERNAL ERROR] ${error.message}`);
    return jsonError(500, "internal_error", error.message, {}, corsHeaders);
  }
});
