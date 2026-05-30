// @ts-nocheck
/**
 * rocketboard-mcp/tools/report_content_gap.ts
 *
 * MCP Tool: report_content_gap
 * Allows pack members to report missing or incorrect documentation.
 *
 * MUTATING (safe) | Auth: JWT | Pack access: learner
 *
 * SECURITY:
 * - Strictly rate-limited: 10/day/user/pack (DB-checked)
 * - Does NOT trigger auto-remediation in v0
 * - Input lengths capped
 * - Inserts only into content_feedback table (no connector/vault touch)
 */

import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { hashArgs, writeMcpAudit } from "../audit.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_TITLE_LENGTH = 200;
const MAX_DESC_LENGTH = 2000;
const MAX_PATH_LENGTH = 300;
const MAX_SYMBOL_LENGTH = 200;
const DAILY_RATE_LIMIT = 10;

// ─── Input schema ─────────────────────────────────────────────────────────────

export const ReportGapInputSchema = z.object({
  pack_id: z.string().uuid("pack_id must be a valid UUID"),
  title: z.string().min(1).max(
    MAX_TITLE_LENGTH,
    `title must be ≤ ${MAX_TITLE_LENGTH} chars`,
  ),
  description: z.string().min(1).max(
    MAX_DESC_LENGTH,
    `description must be ≤ ${MAX_DESC_LENGTH} chars`,
  ),
  file_path: z.string().max(MAX_PATH_LENGTH).optional(),
  symbol: z.string().max(MAX_SYMBOL_LENGTH).optional(),
  severity: z.enum(["low", "med", "high"]).default("low"),
}).strict();

export type ReportGapInput = z.infer<typeof ReportGapInputSchema>;

// ─── Rate limit check (DB-backed, per user per pack per day) ─────────────────

async function checkDailyRateLimit(
  adminClient: SupabaseClient,
  userId: string,
  packId: string,
): Promise<boolean> {
  try {
    const { count, error } = await adminClient
      .from("mcp_audit_events")
      .select("*", { count: "exact", head: true })
      .eq("tool_name", "report_content_gap")
      .eq("user_id", userId)
      .eq("pack_id", packId)
      .eq("status", "ok")
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString()); // last 24h

    if (error) {
      // On error, allow the request (fail-open for rate limiting — not security critical)
      console.warn(
        "[MCP:report_gap] Rate limit check failed, allowing:",
        error.message,
      );
      return true;
    }

    return (count ?? 0) < DAILY_RATE_LIMIT;
  } catch {
    return true; // fail-open
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function reportContentGap(
  args: ReportGapInput,
  ctx: { userId: string; adminClient: SupabaseClient; requestId: string },
): Promise<{ reported: boolean; message: string }> {
  const { userId, adminClient, requestId } = ctx;
  const argsHash = await hashArgs(args);

  // DB-backed daily rate limit
  const allowed = await checkDailyRateLimit(adminClient, userId, args.pack_id);
  if (!allowed) {
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "report_content_gap",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "rate_limited",
    });
    throw Object.assign(
      new Error(
        "Daily report limit reached (10/day per pack). Try again tomorrow.",
      ),
      {
        code: "rate_limited",
      },
    );
  }

  try {
    const { error: insertError } = await adminClient.from("content_feedback")
      .insert({
        pack_id: args.pack_id,
        user_id: userId,
        feedback_type: "content_gap",
        payload: {
          title: args.title,
          description: args.description,
          file_path: args.file_path ?? null,
          symbol: args.symbol ?? null,
          severity: args.severity,
          source: "mcp",
          request_id: requestId,
        },
      });

    if (insertError) {
      console.error("[MCP:report_gap] Insert failed:", insertError.message);
      throw new Error("Failed to save content gap report");
    }

    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "report_content_gap",
      argsHash,
      resultSummary: { severity: args.severity },
      status: "ok",
    });

    return {
      reported: true,
      message:
        "Content gap reported successfully. The pack owner will be notified.",
    };
  } catch (err) {
    if ((err as any).code === "rate_limited") throw err;
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "report_content_gap",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "insert_failed",
    });
    throw err;
  }
}
