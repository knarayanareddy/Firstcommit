// @ts-nocheck
/**
 * rocketboard-mcp/audit.ts
 *
 * MCP-specific audit logging. Distinct from ai_audit_events.
 * Writes mcp_audit_events rows with only metadata — never full args or responses.
 *
 * SECURITY INVARIANTS:
 * - Only stores args_hash (sha256), not raw args
 * - Only stores result_summary (counts), not full results
 * - Fire-and-forget: does NOT block the tool response
 * - Uses service_role (adminClient) for insertion
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface McpAuditEvent {
  /** Unique ID for this tool call */
  requestId: string;
  userId: string | null;
  packId: string | null;
  toolName: string;
  /** sha256 of canonical JSON of args */
  argsHash: string;
  /** Counts-only summary — no content */
  resultSummary: Record<string, unknown>;
  status: "ok" | "error";
  errorCode?: string | null;
}

// ─── Hash helper ─────────────────────────────────────────────────────────────

/**
 * Computes SHA-256 of a string and returns lowercase hex.
 * Uses Web Crypto API (available in Deno Edge runtime).
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Computes a canonical args hash:
 * - JSON.stringify with sorted keys
 * - sha256 hex
 */
export async function hashArgs(args: unknown): Promise<string> {
  const canonical = JSON.stringify(args, Object.keys(args as object).sort());
  return sha256Hex(canonical);
}

// ─── Writer ──────────────────────────────────────────────────────────────────

/**
 * Writes a single MCP audit event to the mcp_audit_events table.
 * Fire-and-forget: errors are logged but do not surface to the caller.
 */
export async function writeMcpAudit(
  adminClient: SupabaseClient,
  event: McpAuditEvent,
): Promise<void> {
  try {
    const { error } = await adminClient.from("mcp_audit_events").insert({
      request_id: event.requestId,
      user_id: event.userId,
      pack_id: event.packId,
      tool_name: event.toolName,
      args_hash: event.argsHash,
      result_summary: event.resultSummary,
      status: event.status,
      error_code: event.errorCode ?? null,
    });

    if (error) {
      // Never throw — audit failures are non-fatal
      console.error(
        `[MCP:audit] Failed to write audit event for tool=${event.toolName}:`,
        error.message,
      );
    }
  } catch (err) {
    console.error(
      `[MCP:audit] Unexpected audit write error for tool=${event.toolName}:`,
      (err as Error).message,
    );
  }
}

// ─── Convenience builder ──────────────────────────────────────────────────────

/**
 * Creates and fires an audit event. Used in tool handlers for the error path.
 */
export async function auditError(
  adminClient: SupabaseClient,
  opts: {
    requestId: string;
    userId: string | null;
    packId: string | null;
    toolName: string;
    args: unknown;
    errorCode: string;
  },
): Promise<void> {
  const argsHash = await hashArgs(opts.args).catch(() => "hash_failed");
  await writeMcpAudit(adminClient, {
    requestId: opts.requestId,
    userId: opts.userId,
    packId: opts.packId,
    toolName: opts.toolName,
    argsHash,
    resultSummary: {},
    status: "error",
    errorCode: opts.errorCode,
  });
}
