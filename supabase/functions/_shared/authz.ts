/**
 * _shared/authz.ts
 * Shared authorization and user retrieval helpers.
 */

import { createAnonClient } from "./supabase-clients.ts";
import { jsonError } from "./http.ts";

export function getBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  return authHeader.substring(7);
}

export async function requireUser(
  req: Request,
  headers?: Record<string, string>,
) {
  const supabase = createAnonClient(req);
  const token = getBearerToken(req);

  if (!token) {
    throw {
      response: jsonError(
        401,
        "unauthorized",
        "Missing or invalid authorization token",
        {},
        headers,
      ),
    };
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw {
      response: jsonError(
        401,
        "unauthorized",
        "Invalid or expired session",
        {},
        headers,
      ),
    };
  }

  return { userId: user.id };
}
export function requireInternal(
  req: Request,
  headers?: Record<string, string>,
): { success: true } | { success: false; response: Response } {
  const secret = Deno.env.get("ROCKETBOARD_INTERNAL_SECRET");
  const providedSecret = req.headers.get("X-Rocketboard-Internal");

  if (secret && providedSecret === secret) {
    return { success: true };
  }

  // Backward compatibility: allow Service Role Bearer token with a deprecation warning
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");

  if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
    console.warn(
      "[DEPRECATION] Internal endpoint called with Service Role key. Please use X-Rocketboard-Internal header.",
    );
    return { success: true };
  }

  return {
    success: false,
    response: jsonError(
      401,
      "unauthorized",
      "This endpoint is restricted to internal callers. Missing or invalid secret.",
      {},
      headers,
    ),
  };
}

/**
 * requireUserOrInternal
 * Hybrid gate that allows either:
 * 1. Internal secret verification (headers or Service Role)
 * 2. User JWT session verification
 */
export async function requireUserOrInternal(
  req: Request,
  headers?: Record<string, string>,
): Promise<{ mode: "internal" | "user"; userId?: string }> {
  // 1. Try Internal Auth first
  const internal = requireInternal(req, headers);
  if (internal.success) {
    return { mode: "internal" };
  }

  // 2. Try User Auth
  try {
    const { userId } = await requireUser(req, headers);
    return { mode: "user", userId };
  } catch (err) {
    // If both fail, we surface the requireUser error (usually 401 response)
    throw err;
  }
}
