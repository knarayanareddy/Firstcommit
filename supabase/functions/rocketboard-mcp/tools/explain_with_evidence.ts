// @ts-nocheck
/**
 * rocketboard-mcp/tools/explain_with_evidence.ts
 *
 * MCP Tool: explain_with_evidence
 * Evidence-grounded answer generation using the existing RAG + grounding gate pipeline.
 *
 * READ-ONLY | Auth: JWT | Pack access: learner
 * Flow:
 *   Step A: Direct hybrid_search_v2 RPC (no extra hop)
 *   Step B: Forward to ai-task-router with user JWT (forward-auth)
 *
 * SECURITY INVARIANTS:
 * - User JWT is forwarded, never logged, never re-issued
 * - canonical_response is never returned unless debug=true AND caller is author
 * - Raw prompts are never returned
 * - Output markdown is redacted as defense-in-depth
 */

import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { hashArgs, writeMcpAudit } from "../audit.ts";
import { redactAndCap } from "../redaction.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_QUESTION_LENGTH = 2000;
const MAX_CONTEXT_LENGTH = 8000;
const MAX_SPANS = 20;
const MAX_ANSWER_CHARS = 30_000;

// ─── Input schema ─────────────────────────────────────────────────────────────

export const ExplainInputSchema = z.object({
  pack_id: z.string().uuid("pack_id must be a valid UUID"),
  question: z.string().min(1).max(
    MAX_QUESTION_LENGTH,
    `question must be ≤ ${MAX_QUESTION_LENGTH} chars`,
  ),
  context: z.string().max(MAX_CONTEXT_LENGTH).optional(),
  detective_mode: z.boolean().default(true),
  max_spans: z.number().int().min(1).max(MAX_SPANS).default(10),
  /** Debug flag: only enables extra info if caller is author */
  debug: z.boolean().default(false),
}).strict();

export type ExplainInput = z.infer<typeof ExplainInputSchema>;

// ─── Output type ─────────────────────────────────────────────────────────────

export interface EvidenceManifest {
  citations: Array<
    {
      badge: string;
      path: string;
      start_line: number;
      end_line: number;
      chunk_id: string;
    }
  >;
  spans_used: Array<
    { chunk_id: string; path: string; start_line: number; end_line: number }
  >;
}

export interface ExplainResult {
  answer_markdown: string;
  evidence_manifest: EvidenceManifest;
  gate_outcome: { passed: boolean; reason: string };
  truncated: boolean;
}

// ─── Embedding helper ─────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY") ||
    Deno.env.get("LOCAL_LLM_API_KEY") || "";
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
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

export async function explainWithEvidence(
  args: ExplainInput,
  ctx: {
    userId: string;
    userToken: string;
    adminClient: SupabaseClient;
    requestId: string;
    accessLevel: string;
  },
): Promise<ExplainResult> {
  const { userId, userToken, adminClient, requestId, accessLevel } = ctx;
  const argsHash = await hashArgs({ ...args, debug: undefined }); // exclude debug from hash

  try {
    // ── Step A: Retrieve evidence spans directly from DB ──────────────────
    const { data: pack, error: packError } = await adminClient
      .from("packs")
      .select("org_id")
      .eq("id", args.pack_id)
      .maybeSingle();

    if (packError || !pack) throw new Error("Pack not found");

    const clampedQuery = args.question.slice(0, 500); // embed only first 500 chars
    const embedding = await generateEmbedding(clampedQuery);

    const { data: chunks, error: rpcError } = await adminClient.rpc(
      "hybrid_search_v2",
      {
        p_org_id: pack.org_id,
        p_pack_id: args.pack_id,
        p_query_text: clampedQuery,
        p_query_embedding: embedding,
        p_match_count: Math.min(args.max_spans, MAX_SPANS),
        p_module_key: null,
        p_track_key: null,
      },
    );

    if (rpcError) {
      console.error(`[MCP:explain] hybrid_search_v2 error:`, rpcError.message);
      throw new Error("Retrieval failed");
    }

    // Map chunks to evidence span format for the router
    const evidenceSpans = (chunks || []).map((c: any, i: number) => ({
      span_id: `S${i + 1}`,
      chunk_id: c.chunk_id || c.id,
      path: c.path,
      start_line: c.line_start,
      end_line: c.line_end,
      text: c.content,
      score: c.score ?? 0,
      metadata: {
        entity_type: c.entity_type,
        entity_name: c.entity_name,
        signature: c.signature,
      },
    }));

    // ── Step B: Forward to ai-task-router ────────────────────────────────
    const routerUrl = Deno.env.get("MCP_ROUTER_URL") ||
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-task-router`;

    const userMessage = args.context
      ? `${args.question}\n\n[Additional context]\n${
        args.context.slice(0, MAX_CONTEXT_LENGTH)
      }`
      : args.question;

    const envelope = {
      task: { type: "global_chat", pack_id: args.pack_id },
      retrieval: {
        detective_mode: args.detective_mode,
        evidence_spans: evidenceSpans,
      },
      conversation: {
        messages: [{ role: "user", content: userMessage }],
      },
    };

    const routerRes = await fetch(routerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward user token — never log this value
        "Authorization": `Bearer ${userToken}`,
      },
      body: JSON.stringify(envelope),
    });

    if (!routerRes.ok) {
      const errText = await routerRes.text().catch(() => "unknown");
      console.error(
        `[MCP:explain] Router returned ${routerRes.status}: ${
          errText.slice(0, 200)
        }`,
      );
      throw new Error(`AI router failed with status ${routerRes.status}`);
    }

    const routerData = await routerRes.json();

    // ── Step C: Extract safe output fields ───────────────────────────────
    // Never return canonical_response unless debug + author
    const rawAnswer: string = routerData.display_response ??
      routerData.answer ?? "";
    const showCanonical = args.debug &&
      (accessLevel === "author" || accessLevel === "admin");
    const finalAnswer = showCanonical
      ? (routerData.canonical_response ?? rawAnswer)
      : rawAnswer;

    const { text: answer_markdown, truncated } = redactAndCap(
      finalAnswer,
      MAX_ANSWER_CHARS,
    );

    // Parse evidence manifest from router — use safe defaults if missing
    const sourceMap: Record<string, any> = routerData.source_map ?? {};
    const citations = Object.entries(sourceMap).map((
      [badge, span]: [string, any],
    ) => ({
      badge,
      path: span.path ?? "",
      start_line: span.start_line ?? 0,
      end_line: span.end_line ?? 0,
      chunk_id: span.chunk_id ?? "",
    }));

    const spansUsed = evidenceSpans.map((s) => ({
      chunk_id: s.chunk_id,
      path: s.path,
      start_line: s.start_line,
      end_line: s.end_line,
    }));

    const gateOutcome = {
      passed: routerData.gate_passed ?? true,
      reason: routerData.gate_reason ?? "ok",
    };

    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "explain_with_evidence",
      argsHash,
      resultSummary: {
        spans_retrieved: evidenceSpans.length,
        citations_count: citations.length,
        answer_chars: answer_markdown.length,
        gate_passed: gateOutcome.passed,
        truncated,
      },
      status: "ok",
    });

    return {
      answer_markdown,
      evidence_manifest: { citations, spans_used: spansUsed },
      gate_outcome: gateOutcome,
      truncated,
    };
  } catch (err) {
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "explain_with_evidence",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "pipeline_error",
    });
    throw err;
  }
}
