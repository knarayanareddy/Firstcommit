// @ts-nocheck
/**
 * handlers/generate-quiz.ts — `generate_quiz` task handler (monolith split, stage 4b).
 */
import type { TraceBuilder } from "../../_shared/telemetry.ts";
import { enforceNoDirectCode } from "../envelope.ts";
import { GROUNDING_RULES, SECURITY_RULES_BLOCK, callWithAgenticReview } from "../generation-core.ts";
import { buildLearnerProfileBlock, buildPackBlock, buildSpansBlock } from "../prompts.ts";
import { batchRerankWithLLM } from "../reranker.ts";
import { errorResponse, jsonResponse, structuredError } from "../responses.ts";
import { resolveSnippets } from "../utils/snippet-resolver.ts";
import { verifyClaims } from "../verifier.ts";

export async function handleGenerateQuiz(
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
  const spans = retrieval.evidence_spans || [];
  const trackKey = context.current_track_key || null;
  const existingModule = inputs.existing_module;

  // ─── RERANKING & RELEVANCE GATE (PHASE 3) ───
  let evidenceSpans = retrieval.evidence_spans || [];
  if (evidenceSpans.length > 0) {
    evidenceSpans = await batchRerankWithLLM(
      `Generate quiz questions for module: ${moduleKey}.`,
      evidenceSpans,
    );
  }

  if (evidenceSpans.length === 0) {
    return structuredError(
      requestId,
      "grounding_failed",
      `I'm sorry, I couldn't find enough relevant technical context to generate a quiz for module "${moduleKey}" accurately.`,
      { suggested_search_queries: [moduleKey, "key features"] },
    );
  }

  const spansBlock = buildSpansBlock(evidenceSpans);
  const packBlock = buildPackBlock(pack);

  const moduleContext = existingModule
    ? `\nModule: "${existingModule.title}" (${existingModule.module_key})\nDescription: ${
      existingModule.description || ""
    }\nSections: ${
      (existingModule.sections || []).map((s: any) => s.heading).join(", ")
    }\nKey takeaways: ${(existingModule.key_takeaways || []).join("; ")}`
    : `\nModule key: ${moduleKey}`;

  const systemPrompt =
    `You are RocketBoard AI Quiz Generator. Generate multiple-choice quiz questions that test comprehension of module content.
${SECURITY_RULES_BLOCK}${GROUNDING_RULES}${buildLearnerProfileBlock(context)}
TASK: Generate up to ${
      limits.max_quiz_questions || 5
    } quiz questions for module "${moduleKey}".
${moduleContext}
${packBlock}

QUIZ CODE INCLUSION:
- For questions about implementation, include a code snippet IN the question prompt (e.g., 'What does this code do?', 'What's missing from this configuration?').
- In explanation_markdown, include the relevant code with annotations explaining why the correct answer is correct.
- This helps learners connect quiz questions to actual codebase patterns.

RULES:
- Each question must have exactly 4 choices with unique IDs (e.g., "q1-a", "q1-b", etc.).
- One choice must be marked as correct via correct_choice_id.
- Include explanation_markdown EVERY claim MUST be cited using the exact format: [SOURCE: filepath:start_line-end_line].
- Questions should test understanding, not memorization.
- Adapt difficulty and language to audience: ${
      audience.audience || "technical"
    }, depth: ${audience.depth || "standard"}.
- Question IDs should be like "q1", "q2", etc.
${spansBlock}

You MUST respond with VALID JSON matching this exact schema:
{
  "type": "generate_quiz",
  "request_id": "${requestId}",
  "pack_id": "${pack.pack_id || ""}",
  "pack_version": ${pack.pack_version || 1},
  "generation_meta": { "timestamp_iso": "${
      new Date().toISOString()
    }", "request_id": "${requestId}" },
  "quiz": {
    "module_key": "${moduleKey}",
    "track_key": ${trackKey ? `"${trackKey}"` : "null"},
    "audience": "${audience.audience || "technical"}",
    "depth": "${audience.depth || "standard"}",
    "questions": [{
      "id": "q1",
      "prompt": "question text",
      "choices": [
        { "id": "q1-a", "text": "choice text" },
        { "id": "q1-b", "text": "choice text" },
        { "id": "q1-c", "text": "choice text" },
        { "id": "q1-d", "text": "choice text" }
      ],
      "correct_choice_id": "q1-a",
      "explanation_markdown": "explanation with [S1] citations",
      "citations": [{ "span_id": "S1", "path": "...", "chunk_id": "..." }]
    }]
  },
  "warnings": []
}

Return ONLY the JSON object. No markdown fences, no extra text.`;

  const userPrompt = `Generate ${
    limits.max_quiz_questions || 5
  } quiz questions for the module "${moduleKey}" using the ${spans.length} evidence spans provided.`;

  try {
    const parsed = await callWithAgenticReview(
      "generate_quiz",
      requestId,
      systemPrompt,
      userPrompt,
      evidenceSpans,
      context.ai_config,
      {
        type: "generate_quiz",
        request_id: requestId,
        pack_id: pack.pack_id || null,
        pack_version: pack.pack_version || 1,
        generation_meta: {
          timestamp_iso: new Date().toISOString(),
          request_id: requestId,
        },
        quiz: {
          module_key: moduleKey,
          track_key: trackKey,
          audience: audience.audience || "technical",
          depth: audience.depth || "standard",
          questions: [],
        },
        warnings: ["AI response could not be parsed as JSON"],
      },
      async (parsed) => {
        if (!parsed.quiz?.questions) {
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

        for (const q of parsed.quiz.questions) {
          if (q.explanation_markdown) {
            const raw = q.explanation_markdown;
            const codeCleaned = enforceNoDirectCode(raw);
            const { verifiedText, claims_total, claims_stripped } =
              await verifyClaims(codeCleaned, evidenceSpans);
            const { finalMarkdown, snippets_resolved } = resolveSnippets(
              verifiedText,
              evidenceSpans,
            );

            q.explanation_markdown = finalMarkdown;
            totalClaims += claims_total;
            totalStripped += claims_stripped;
            totalSnippets += snippets_resolved;
            if (q.citations) citationsFound += q.citations.length;
            if (claims_stripped > 0) {
              allWarnings.push(
                `Question ${q.id}: stripped ${claims_stripped} claims.`,
              );
            }
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
