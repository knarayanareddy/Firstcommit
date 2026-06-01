// @ts-nocheck
/**
 * handlers/generate-exercises.ts — `generate_exercises` task handler (monolith split, stage 4b).
 */
import { enforceNoDirectCode } from "../envelope.ts";
import {
  callWithAgenticReview,
  SECURITY_RULES_BLOCK,
} from "../generation-core.ts";
import { buildPackBlock, buildSpansBlock } from "../prompts.ts";
import { errorResponse, jsonResponse } from "../responses.ts";
import { resolveSnippets } from "../utils/snippet-resolver.ts";
import { verifyClaims } from "../verifier.ts";

export async function handleGenerateExercises(
  envelope: any,
  headers: Record<string, string>,
  extraWarnings: string[] = [],
): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  const retrieval = envelope.retrieval || {};
  const inputs = envelope.inputs || {};
  const spansBlock = buildSpansBlock(retrieval.evidence_spans || []);
  const packBlock = buildPackBlock(pack);

  const systemPrompt =
    `You are RocketBoard AI, generating hands-on exercises for developer onboarding.
${SECURITY_RULES_BLOCK}
${packBlock}${spansBlock}

Generate 2-4 hands-on exercises for the module "${
      inputs.module_title || inputs.module_key
    }".
${
      inputs.module_description
        ? `Module description: ${inputs.module_description}`
        : ""
    }

Each exercise should test PRACTICAL APPLICATION of the concepts. Mix exercise types:
- At least 1 code_find or explore_and_answer (navigation)
- At least 1 code_explain or debug_challenge (comprehension)
- Optionally 1 terminal_task, config_task, or free_response

Exercise types: code_find, code_explain, config_task, debug_challenge, explore_and_answer, terminal_task, free_response
Difficulties: beginner, intermediate, advanced

IMPORTANT: Use ACTUAL file paths, function names, and code from the evidence spans. Reference the REAL codebase, not hypothetical examples.

For each exercise, include:
- exercise_key: unique key like "mod-key-ex-1"
- title: clear title
- description: markdown with full exercise prompt (include code blocks where relevant)
- exercise_type: one of the types above
- difficulty: beginner/intermediate/advanced
- estimated_minutes: 5-15
- hints: array of 2-3 progressive hints (each more specific)
- verification: object with criteria for correct answer
- evidence_citations: array of {span_id, path} referenced

You MUST respond with VALID JSON:
{
  "type": "generate_exercises",
  "request_id": "${requestId}",
  "exercises": [
    {
      "exercise_key": "string",
      "title": "string",
      "description": "markdown string",
      "exercise_type": "string",
      "difficulty": "string",
      "estimated_minutes": number,
      "hints": ["string"],
      "verification": {},
      "evidence_citations": []
    }
  ],
  "warnings": []
}

Return ONLY the JSON object.`;

  const userPrompt = `Generate exercises for module: "${
    inputs.module_title || inputs.module_key
  }"`;

  try {
    const parsed = await callWithAgenticReview(
      "generate_exercises",
      requestId,
      systemPrompt,
      userPrompt,
      retrieval.evidence_spans || [],
      context.ai_config,
      {
        type: "generate_exercises",
        request_id: requestId,
        exercises: [],
        warnings: ["Could not generate exercises"],
      },
      async (parsed) => {
        if (!parsed.exercises) {
          return {
            strip_rate: 0,
            claims_total: 0,
            claims_stripped: 0,
            citations_found: 0,
            snippets_resolved: 0,
            evidence_count: retrieval.evidence_spans?.length || 0,
          };
        }
        let totalClaims = 0;
        let totalStripped = 0;
        let totalSnippets = 0;
        let citationsFound = 0;
        let allWarnings: string[] = [];
        const evidenceSpans = retrieval.evidence_spans || [];

        for (const ex of parsed.exercises) {
          if (ex.description) {
            const raw = ex.description;
            const codeCleaned = enforceNoDirectCode(raw);
            const { verifiedText, claims_total, claims_stripped } =
              await verifyClaims(codeCleaned, evidenceSpans);
            const { finalMarkdown, snippets_resolved } = resolveSnippets(
              verifiedText,
              evidenceSpans,
            );

            ex.description = finalMarkdown;
            totalClaims += claims_total;
            totalStripped += claims_stripped;
            totalSnippets += snippets_resolved;
            if (ex.evidence_citations) {
              citationsFound += ex.evidence_citations.length;
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
