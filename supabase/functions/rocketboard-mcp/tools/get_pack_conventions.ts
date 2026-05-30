// @ts-nocheck
/**
 * rocketboard-mcp/tools/get_pack_conventions.ts
 *
 * MCP Tool: get_pack_conventions
 * Returns the pack's AGENTS.md file stitched from knowledge_chunks.
 *
 * READ-ONLY | Auth: JWT | Pack access: learner
 * SECURITY: Only the literal filename "AGENTS.md" is allowed — no user-supplied path.
 * Output cap: 30k chars.
 */

import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { hashArgs, writeMcpAudit } from "../audit.ts";
import { stitchAndRedact } from "../redaction.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const CONVENTIONS_PATH = "AGENTS.md"; // Hard-coded — no user input for this
const MAX_OUTPUT_CHARS = 30_000;

// ─── Input schema ─────────────────────────────────────────────────────────────

export const GetPackConventionsInputSchema = z.object({
  pack_id: z.string().uuid("pack_id must be a valid UUID"),
}).strict();

export type GetPackConventionsInput = z.infer<
  typeof GetPackConventionsInputSchema
>;

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function getPackConventions(
  args: GetPackConventionsInput,
  ctx: {
    userId: string;
    adminClient: SupabaseClient;
    requestId: string;
  },
): Promise<{ content: string; found: boolean; truncated: boolean }> {
  const { userId, adminClient, requestId } = ctx;
  const argsHash = await hashArgs(args);

  try {
    // Fetch AGENTS.md chunks ordered by line_start
    const { data: chunks, error: dbError } = await adminClient
      .from("knowledge_chunks")
      .select("content, line_start")
      .eq("pack_id", args.pack_id)
      .eq("path", CONVENTIONS_PATH)
      .order("line_start", { ascending: true });

    if (dbError) {
      console.error(`[MCP:get_pack_conventions] DB error:`, dbError.message);
      throw new Error("Failed to fetch conventions");
    }

    if (!chunks || chunks.length === 0) {
      await writeMcpAudit(adminClient, {
        requestId,
        userId,
        packId: args.pack_id,
        toolName: "get_pack_conventions",
        argsHash,
        resultSummary: { found: false, chunks: 0 },
        status: "ok",
      });

      return {
        content:
          "AGENTS.md not found in pack sources. Ingest the repo or add a conventions doc named 'AGENTS.md'.",
        found: false,
        truncated: false,
      };
    }

    const { text, truncated, secretsFound } = stitchAndRedact(
      chunks as Array<{ content: string; line_start: number }>,
      MAX_OUTPUT_CHARS,
    );

    if (secretsFound > 0) {
      console.warn(
        `[MCP:get_pack_conventions] Redacted ${secretsFound} secrets from AGENTS.md for pack=${
          args.pack_id.slice(0, 8)
        }…`,
      );
    }

    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "get_pack_conventions",
      argsHash,
      resultSummary: {
        found: true,
        chunks: chunks.length,
        chars: text.length,
        truncated,
      },
      status: "ok",
    });

    return { content: text, found: true, truncated };
  } catch (err) {
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "get_pack_conventions",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "db_error",
    });
    throw err;
  }
}
