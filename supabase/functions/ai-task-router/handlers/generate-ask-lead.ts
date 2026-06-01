// @ts-nocheck
/**
 * handlers/generate-ask-lead.ts — `generate_ask_lead` task handler (monolith split, stage 4b).
 */
import type { TraceBuilder } from "../../_shared/telemetry.ts";
import { enforceNoDirectCode } from "../envelope.ts";
import { GROUNDING_RULES, SECURITY_RULES_BLOCK, callWithAgenticReview } from "../generation-core.ts";
import { buildLearnerProfileBlock, buildPackBlock, buildSpansBlock } from "../prompts.ts";
import { batchRerankWithLLM } from "../reranker.ts";
import { errorResponse, jsonResponse, structuredError } from "../responses.ts";
import { resolveSnippets } from "../utils/snippet-resolver.ts";
import { verifyClaims } from "../verifier.ts";

export async function handleGenerateAskLead(
  envelope: any,
  headers: Record<string, string>,
  extraWarnings: string[] = [],
  trace?: TraceBuilder,
): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  const context = envelope.context || {};
  const retrieval = envelope.retrieval || {};
  const audience = context.audience_profile || {};
  let evidenceSpans = retrieval.evidence_spans || [];

  const packTitle = pack.title || "this codebase";

  // ─── RERANKING & RELEVANCE GATE (PHASE 3) ───
  if (evidenceSpans.length > 0) {
    evidenceSpans = await batchRerankWithLLM(
      `Generate strategic questions a new hire should ask their technical lead about ${packTitle}.`,
      evidenceSpans,
    );
  }

  if (evidenceSpans.length === 0) {
    return structuredError(
      requestId,
      "grounding_failed",
      `I'm sorry, I couldn't find enough relevant context to generate the expert question guide for "${packTitle}".`,
      {
        suggested_search_queries: ["architecture diagrams", "team conventions"],
      },
    );
  }

  const spansBlock = buildSpansBlock(evidenceSpans);
  const packBlock = buildPackBlock(pack);

  const systemPrompt =
    `You are RocketBoard AI Ask-Your-Lead Generator. Generate high-signal questions a new engineer should ask their team lead during their first 1:1s.
${SECURITY_RULES_BLOCK}${GROUNDING_RULES}${buildLearnerProfileBlock(context)}
TASK: Generate 10-15 questions for the "${pack.title || "unknown"}" pack.
${packBlock}

RULES:
- Questions should be specific to THIS codebase/team, not generic career questions.
- Each question must include "why_it_matters" explaining what the answer reveals.
- EVERY claim MUST be cited using the exact format: [SOURCE: filepath:start_line-end_line].
- If pack has tracks, assign track_key to relevant questions.
- Audience: ${audience.audience || "technical"}.
- Question IDs should be "al-1", "al-2", etc.
- Cover categories: team dynamics, technical decisions, process/workflow, culture.
${spansBlock}

You MUST respond with VALID JSON matching this exact schema:
{
  "type": "generate_ask_lead",
  "request_id": "${requestId}",
  "pack_id": "${pack.pack_id || ""}",
  "pack_version": ${pack.pack_version || 1},
  "generation_meta": { "timestamp_iso": "${
      new Date().toISOString()
    }", "request_id": "${requestId}" },
  "questions": [
    {
      "id": "al-1",
      "question": "string",
      "why_it_matters": "string",
      "citations": [{ "span_id": "S1", "path": "...", "chunk_id": "..." }],
      "track_key": "string|null",
      "audience": "${audience.audience || "technical"}"
    }
  ],
  "warnings": []
}

Return ONLY the JSON object. No markdown fences, no extra text.`;

  const userPrompt = `Generate ask-your-lead questions for the "${
    pack.title || "unknown"
  }" pack using the ${evidenceSpans.length} evidence spans provided.`;

  try {
    const parsed = await callWithAgenticReview(
      "generate_ask_lead",
      requestId,
      systemPrompt,
      userPrompt,
      evidenceSpans,
      context.ai_config,
      {
        type: "generate_ask_lead",
        request_id: requestId,
        pack_id: pack.pack_id || null,
        pack_version: pack.pack_version || 1,
        generation_meta: {
          timestamp_iso: new Date().toISOString(),
          request_id: requestId,
        },
        questions: [],
        warnings: ["AI response could not be parsed as JSON"],
      },
      async (parsed) => {
        if (!parsed.questions) {
          return {
            strip_rate: 0,
            claims_total: 0,
            claims_stripped: 0,
            citations_found: 0,
            snippets_resolved: 0,
            evidence_count: evidenceSpans.length,
          };
        }
        let totalClaims = 0;
        let totalStripped = 0;
        let totalSnippets = 0;
        let citationsFound = 0;
        let allWarnings: string[] = [];

        for (const q of parsed.questions) {
          if (q.why_it_matters) {
            const raw = q.why_it_matters;
            const codeCleaned = enforceNoDirectCode(raw);
            const { verifiedText, claims_total, claims_stripped } =
              await verifyClaims(codeCleaned, evidenceSpans);
            const { finalMarkdown, snippets_resolved } = resolveSnippets(
              verifiedText,
              evidenceSpans,
            );

            q.why_it_matters = finalMarkdown;
            totalClaims += claims_total;
            totalStripped += claims_stripped;
            totalSnippets += snippets_resolved;
            if (q.citations) citationsFound += q.citations.length;
          }
        }

        const strip_rate = totalClaims > 0 ? totalStripped / totalClaims : 0;
        parsed.metrics = {
          claims_total,
          claims_stripped,
          strip_rate,
          snippets_resolved: totalSnippets,
        };

        return {
          strip_rate,
          claims_total,
          claims_stripped,
          citations_found: citationsFound,
          snippets_resolved: totalSnippets,
          evidence_count: evidenceSpans.length,
        };
      },
      trace,
      pack,
    );

    if (extraWarnings.length) {
      parsed.warnings = [...(parsed.warnings || []), ...extraWarnings];
    }
    return jsonResponse(parsed, headers);
  } catch (e: any) {
    if (e.status) return errorResponse(e.status, { error: e.message }, headers);
    throw e;
  }
}
