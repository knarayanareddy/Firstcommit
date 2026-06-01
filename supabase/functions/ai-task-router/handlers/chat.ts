// @ts-nocheck
/**
 * handlers/chat.ts — `chat` task handler (monolith split, stage 4b).
 */
import { createServiceClient } from "../../_shared/supabase-clients.ts";
import type { TraceBuilder } from "../../_shared/telemetry.ts";
import { runDetectiveRetrieval } from "../detective-retrieval.ts";
import { buildSectionIndex, enforceNoDirectCode } from "../envelope.ts";
import { GROUNDING_RULES, SECURITY_RULES_BLOCK, callWithAgenticReview } from "../generation-core.ts";
import { recordRagMetrics } from "../persistence.ts";
import { buildLanguageBlock, buildLearnerProfileBlock, buildLimitsConstraintBlock, buildMermaidBlock, buildSpansBlock } from "../prompts.ts";
import { batchRerankWithLLM } from "../reranker.ts";
import { errorResponse, jsonResponse, structuredError } from "../responses.ts";
import { canonicalizeCitations } from "../utils/citation-mapper.ts";
import { getInvalidCitations } from "../utils/citation-validator.ts";
import { resolveSnippets } from "../utils/snippet-resolver.ts";
import { verifyClaims } from "../verifier.ts";

