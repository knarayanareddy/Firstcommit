// @ts-nocheck
/**
 * handlers/refine-module.ts — `refine_module` task handler (monolith split, stage 4b).
 */
import { enforceNoDirectCode } from "../envelope.ts";
import { SECURITY_RULES_BLOCK, callWithAgenticReview } from "../generation-core.ts";
import { buildLanguageBlock, buildLearnerProfileBlock, buildMermaidBlock, buildPackBlock, buildSpansBlock } from "../prompts.ts";
import { batchRerankWithLLM } from "../reranker.ts";
import { errorResponse, jsonResponse, structuredError } from "../responses.ts";
import { resolveSnippets } from "../utils/snippet-resolver.ts";
import { verifyClaims } from "../verifier.ts";

export async function handleRefineModule(
  envelope: any,
  headers: Record<string, string>,
  extraWarnings: string[] = [],
): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  const context = envelope.context || {};
  const retrieval = envelope.retrieval || {};
  const inputs = envelope.inputs || {};
  const audience = context.audience_profile || {};
  const authorInstruction = context.author_instruction || "";
  const moduleRevision = (inputs.module_revision || 1) + 1;

  // ─── RERANKING & RELEVANCE GATE (PHASE 3) ───
  let evidenceSpans = retrieval.evidence_spans || [];
  if (evidenceSpans.length > 0) {
    evidenceSpans = await batchRerankWithLLM(
      `Refine module based on: ${authorInstruction}`,
      evidenceSpans,
    );
  }

  if (evidenceSpans.length === 0) {
    return structuredError(
      requestId,
      "grounding_failed",
      "Refinement failed: couldn't find relevant code or docs to address your instruction. Try a more specific instruction.",
      { suggested_search_queries: [authorInstruction] },
    );
  }

  const spansBlock = buildSpansBlock(evidenceSpans);
  const packBlock = buildPackBlock(pack);
  const existingModule = inputs.existing_module || {};
  const moduleKey = inputs.module_key || existingModule.module_key || "unknown";
  const trackKey = inputs.track_key || existingModule.track_key || null;
  const existingModuleJson = JSON.stringify(existingModule, null, 2);

  const systemPrompt =
    `You are RocketBoard AI Module Refiner. You iteratively improve generated modules based on author instructions.
${SECURITY_RULES_BLOCK}${buildLanguageBlock(context, pack)}${
      buildMermaidBlock(envelope)
    }${buildLearnerProfileBlock(context)}
TASK: Refine the existing module "${
      existingModule.title || moduleKey
    }" based on the author's instruction.

${packBlock}

EXISTING MODULE (current revision):
\`\`\`json
${existingModuleJson}
\`\`\`

AUTHOR INSTRUCTION:
"${authorInstruction}"

RULES:
- Apply the author's requested changes precisely.
- Preserve sections and content that the author did NOT ask to change.
- EVERY claim MUST be cited using the exact format: [SOURCE: filepath:start_line-end_line].
- Document every change in the change_log with what changed and why.
- Increment module_revision to ${moduleRevision}.
- Maintain the same module structure (sections, endcap, key_takeaways, evidence_index).
- Audience: ${audience.audience || "technical"}, depth: ${
      audience.depth || "standard"
    }.

CONTRADICTION HANDLING: If you encounter evidence spans that contradict each other, you MUST include them in the contradictions array. For each contradiction, provide: topic, side_a (claim + citations), side_b (claim + citations), how_to_resolve. Do NOT silently choose one side. Surface all conflicts.
${spansBlock}

You MUST respond with VALID JSON matching this exact schema:
{
  "type": "refine_module",
  "request_id": "${requestId}",
  "pack_id": "${pack.pack_id || ""}",
  "pack_version": ${pack.pack_version || 1},
  "generation_meta": { "timestamp_iso": "${
      new Date().toISOString()
    }", "request_id": "${requestId}" },
  "module_revision": ${moduleRevision},
  "module": {
    "module_key": "${moduleKey}",
    "title": "string",
    "description": "string",
    "estimated_minutes": 15,
    "difficulty": "beginner|intermediate|advanced",
    "track_key": ${trackKey ? `"${trackKey}"` : "null"},
    "audience": "${audience.audience || "technical"}",
    "depth": "${audience.depth || "standard"}",
    "sections": [{ "section_id": "sec-1", "heading": "string", "markdown": "string", "learning_objectives": ["string"], "note_prompts": ["string"], "citations": [{ "span_id": "S1", "path": "...", "chunk_id": "..." }] }],
    "endcap": { "reflection_prompts": ["string"], "quiz_objectives": ["string"], "ready_for_quiz_markdown": "string", "citations": [{ "span_id": "S1" }] },
    "key_takeaways": ["string"],
    "evidence_index": [{ "topic": "string", "citations": [{ "span_id": "S1" }] }]
  },
  "change_log": [{
    "change": "string describing what changed",
    "reason": "string explaining why",
    "citations": [{ "span_id": "S1", "path": "...", "chunk_id": "..." }]
  }],
  "contradictions": [],
  "warnings": []
}

Return ONLY the JSON object. No markdown fences, no extra text.`;

  const userPrompt = `Refine the module "${
    existingModule.title || moduleKey
  }" according to this instruction: "${authorInstruction}". Use the ${spans.length} evidence spans provided to ground any new content.`;

  try {
    const parsed = await callWithAgenticReview(
      "refine_module",
      requestId,
      systemPrompt,
      userPrompt,
      evidenceSpans,
      context.ai_config,
      {
        type: "refine_module",
        request_id: requestId,
        pack_id: pack.pack_id || null,
        pack_version: pack.pack_version || 1,
        generation_meta: {
          timestamp_iso: new Date().toISOString(),
          request_id: requestId,
        },
        module_revision: moduleRevision,
        module: existingModule,
        change_log: [],
        contradictions: [],
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
