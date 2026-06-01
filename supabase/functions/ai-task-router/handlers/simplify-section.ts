// @ts-nocheck
/**
 * handlers/simplify-section.ts — `simplify_section` task handler (monolith split, stage 4b).
 */
import type { TraceBuilder } from "../../_shared/telemetry.ts";
import { enforceNoDirectCode } from "../envelope.ts";
import { GROUNDING_RULES, SECURITY_RULES_BLOCK, callWithAgenticReview } from "../generation-core.ts";
import { buildLearnerProfileBlock, buildPackBlock, buildSpansBlock } from "../prompts.ts";
import { batchRerankWithLLM } from "../reranker.ts";
import { errorResponse, jsonResponse, structuredError } from "../responses.ts";
import { resolveSnippets } from "../utils/snippet-resolver.ts";
import { verifyClaims } from "../verifier.ts";

export async function handleSimplifySection(
  envelope: any,
  headers: Record<string, string>,
  extraWarnings: string[] = [],
  trace?: TraceBuilder,
): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  const context = envelope.context || {};
  const retrieval = envelope.retrieval || {};
  const inputs = envelope.inputs || {};
  const audience = context.audience_profile || {};
  const moduleKey = context.current_module_key || "unknown";
  const sectionId = (inputs as any).section_id || "unknown";
  const originalMarkdown = inputs.original_section_markdown || "";

  if (!originalMarkdown) {
    return errorResponse(400, {
      type: "error",
      request_id: requestId,
      error_code: "missing_input",
      message:
        "inputs.original_section_markdown is required for simplify_section",
    });
  }

  // ─── RERANKING & RELEVANCE GATE (PHASE 3) ───
  let evidenceSpans = retrieval.evidence_spans || [];
  if (evidenceSpans.length > 0) {
    evidenceSpans = await batchRerankWithLLM(
      `Simplify technical technical content for ${
        audience.audience || "non-technical"
      } audience.`,
      evidenceSpans,
    );
  }

  if (evidenceSpans.length === 0) {
    return structuredError(
      requestId,
      "grounding_failed",
      "Simplification failed: couldn't find enough context to ground the rewritten version accurately.",
      { suggested_search_queries: ["overview of this component"] },
    );
  }

  const spansBlock = buildSpansBlock(evidenceSpans);
  const packBlock = buildPackBlock(pack);

  const systemPrompt =
    `You are RocketBoard AI Section Simplifier. You rewrite technical content to be more accessible.
${SECURITY_RULES_BLOCK}${GROUNDING_RULES}${buildLearnerProfileBlock(context)}
TASK: Simplify the following section content for the target audience.
${packBlock}

Module: ${moduleKey}, Section: ${sectionId}
Target audience: ${audience.audience || "non-technical"}
Target depth: ${audience.depth || "shallow"}

ORIGINAL SECTION MARKDOWN:
---
${originalMarkdown}
---

RULES:
- Rewrite the content to be simpler, clearer, and more accessible for the target audience.
- For "non-technical" audience: replace jargon with plain language, add analogies, explain acronyms.
- For "shallow" depth: focus on key concepts and practical implications, skip implementation details.
- For "standard" depth: keep core concepts but simplify complex explanations.
- Preserve the essential meaning and accuracy of the content.
- Keep code blocks but add more explanatory comments.
- EVERY claim MUST be cited using the exact format: [SOURCE: filepath:start_line-end_line].
- Maintain markdown formatting (headings, lists, code blocks, emphasis).
${spansBlock}

You MUST respond with VALID JSON matching this exact schema:
{
  "type": "simplify_section",
  "request_id": "${requestId}",
  "pack_id": "${pack.pack_id || ""}",
  "pack_version": ${pack.pack_version || 1},
  "generation_meta": { "timestamp_iso": "${
      new Date().toISOString()
    }", "request_id": "${requestId}" },
  "module_key": "${moduleKey}",
  "section_id": "${sectionId}",
  "simplified_markdown": "<your simplified markdown content>",
  "citations": [{ "span_id": "S1", "path": "...", "chunk_id": "..." }],
  "audience": "${audience.audience || "non-technical"}",
  "depth": "${audience.depth || "shallow"}",
  "warnings": []
}

Return ONLY the JSON object. No markdown fences, no extra text.`;

  const userPrompt = `Simplify this section for a ${
    audience.audience || "non-technical"
  } audience at ${
    audience.depth || "shallow"
  } depth. The original content is ${originalMarkdown.length} characters long. Use the ${evidenceSpans.length} evidence spans to ground your explanation where possible.`;

  try {
    const parsed = await callWithAgenticReview(
      "simplify_section",
      requestId,
      systemPrompt,
      userPrompt,
      evidenceSpans,
      context.ai_config,
      {
        type: "simplify_section",
        request_id: requestId,
        pack_id: pack.pack_id || null,
        pack_version: pack.pack_version || 1,
        generation_meta: {
          timestamp_iso: new Date().toISOString(),
          request_id: requestId,
        },
        module_key: moduleKey,
        section_id: sectionId,
        simplified_markdown: originalMarkdown,
        citations: [],
        audience: audience.audience || "non-technical",
        depth: audience.depth || "shallow",
        warnings: ["AI response could not be parsed as JSON"],
      },
      async (parsed) => {
        const raw = parsed.simplified_markdown || "";
        const codeCleaned = enforceNoDirectCode(raw);
        const { verifiedText, claims_total, claims_stripped, strip_rate } =
          await verifyClaims(codeCleaned, evidenceSpans);
        const { finalMarkdown, snippets_resolved } = resolveSnippets(
          verifiedText,
          evidenceSpans,
        );

        parsed.simplified_markdown = finalMarkdown;
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
          citations_found: (parsed.citations || []).length,
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
    if (e.status) return errorResponse(e.status, { error: e.message }, headers);
    throw e;
  }
}
