// @ts-nocheck
/**
 * handlers/generate-module.ts — `generate_module` task handler (monolith split, stage 4b).
 */
import type { TraceBuilder } from "../../_shared/telemetry.ts";
import { enforceNoDirectCode } from "../envelope.ts";
import {
  callWithAgenticReview,
  GROUNDING_RULES,
  SECURITY_RULES_BLOCK,
} from "../generation-core.ts";
import {
  buildLanguageBlock,
  buildLearnerProfileBlock,
  buildMermaidBlock,
  buildPackBlock,
  buildSpansBlock,
} from "../prompts.ts";
import { batchRerankWithLLM } from "../reranker.ts";
import { errorResponse, jsonResponse, structuredError } from "../responses.ts";
import { resolveSnippets } from "../utils/snippet-resolver.ts";
import { verifyClaims } from "../verifier.ts";

export async function handleGenerateModule(
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
  const inputs = envelope.inputs || {};
  const audience = context.audience_profile || {};
  const moduleKey = inputs.module_key || "unknown";
  const moduleTitle = inputs.title || "Untitled Module";
  const moduleDesc = inputs.description || "";
  const trackKey = inputs.track_key || null;
  const moduleRevision = inputs.module_revision || 1;

  // ─── RERANKING & RELEVANCE GATE (PHASE 3) ───
  let evidenceSpans = retrieval.evidence_spans || [];
  const packBlock = buildPackBlock(pack);

  if (evidenceSpans.length > 0) {
    evidenceSpans = await batchRerankWithLLM(
      `Generate detailed content for module: ${moduleTitle}. ${moduleDesc}`,
      evidenceSpans,
    );
  }

  if (evidenceSpans.length === 0) {
    return structuredError(
      requestId,
      "grounding_failed",
      `I'm sorry, I couldn't find enough relevant technical context to generate module "${moduleTitle}" accurately.`,
      { suggested_search_queries: [moduleTitle, "key concepts"] },
    );
  }

  const spansBlock = buildSpansBlock(evidenceSpans);

  const systemPrompt =
    `You are RocketBoard AI Module Generator. Your job is to generate comprehensive onboarding module content grounded in evidence spans.
${SECURITY_RULES_BLOCK}${GROUNDING_RULES}${buildLanguageBlock(context, pack)}${
      buildMermaidBlock(envelope)
    }${buildLearnerProfileBlock(context)}
TASK: Generate a complete module titled "${moduleTitle}" (key: ${moduleKey}).
${moduleDesc ? `Description: ${moduleDesc}` : ""}
${trackKey ? `Track: ${trackKey}` : ""}
${packBlock}

CODE INCLUSION RULES (CRITICAL FOR ONBOARDING):
- For all repository code snippets, you MUST use the [SNIPPET: filepath:start-end | lang=...] format.
- DO NOT use triple-backticks for codebase content; the server will resolve your [SNIPPET] tags.
- You may use triple-backticks ONLY for suggestions or pseudocode if the first line is "// PSEUDOCODE".
- Every section discussing implementation MUST have at least one [SNIPPET] from evidence.
- Precede every [SNIPPET] with its corresponding [SOURCE] citation within 300 characters.

SPECIAL CODE CALLOUTS:
When including code in sections, use these markers in your markdown to indicate special code blocks. The UI will render them distinctly:

For setup commands the learner needs to run:
:::setup[Title]
content with code blocks
:::

For important patterns:
:::pattern[Title]
content with code blocks
:::

For configuration files:
:::config[Title]
content with code blocks
:::

For gotchas and warnings:
:::warning[Title]
content with code blocks
:::

Use these liberally. Every module should have at least:
- 1-2 setup callouts (if the module covers tools/environments)
- 2-3 pattern callouts (for key code patterns)
- 1-2 config callouts (for important configuration)
- 1+ warning callouts (for common mistakes or gotchas)
If the evidence doesn't support a particular callout type for a section, don't force it.

EVIDENCE INDEX:
In the evidence_index field, group your citations by FILE PATH, not just by topic. Each entry should map a source file to the topics it covers. This helps create a 'Key Files' reference for the learner.

CONTRADICTION HANDLING: If you encounter evidence spans that contradict each other, you MUST include them in a top-level "contradictions" array in your output. For each contradiction, provide: topic (what the conflict is about), side_a (the first claim with its supporting citations), side_b (the opposing claim with its supporting citations), how_to_resolve (practical suggestions for resolving the ambiguity). Do NOT silently choose one side. Surface all conflicts.
${spansBlock}

You MUST respond with VALID JSON matching this exact schema:
{
  "type": "generate_module",
  "request_id": "${requestId}",
  "pack_id": "${pack.pack_id || ""}",
  "pack_version": ${pack.pack_version || 1},
  "generation_meta": { "timestamp_iso": "${
      new Date().toISOString()
    }", "request_id": "${requestId}" },
  "module_revision": ${moduleRevision},
  "module": {
    "module_key": "${moduleKey}",
    "title": "${moduleTitle}",
    "description": "string",
    "estimated_minutes": 15,
    "difficulty": "beginner|intermediate|advanced",
    "track_key": ${trackKey ? `"${trackKey}"` : "null"},
    "audience": "${audience.audience || "technical"}",
    "depth": "${audience.depth || "standard"}",
    "sections": [{
      "section_id": "sec-1",
      "heading": "string",
      "markdown": "string (full markdown content)",
      "learning_objectives": ["string"],
      "note_prompts": ["string"],
      "citations": [{ "span_id": "S1", "path": "...", "chunk_id": "..." }]
    }],
    "endcap": {
      "reflection_prompts": ["string"],
      "quiz_objectives": ["string"],
      "ready_for_quiz_markdown": "string",
      "citations": [{ "span_id": "S1" }]
    },
    "key_takeaways": ["string"],
    "evidence_index": [{
      "topic": "string",
      "citations": [{ "span_id": "S1" }]
    }]
  },
  "contradictions": [{ "topic": "string", "side_a": { "claim": "string", "citations": [{"span_id": "S1"}] }, "side_b": { "claim": "string", "citations": [{"span_id": "S2"}] }, "how_to_resolve": ["string"] }],
  "warnings": []
}

Return ONLY the JSON object. No markdown fences, no extra text.`;

  const userPrompt =
    `Generate the complete module "${moduleTitle}" using the ${spans.length} evidence spans provided. Make the content comprehensive, educational, and well-structured for onboarding engineers.`;

  try {
    const parsed = await callWithAgenticReview(
      "generate_module",
      requestId,
      systemPrompt,
      userPrompt,
      evidenceSpans,
      context.ai_config,
      {
        type: "generate_module",
        request_id: requestId,
        pack_id: pack.pack_id || null,
        pack_version: pack.pack_version || 1,
        generation_meta: {
          timestamp_iso: new Date().toISOString(),
          request_id: requestId,
        },
        module_revision: moduleRevision,
        module: {
          module_key: moduleKey,
          title: moduleTitle,
          description: moduleDesc,
          estimated_minutes: 15,
          difficulty: "beginner",
          track_key: trackKey,
          audience: audience.audience || "technical",
          depth: audience.depth || "standard",
          sections: [],
          endcap: {
            reflection_prompts: [],
            quiz_objectives: [],
            ready_for_quiz_markdown: "",
            citations: [],
          },
          key_takeaways: [],
          evidence_index: [],
        },
        warnings: ["AI response could not be parsed as JSON"],
      },
      async (parsed) => {
        if (!parsed.module?.sections) {
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

        for (const sec of parsed.module.sections) {
          const raw = sec.markdown || "";
          const codeCleaned = enforceNoDirectCode(raw);
          const { verifiedText, claims_total, claims_stripped } =
            await verifyClaims(codeCleaned, evidenceSpans);
          const { finalMarkdown, snippets_resolved } = resolveSnippets(
            verifiedText,
            evidenceSpans,
          );

          sec.markdown = finalMarkdown;
          totalClaims += claims_total;
          totalStripped += claims_stripped;
          totalSnippets += snippets_resolved;
          if (sec.citations) citationsFound += sec.citations.length;
          if (claims_stripped > 0) {
            allWarnings.push(
              `Section ${sec.section_id}: stripped ${claims_stripped} claims.`,
            );
          }
        }

        const strip_rate = totalClaims > 0 ? totalStripped / totalClaims : 0;
        parsed.metrics = {
          claims_total: totalClaims,
          claims_stripped: totalStripped,
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
