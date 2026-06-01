// @ts-nocheck
/**
 * handlers/verify-exercise.ts — `verify_exercise` task handler (monolith split, stage 4b).
 */
import { enforceNoDirectCode } from "../envelope.ts";
import {
  callWithAgenticReview,
  SECURITY_RULES_BLOCK,
} from "../generation-core.ts";
import { buildSpansBlock } from "../prompts.ts";
import { errorResponse, jsonResponse } from "../responses.ts";
import { resolveSnippets } from "../utils/snippet-resolver.ts";
import { verifyClaims } from "../verifier.ts";

export async function handleVerifyExercise(
  envelope: any,
  headers: Record<string, string>,
  extraWarnings: string[] = [],
): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const retrieval = envelope.retrieval || {};
  const inputs = envelope.inputs || {};
  const spansBlock = buildSpansBlock(retrieval.evidence_spans || []);

  const systemPrompt =
    `You are RocketBoard AI, evaluating a learner's exercise submission.
${SECURITY_RULES_BLOCK}
${spansBlock}

Exercise description:
${inputs.exercise_description}

Exercise type: ${inputs.exercise_type}
Verification criteria: ${JSON.stringify(inputs.verification_criteria || {})}

Evaluate the learner's submission for accuracy and completeness.
Be encouraging but point out anything they missed or got wrong.
Keep feedback under 150 words.

For code_find: check if submitted path matches or contains the expected path (be flexible with leading slashes/directories).
For code_explain: evaluate explanation accuracy against the actual code in evidence.
For config_task: check required keys exist with non-empty values. Redact secrets.
For debug_challenge: check if they identified the correct issue and proposed a valid fix.
For terminal_task: check output looks like expected results.
For free_response: evaluate thoughtfulness and accuracy.

You MUST respond with VALID JSON:
{
  "type": "verify_exercise",
  "request_id": "${requestId}",
  "status": "correct" | "partially_correct" | "incorrect",
  "feedback_markdown": "your markdown feedback",
  "score": 0-100,
  "suggestions": ["suggestion1", "suggestion2"],
  "warnings": []
}

Return ONLY the JSON object.`;

  const userPrompt = `Learner's submission:\n\n${inputs.learner_submission}`;

  try {
    const parsed = await callWithAgenticReview(
      "verify_exercise",
      requestId,
      systemPrompt,
      userPrompt,
      retrieval.evidence_spans || [],
      context.ai_config,
      {
        type: "verify_exercise",
        request_id: requestId,
        status: "incorrect",
        feedback_markdown: "Could not evaluate submission.",
        score: 0,
        suggestions: [],
        warnings: [],
      },
      async (parsed) => {
        const raw = parsed.feedback_markdown || "";
        const codeCleaned = enforceNoDirectCode(raw);
        const evidenceSpans = retrieval.evidence_spans || [];
        const { verifiedText, claims_total, claims_stripped, strip_rate } =
          await verifyClaims(codeCleaned, evidenceSpans);
        const { finalMarkdown, snippets_resolved } = resolveSnippets(
          verifiedText,
          evidenceSpans,
        );

        parsed.feedback_markdown = finalMarkdown;
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
          citations_found: 0, // Not explicitly tracked in simple feedback
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
