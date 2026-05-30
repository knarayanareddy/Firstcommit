// @ts-nocheck
/**
 * rocketboard-mcp/tools/get_tech_docs.ts
 *
 * MCP Tools: get_tech_docs_index + get_tech_doc
 * List and retrieve technical documents from the pack knowledge base.
 *
 * READ-ONLY | Auth: JWT | Pack access: learner
 *
 * SECURITY:
 * - Reads from pack_docs (which is pre-redacted/sanitized by sync-pack-docs)
 * - Output cap: 50k chars per document
 */

import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { hashArgs, writeMcpAudit } from "../audit.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_DOC_CHARS = 50_000;

// ─── Input schemas ────────────────────────────────────────────────────────────

export const GetTechDocsIndexInputSchema = z.object({
  pack_id: z.string().uuid("pack_id must be a valid UUID"),
}).strict();
export type GetTechDocsIndexInput = z.infer<typeof GetTechDocsIndexInputSchema>;

export const GetTechDocInputSchema = z.object({
  pack_id: z.string().uuid("pack_id must be a valid UUID"),
  path: z.string().min(1).max(300, "path must be ≤ 300 chars"),
}).strict();
export type GetTechDocInput = z.infer<typeof GetTechDocInputSchema>;

// ─── get_tech_docs_index handler ──────────────────────────────────────────────

export async function getTechDocsIndex(
  args: GetTechDocsIndexInput,
  ctx: { userId: string; adminClient: SupabaseClient; requestId: string },
): Promise<{ paths: string[]; total: number }> {
  const { userId, adminClient, requestId } = ctx;
  const argsHash = await hashArgs(args);

  try {
    const { data, error } = await adminClient
      .from("pack_docs")
      .select("slug, title")
      .eq("pack_id", args.pack_id)
      .eq("status", "published")
      .order("slug", { ascending: true });

    if (error) {
      console.error("[MCP:get_tech_docs_index] DB error:", error.message);
      throw new Error("Failed to list tech docs");
    }

    const paths = data.map((d: any) => d.slug as string);

    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "get_tech_docs_index",
      argsHash,
      resultSummary: { paths_count: paths.length },
      status: "ok",
    });

    return { paths, total: paths.length };
  } catch (err) {
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "get_tech_docs_index",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "db_error",
    });
    throw err;
  }
}

// ─── get_tech_doc handler ─────────────────────────────────────────────────────

export async function getTechDoc(
  args: GetTechDocInput,
  ctx: { userId: string; adminClient: SupabaseClient; requestId: string },
): Promise<
  { content: string; found: boolean; truncated: boolean; path: string }
> {
  const { userId, adminClient, requestId } = ctx;
  const argsHash = await hashArgs(args);

  const validatedPath = args.path;

  try {
    const { data: doc, error: dbError } = await adminClient
      .from("pack_docs")
      .select("content_plain, title, slug")
      .eq("pack_id", args.pack_id)
      .eq("slug", validatedPath)
      .single();

    if (dbError || !doc) {
      await writeMcpAudit(adminClient, {
        requestId,
        userId,
        packId: args.pack_id,
        toolName: "get_tech_doc",
        argsHash,
        resultSummary: { found: false },
        status: "ok",
      });
      return {
        content: `Document not found: ${validatedPath}. See index.`,
        found: false,
        truncated: false,
        path: validatedPath,
      };
    }

    // truncate if needed (though sync-pack-docs enforces limits normally, defense in depth)
    let text = `# ${doc.title}\n\n${doc.content_plain || ""}`;
    const truncated = text.length > MAX_DOC_CHARS;
    if (truncated) {
      text = text.substring(0, MAX_DOC_CHARS) + "\n\n[TRUNCATED]";
    }

    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "get_tech_doc",
      argsHash,
      resultSummary: { found: true, chars: text.length, truncated },
      status: "ok",
    });

    return { content: text, found: true, truncated, path: validatedPath };
  } catch (err) {
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "get_tech_doc",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "db_error",
    });
    throw err;
  }
}
