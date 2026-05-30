// @ts-nocheck
/**
 * rocketboard-mcp/auth.ts
 *
 * Authentication for MCP server requests.
 * Supports:
 *   A) Supabase JWT session tokens (standard)
 *   B) RocketBoard PAT tokens (rb_pat_...) — stub, not yet configured
 *
 * SECURITY INVARIANTS:
 * - Never log token values, only masked user_id and auth_type
 * - Reject all requests without valid Authorization: Bearer <token>
 * - PAT path returns safe 401 with no hints about PAT infrastructure
 */

import { createClient } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthResult {
  userId: string;
  /** The raw token — forwarded to downstream calls (e.g. ai-task-router) */
  token: string;
  authType: "jwt" | "pat";
}

export class McpAuthError extends Error {
  constructor(
    public readonly code:
      | "missing_token"
      | "invalid_token"
      | "pat_not_configured",
    message: string,
  ) {
    super(message);
    this.name = "McpAuthError";
  }
}

// ─── Main authenticator ──────────────────────────────────────────────────────

/**
 * Authenticates an incoming MCP request.
 * Throws McpAuthError on failure.
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new McpAuthError(
      "missing_token",
      "Authorization: Bearer <token> is required",
    );
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    throw new McpAuthError("missing_token", "Token is empty");
  }

  // ── PAT path (stub for rb_pat_ tokens) ──────────────────────────────────
  if (token.startsWith("rb_pat_")) {
    // STUB: PAT verification is not yet configured.
    // When PAT support is added, call verify_user_api_token RPC here.
    // Returning safe 401 with no hints.
    throw new McpAuthError("pat_not_configured", "PAT auth not configured");
  }

  // ── JWT path ─────────────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    // Log masked info only — never the token value
    console.warn(
      "[MCP:auth] JWT validation failed. Reason:",
      error?.message ?? "no user",
    );
    throw new McpAuthError("invalid_token", "Invalid or expired token");
  }

  return {
    userId: user.id,
    token,
    authType: "jwt",
  };
}

/**
 * Converts a McpAuthError into a JSON Response with the appropriate HTTP status.
 */
export function authErrorResponse(err: McpAuthError): Response {
  const status =
    err.code === "missing_token" || err.code === "pat_not_configured"
      ? 401
      : 401;

  return new Response(
    JSON.stringify({ error: "Unauthorized", detail: err.message }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}
