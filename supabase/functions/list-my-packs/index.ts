import { json, jsonError } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { requireUser } from "../_shared/authz.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";

// Simple in-memory rate limiting (max 30 requests per minute per user)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  let limit = rateLimits.get(userId);

  if (!limit || now > limit.resetAt) {
    limit = { count: 0, resetAt: now + 60000 };
    rateLimits.set(userId, limit);
  }

  limit.count++;
  return limit.count <= 30;
}

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);
  const traceId = crypto.randomUUID();

  try {
    // 1. Authenticate user
    const { userId } = await requireUser(req, corsHeaders);

    // 2. Rate limit check
    if (!checkRateLimit(userId)) {
      console.warn(`[${traceId}] Rate limit exceeded for user: ${userId}`);
      return jsonError(429, "rate_limit_exceeded", "Rate limit exceeded", {
        trace_id: traceId,
      }, corsHeaders);
    }

    // 3. Fetch packs using service role for security
    const admin = createServiceClient();

    // Explicitly query packs INNER JOIN pack_members for security
    // Only return non-sensitive fields
    const { data: packs, error: dbError } = await admin.from("packs")
      .select(
        "id, title, description, org_id, updated_at, pack_members!inner(access_level, user_id)",
      )
      .eq("pack_members.user_id", userId)
      .order("title", { ascending: true });

    if (dbError) {
      console.error(`[${traceId}] DB Error:`, dbError.message);
      return jsonError(500, "internal_error", "Internal Server Error", {
        trace_id: traceId,
      }, corsHeaders);
    }

    // Map to a cleaner minimal structure for the extension
    const mappedPacks = (packs || []).map((p) => ({
      pack_id: p.id,
      title: p.title,
      description: p.description,
      org_id: p.org_id,
      access_level: (p as any).pack_members?.[0]?.access_level || "unknown",
      updated_at: p.updated_at,
    }));

    console.log(
      `[${traceId}] User ${userId} fetched ${mappedPacks.length} packs.`,
    );

    return json(200, { packs: mappedPacks }, corsHeaders);
  } catch (error: any) {
    if (error.response) return error.response;

    console.error(`[${traceId}] Unexpected error:`, error.message);
    return jsonError(500, "internal_error", "Internal Server Error", {
      trace_id: traceId,
    }, corsHeaders);
  }
});
