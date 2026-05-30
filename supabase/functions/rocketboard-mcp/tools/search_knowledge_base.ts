// @ts-nocheck
/**
 * rocketboard-mcp/tools/search_knowledge_base.ts
 *
 * MCP Tool: search_knowledge_base
 * Performs a hybrid (semantic + keyword) search over a pack's knowledge base.
 *
 * READ-ONLY | Auth: JWT | Pack access: learner
 * Caps: query 500 chars, spans 20, total output 20k chars
 */

import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { hashArgs, writeMcpAudit } from "../audit.ts";
import { redactAndCap } from "../redaction.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_SPANS = 20;
const MAX_QUERY_LENGTH = 500;
const MAX_SNIPPET_CHARS = 1200;
const MAX_TOTAL_OUTPUT_CHARS = 20_000;

// ─── Input schema ─────────────────────────────────────────────────────────────

export const SearchInputSchema = z.object({
  pack_id: z.string().uuid("pack_id must be a valid UUID"),
  query: z.string().min(1).max(
    MAX_QUERY_LENGTH,
    `query must be ≤ ${MAX_QUERY_LENGTH} chars`,
  ),
  max_spans: z.number().int().min(1).max(MAX_SPANS).default(10),
  module_key: z.string().max(100).optional(),
  track_key: z.string().max(100).optional(),
}).strict();

export type SearchInput = z.infer<typeof SearchInputSchema>;

// ─── Output type ─────────────────────────────────────────────────────────────

export interface EvidenceSpanPreview {
  span_id: string;
  chunk_id: string;
  path: string;
  start_line: number;
  end_line: number;
  /** Redacted first N chars of chunk content — NOT the full chunk */
  snippet_preview: string;
  score: number;
  metadata: {
    entity_type?: string;
    entity_name?: string;
    signature?: string;
  };
}

// ─── Embedding helper ──────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[] | null> {
  const openAIKey = Deno.env.get("OPENAI_API_KEY") || "";
  const localKey = Deno.env.get("LOCAL_LLM_API_KEY") || "";
  const apiKey = openAIKey || localKey;
  if (!apiKey) return null;

  const useLocalEndpoint = !openAIKey && !!localKey;
  const url = useLocalEndpoint
    ? ((Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1") +
      "/embeddings")
    : "https://api.openai.com/v1/embeddings";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text.replace(/\n/g, " "),
        model: "text-embedding-3-small",
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.data[0].embedding;
  } catch {
    return null;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function searchKnowledgeBase(
  args: SearchInput,
  ctx: {
    userId: string;
    adminClient: SupabaseClient;
    requestId: string;
  },
): Promise<
  { spans: EvidenceSpanPreview[]; total: number; truncated: boolean }
> {
  const { userId, adminClient, requestId } = ctx;
  const argsHash = await hashArgs(args);

  // Clamp at cap (zod should have already validated, but defensive clamping)
  const clampedQuery = args.query.slice(0, MAX_QUERY_LENGTH);
  const clampedMaxSpans = Math.min(Math.max(args.max_spans, 1), MAX_SPANS);

  try {
    // Resolve org_id (needed for hybrid_search_v2)
    const { data: pack, error: packError } = await adminClient
      .from("packs")
      .select("org_id")
      .eq("id", args.pack_id)
      .maybeSingle();

    if (packError || !pack) throw new Error("Pack not found");

    // Generate embedding (falls back to keyword-only on failure)
    const embedding = await generateEmbedding(clampedQuery);
    if (!embedding) {
      console.warn(
        `[MCP:search] Embedding failed, using keyword-only for pack=${
          args.pack_id.slice(0, 8)
        }…`,
      );
    }

    const { data: chunks, error: rpcError } = await adminClient.rpc(
      "hybrid_search_v2",
      {
        p_org_id: pack.org_id,
        p_pack_id: args.pack_id,
        p_query_text: clampedQuery,
        p_query_embedding: embedding,
        p_match_count: clampedMaxSpans,
        p_module_key: args.module_key ?? null,
        p_track_key: args.track_key ?? null,
      },
    );

    if (rpcError) {
      console.error(`[MCP:search] hybrid_search_v2 error:`, rpcError.message);
      throw new Error("Search failed");
    }

    // Build preview spans with redaction and per-item cap
    let totalChars = 0;
    let truncated = false;
    const spans: EvidenceSpanPreview[] = [];

    for (let i = 0; i < (chunks || []).length; i++) {
      const chunk = chunks[i];
      if (totalChars >= MAX_TOTAL_OUTPUT_CHARS) {
        truncated = true;
        break;
      }

      const remaining = MAX_TOTAL_OUTPUT_CHARS - totalChars;
      const effectiveCap = Math.min(MAX_SNIPPET_CHARS, remaining);
      const { text: preview } = redactAndCap(chunk.content || "", effectiveCap);
      totalChars += preview.length;

      spans.push({
        span_id: `S${i + 1}`,
        chunk_id: chunk.chunk_id || chunk.id,
        path: chunk.path,
        start_line: chunk.line_start,
        end_line: chunk.line_end,
        snippet_preview: preview,
        score: chunk.score ?? 0,
        metadata: {
          entity_type: chunk.entity_type ?? undefined,
          entity_name: chunk.entity_name ?? undefined,
          signature: chunk.signature ?? undefined,
        },
      });
    }

    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "search_knowledge_base",
      argsHash,
      resultSummary: {
        spans_returned: spans.length,
        total_chars: totalChars,
        truncated,
      },
      status: "ok",
    });

    return { spans, total: spans.length, truncated };
  } catch (err) {
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "search_knowledge_base",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "search_failed",
    });
    throw err;
  }
}
