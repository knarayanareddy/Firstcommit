// @ts-nocheck
/**
 * rocketboard-mcp/tools/find_references.ts
 *
 * MCP Tool: find_references
 * Performs a graph-based lookup of references for a given symbol in a pack.
 *
 * READ-ONLY | Auth: JWT | Pack access: learner
 */

import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { hashArgs, writeMcpAudit } from "../audit.ts";
import { redactAndCap } from "../redaction.ts";

const MAX_RESULTS = 20;
const MAX_SNIPPET_CHARS = 1200;

export const FindReferencesInputSchema = z.object({
  pack_id: z.string().uuid("pack_id must be a valid UUID"),
  symbol: z.string().min(1).max(200, "symbol must be ≤ 200 chars"),
  max_results: z.number().int().min(1).max(MAX_RESULTS).default(10),
}).strict();

export type FindReferencesInput = z.infer<typeof FindReferencesInputSchema>;

export interface ReferenceSpan {
  chunk_id: string;
  path: string;
  line_start: number;
  line_end: number;
  confidence: number;
  snippet_preview: string;
}

export async function findReferences(
  args: FindReferencesInput,
  ctx: {
    userId: string;
    adminClient: SupabaseClient;
    requestId: string;
  },
): Promise<{ references: ReferenceSpan[]; total: number }> {
  const { userId, adminClient, requestId } = ctx;
  const argsHash = await hashArgs(args);

  try {
    const { data: refs, error: rpcError } = await adminClient.rpc(
      "find_references_v1",
      {
        p_pack_id: args.pack_id,
        p_symbol: args.symbol,
        p_limit: args.max_results,
      },
    );

    if (rpcError) {
      console.error(
        `[MCP:find_references] find_references_v1 error:`,
        rpcError.message,
      );
      throw new Error("Reference lookup failed");
    }

    const references: ReferenceSpan[] = [];
    for (const ref of (refs || [])) {
      // Find the actual chunk content to provide a snippet preview
      // find_references_v1 returns chunk_id, path, line_start, line_end, confidence, is_redacted
      // We need to fetch the content from knowledge_chunks for the snippet
      const { data: chunk } = await adminClient
        .from("knowledge_chunks")
        .select("content")
        .eq("pack_id", args.pack_id)
        .eq("chunk_id", ref.chunk_id)
        .maybeSingle();

      const { text: snippet } = redactAndCap(
        chunk?.content || "",
        MAX_SNIPPET_CHARS,
      );

      references.push({
        chunk_id: ref.chunk_id,
        path: ref.path,
        line_start: ref.line_start,
        line_end: ref.line_end,
        confidence: ref.confidence,
        snippet_preview: snippet,
      });
    }

    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "find_references",
      argsHash,
      resultSummary: { references_returned: references.length },
      status: "ok",
    });

    return { references, total: references.length };
  } catch (err) {
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "find_references",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "find_references_failed",
    });
    throw err;
  }
}
