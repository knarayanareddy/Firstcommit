// @ts-nocheck
/**
 * rocketboard-mcp/policy.ts
 *
 * Pack-scoped RBAC for the MCP server.
 * All access checks are server-side via service_role (adminClient).
 * Never trusts client-supplied pack membership.
 *
 * SECURITY INVARIANTS:
 * - All pack access checks go through adminClient (service_role)
 * - User-supplied pack_id must exist and user must be a member
 * - Path validation prevents traversal attacks on file-based tools
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AccessLevel = "learner" | "author" | "admin";

export class McpAccessError extends Error {
  constructor(
    public readonly code: "pack_not_found" | "forbidden" | "pack_id_required",
    message: string,
  ) {
    super(message);
    this.name = "McpAccessError";
  }
}

// Access level ordering — higher index = more permissive
const ACCESS_LEVEL_ORDER: AccessLevel[] = ["learner", "author", "admin"];

function meetsLevel(userLevel: string, required: AccessLevel): boolean {
  const userIdx = ACCESS_LEVEL_ORDER.indexOf(userLevel as AccessLevel);
  const reqIdx = ACCESS_LEVEL_ORDER.indexOf(required);
  if (userIdx === -1) return false;
  return userIdx >= reqIdx;
}

// ─── Pack Access ─────────────────────────────────────────────────────────────

/**
 * Verifies that userId has at least `requiredLevel` access to `packId`.
 * Uses adminClient (service_role) to bypass RLS — authoritative check.
 * Throws McpAccessError on failure.
 */
export async function checkPackAccess(
  adminClient: SupabaseClient,
  userId: string,
  packId: string,
  requiredLevel: AccessLevel = "learner",
): Promise<void> {
  // 1. Verify pack exists
  const { data: pack, error: packError } = await adminClient
    .from("packs")
    .select("id")
    .eq("id", packId)
    .maybeSingle();

  if (packError || !pack) {
    throw new McpAccessError(
      "pack_not_found",
      "Pack not found or does not exist",
    );
  }

  // 2. Check membership and access level
  // Try has_pack_access RPC first (cleaner); fall back to pack_members join
  try {
    const { data: hasAccess, error: rpcError } = await adminClient.rpc(
      "has_pack_access",
      {
        p_user_id: userId,
        p_pack_id: packId,
        p_required_level: requiredLevel,
      },
    );

    if (!rpcError) {
      if (!hasAccess) {
        console.warn(
          `[MCP:policy] Access denied — user=${userId.slice(0, 8)}… pack=${
            packId.slice(0, 8)
          }… required=${requiredLevel}`,
        );
        throw new McpAccessError(
          "forbidden",
          "You do not have access to this pack",
        );
      }
      return;
    }
    // RPC unavailable — fall through to manual check
  } catch (err) {
    if (err instanceof McpAccessError) throw err;
    // RPC call itself threw — fall through to manual check below
  }

  // Fallback: direct pack_members query (mirrors retrieve-spans pattern)
  const { data: membership, error: memberError } = await adminClient
    .from("pack_members")
    .select("access_level")
    .eq("pack_id", packId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError || !membership) {
    console.warn(
      `[MCP:policy] Membership check failed — user=${
        userId.slice(0, 8)
      }… pack=${packId.slice(0, 8)}…`,
    );
    throw new McpAccessError("forbidden", "You are not a member of this pack");
  }

  if (!meetsLevel(membership.access_level, requiredLevel)) {
    throw new McpAccessError(
      "forbidden",
      `Insufficient access level. Required: ${requiredLevel}, got: ${membership.access_level}`,
    );
  }
}

/**
 * Converts a McpAccessError into a JSON Response.
 */
export function accessErrorResponse(err: McpAccessError): Response {
  const status = err.code === "pack_not_found" ? 404 : 403;
  return new Response(
    JSON.stringify({
      error: err.code === "pack_not_found" ? "Not Found" : "Forbidden",
      detail: err.message,
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

// ─── Path Validation ─────────────────────────────────────────────────────────

const ALLOWED_PREFIXES = ["AGENTS.md", "Technical documents/"] as const;
export type AllowedPathPrefix = typeof ALLOWED_PREFIXES[number];

/**
 * Validates a user-supplied file path against an allowlist of safe prefixes.
 * Rejects traversal sequences, backslashes, null bytes, and oversized strings.
 * Returns the validated path or throws a descriptive Error.
 */
export function validatePath(
  path: string,
  allowedPrefixes: string[],
): string {
  // Length guard
  if (!path || path.length > 500) {
    throw new Error("Invalid path: missing or too long");
  }

  // Traversal + injection guards
  if (path.includes("..") || path.includes("\\") || path.includes("\0")) {
    throw new Error("Invalid path: contains disallowed characters");
  }

  // Must start with one of the allowlist prefixes
  const allowed = allowedPrefixes.some((prefix) => path.startsWith(prefix));
  if (!allowed) {
    throw new Error(
      `Invalid path: must start with one of ${JSON.stringify(allowedPrefixes)}`,
    );
  }

  return path;
}