export async function handleChat(
  envelope: any,
  headers: Record<string, string>,
  extraWarnings: string[] = [],
  trace?: TraceBuilder,
): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  const context = envelope.context || {};
  const retrieval = envelope.retrieval || {};
  const limits = envelope.limits || {};
  const audience = context.audience_profile || {};
  const conversation = context.conversation || {};

  const messages = (conversation.messages || []).map((m: any) => ({
    role: m.role,
    content: m.content,
  }));
  const lastUserMessage =
    messages.filter((m) => m.role === "user").pop()?.content || "Hello";

  // ─── RERANKING & RELEVANCE GATE (PHASE 3) ───
  let evidenceSpans = retrieval.evidence_spans || [];

  if (retrieval.detective_mode) {
    const detectiveResult = await runDetectiveRetrieval(
      createServiceClient(),
      envelope,
      evidenceSpans,
      lastUserMessage,
    );
    evidenceSpans = detectiveResult.finalSpans;
    // Store metrics in envelope temporarily for recordRagMetrics
    retrieval._detective_metrics = detectiveResult.metrics;
  } else if (evidenceSpans.length > 0) {
    evidenceSpans = await batchRerankWithLLM(lastUserMessage, evidenceSpans);
  }

  if (evidenceSpans.length === 0) {
    return structuredError(
      requestId,
      "grounding_failed",
      "I'm sorry, I couldn't find any relevant code or documentation snippets to ground an answer for your question. Please try refining your search or checking a different section.",
      {
        suggested_search_queries: ["overview of this module", "key components"],
      },
    );
  }

  const { markdown: spansBlock, allowedTokens } = buildSpansBlock(
    evidenceSpans,
  );

  // Fetch a lightweight section index for the current module (up to 30 entries)
  const sectionIndexBlock = pack.pack_id
    ? await buildSectionIndex(
      pack.pack_id,
      context.current_module_key || null,
      30,
    )
    : "";

  const systemPrompt =
    `You are RocketBoard AI, an expert onboarding assistant. You help engineers learn about codebases and systems.
${SECURITY_RULES_BLOCK}
${GROUNDING_RULES}
CODE IN CHAT RESPONSES:
- For repository code or real implementations, you MUST use the [SNIPPET: filepath:start-end | lang=...] format.
- DO NOT use triple-backticks for codebase content; the server will resolve your [SNIPPET] tags into the actual code lines.
- You may use triple-backticks ONLY for suggestions or pseudocode if you prefix the first line with "// PSEUDOCODE".
- Precede every [SNIPPET] with its corresponding [SOURCE] citation within 300 characters.

- GROUND your answers in the evidence spans provided using the specified citation format.
- If you cannot find sufficient evidence for a claim, you MUST say "I don't know from the sources I have" and populate unverified_claims. Do NOT guess.
- If evidence contradicts itself, note the contradiction.
- Keep responses under ${limits.max_chat_words || 350} words.
${buildLimitsConstraintBlock(limits)}
- Use markdown formatting.
- Suggest relevant follow-up search queries.

SECTION REFERENCES: When your answer is explained by a specific module section from the Section Index below, add that section to referenced_sections. Only include sections that are genuinely relevant. If no section matches, leave the array empty.

CONTRADICTION HANDLING: If you detect contradictions in the evidence while answering, include them in the contradictions array. Be explicit about what conflicts and cite both sides.
${buildLanguageBlock(context, pack)}${buildMermaidBlock(envelope)}${
      buildLearnerProfileBlock(context)
    }${packBlock}${moduleBlock}${audienceBlock}${sectionIndexBlock}${spansBlock}

You MUST respond with VALID JSON matching this schema:
{
  "type": "chat",
  "request_id": "${requestId}",
  "pack_id": "${pack.pack_id || ""}",
  "pack_version": ${pack.pack_version || 1},
  "generation_meta": { "timestamp_iso": "<now>", "request_id": "${requestId}" },
  "response_markdown": "<your markdown response>",
  "referenced_spans": [{ "span_id": "S1", "path": "...", "chunk_id": "..." }],
  "referenced_sections": [{ "module_key": "...", "section_id": "sec-1", "section_heading": "...", "reason": "..." }],
  "unverified_claims": [{ "claim": "...", "reason": "..." }],
  "contradictions": [],
  "suggested_search_queries": ["query1", "query2"],
  "suggested_next": { "module_key": null, "track_key": null },
  "warnings": []
}

Return ONLY the JSON object, no markdown fences, no extra text.`;

  const chatMessages = (conversation.messages || []).map((m: any) => ({
    role: m.role,
    content: m.content,
  }));
  const userPrompt = chatMessages.length > 0
    ? JSON.stringify(chatMessages)
    : "Hello, I have a question.";

  try {
    const parsed = await callWithAgenticReview(
      "chat",
      requestId,
      systemPrompt,
      userPrompt,
      evidenceSpans,
      context.ai_config,
      {
        type: "chat",
        request_id: requestId,
        pack_id: pack.pack_id || null,
        pack_version: pack.pack_version || 1,
        generation_meta: {
          timestamp_iso: new Date().toISOString(),
          request_id: requestId,
        },
        response_markdown: "",
        referenced_spans: [],
        referenced_sections: [],
        unverified_claims: [],
        contradictions: [],
        suggested_search_queries: [],
        suggested_next: { module_key: null, track_key: null },
      },
      async (parsed) => {
        const raw = parsed.response_markdown || "";

        // Pre-check for hallucinations (out-of-evidence citations)
        const invalidCitations = getInvalidCitations(raw, evidenceSpans);
        if (invalidCitations.length > 0) {
          return {
            strip_rate: 0,
            claims_total: 0,
            claims_stripped: 0,
            citations_found: 0,
            invalid_citations_found: true,
            invalid_citations_list: invalidCitations,
            evidence_count: evidenceSpans.length,
          };
        }

        const codeCleaned = enforceNoDirectCode(raw);
        const { verifiedText, claims_total, claims_stripped, strip_rate } =
          await verifyClaims(codeCleaned, evidenceSpans);
        const { finalMarkdown, snippets_resolved } = resolveSnippets(
          verifiedText,
          evidenceSpans,
        );
        const { display_response, source_map, canonical_response } =
          canonicalizeCitations(finalMarkdown, evidenceSpans);
        parsed.display_response = display_response;
        parsed.source_map = source_map;
        parsed.canonical_response = canonical_response;
        parsed.metrics = {
          claims_total,
          claims_stripped,
          strip_rate,
          snippets_resolved,
        };

        return {
          strip_rate,
          claims_total,
          claims_stripped,
          citations_found: source_map.length,
          source_map,
          snippets_resolved,
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
    console.error("[handleChat] error:", e);
    return errorResponse(e.status || 500, {
      error: e.message || "Internal server error",
    }, headers);
  }
}
