// @ts-nocheck
/**
 * rocketboard-mcp/tools/list_pack_sources.ts
 *
 * MCP Tool: list_pack_sources
 * Returns all sources (repos, docs, urls) defined in a specific pack.
 *
 * READ-ONLY | pack_id required | Auth: learner+
 */

import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { hashArgs, writeMcpAudit } from "../audit.ts";

// ─── Input schema ─────────────────────────────────────────────────────────────

export const ListPackSourcesInputSchema = z.object({
  pack_id: z.string().uuid().describe(
    "The UUID of the pack to list sources for",
  ),
}).strict();

export type ListPackSourcesInput = z.infer<typeof ListPackSourcesInputSchema>;

// ─── Output type ─────────────────────────────────────────────────────────────

export interface SourceSummary {
  source_id: string;
  source_type: string;
  source_uri: string;
  short_slug: string | null;
  label: string | null;
  last_synced_at: string | null;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function listPackSources(
  args: ListPackSourcesInput,
  ctx: {
    userId: string;
    adminClient: SupabaseClient;
    requestId: string;
  },
): Promise<{ sources: SourceSummary[] }> {
  const { userId, adminClient, requestId } = ctx;
  const argsHash = await hashArgs(args);

  try {
    const { data: sources, error: dbError } = await adminClient
      .from("pack_sources")
      .select("id, source_type, source_uri, short_slug, label, last_synced_at")
      .eq("pack_id", args.pack_id)
      .order("created_at", { ascending: true });

    if (dbError) {
      console.error(
        `[MCP:list_pack_sources] DB error for pack_id=${args.pack_id}:`,
        dbError.message,
      );
      throw new Error("Failed to fetch pack sources");
    }

    const mapped: SourceSummary[] = (sources || []).map((s: any) => ({
      source_id: s.id,
      source_type: s.source_type,
      source_uri: s.source_uri,
      short_slug: s.short_slug,
      label: s.label,
      last_synced_at: s.last_synced_at,
    }));

    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "list_pack_sources",
      argsHash,
      resultSummary: { sources_returned: mapped.length },
      status: "ok",
    });

    return { sources: mapped };
  } catch (err) {
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "list_pack_sources",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "db_error",
    });
    throw err;
  }
}
