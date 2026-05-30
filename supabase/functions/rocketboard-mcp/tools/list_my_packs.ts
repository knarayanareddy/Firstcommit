// @ts-nocheck
/**
 * rocketboard-mcp/tools/list_my_packs.ts
 *
 * MCP Tool: list_my_packs
 * Returns all packs the authenticated user is a member of.
 *
 * READ-ONLY | No pack_id required | Auth: JWT
 * Cap: 200 packs
 */

import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { hashArgs, writeMcpAudit } from "../audit.ts";

// ─── Input schema ─────────────────────────────────────────────────────────────

export const ListMyPacksInputSchema = z.object({}).strict();
export type ListMyPacksInput = z.infer<typeof ListMyPacksInputSchema>;

// ─── Output type ─────────────────────────────────────────────────────────────

export interface PackSummary {
  pack_id: string;
  title: string;
  description: string | null;
  org_id: string | null;
  access_level: string;
  updated_at: string | null;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const MAX_PACKS = 200;

export async function listMyPacks(
  _args: ListMyPacksInput,
  ctx: {
    userId: string;
    adminClient: SupabaseClient;
    requestId: string;
  },
): Promise<{ packs: PackSummary[]; total: number }> {
  const { userId, adminClient, requestId } = ctx;
  const argsHash = await hashArgs({});

  try {
    // INNER JOIN pack_members ensures only packs the user belongs to
    const { data: packs, error: dbError } = await adminClient
      .from("packs")
      .select(
        "id, title, description, org_id, updated_at, pack_members!inner(access_level, user_id)",
      )
      .eq("pack_members.user_id", userId)
      .order("title", { ascending: true })
      .limit(MAX_PACKS);

    if (dbError) {
      console.error(
        `[MCP:list_my_packs] DB error for user=${userId.slice(0, 8)}…:`,
        dbError.message,
      );
      throw new Error("Failed to fetch packs");
    }

    const mapped: PackSummary[] = (packs || []).map((p: any) => ({
      pack_id: p.id,
      title: p.title,
      description: p.description,
      org_id: p.org_id,
      access_level: p.pack_members?.[0]?.access_level ?? "unknown",
      updated_at: p.updated_at,
    }));

    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: null,
      toolName: "list_my_packs",
      argsHash,
      resultSummary: { packs_returned: mapped.length },
      status: "ok",
    });

    return { packs: mapped, total: mapped.length };
  } catch (err) {
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: null,
      toolName: "list_my_packs",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "db_error",
    });
    throw err;
  }
}
