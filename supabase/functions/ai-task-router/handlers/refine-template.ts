// @ts-nocheck
/**
 * handlers/refine-template.ts — `refine_template` task handler (monolith split, stage 4b).
 */
import { callAI, parseAIJson } from "../ai-call.ts";
import { SECURITY_RULES_BLOCK } from "../generation-core.ts";
import { buildLanguageBlock, buildLearnerProfileBlock, buildPackBlock } from "../prompts.ts";
import { errorResponse, jsonResponse } from "../responses.ts";

export async function handleRefineTemplate(
  envelope: any,
  headers: Record<string, string>,
  extraWarnings: string[] = [],
): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  const context = envelope.context || {};
  const auth = envelope.auth || {};
  const inputs = envelope.inputs || {};
  const authorInstruction = context.author_instruction || "";
  const existingTemplate = inputs.existing_template;

  if (!existingTemplate) {
    return errorResponse(400, {
      type: "error",
      request_id: requestId,
      error_code: "missing_input",
      message: "inputs.existing_template is required for refine_template",
    });
  }
  if (!authorInstruction) {
    return errorResponse(400, {
      type: "error",
      request_id: requestId,
      error_code: "missing_input",
      message: "context.author_instruction is required for refine_template",
    });
  }

  const packBlock = buildPackBlock(pack);

  const systemPrompt =
    `You are RocketBoard AI Template Refiner. You improve existing module templates based on author feedback.
${SECURITY_RULES_BLOCK}${buildLanguageBlock(context, pack)}${
      buildLearnerProfileBlock(context)
    }
TASK: Refine this template based on the author's instruction.
${packBlock}

EXISTING TEMPLATE:
${JSON.stringify(existingTemplate, null, 2)}

AUTHOR INSTRUCTION: ${authorInstruction}

RULES:
- Apply the author's requested changes.
- Preserve parts that weren't mentioned for change.
- Document each change in the change_log.
- Keep the template_key the same unless the author asks to change it.

You MUST respond with VALID JSON matching this exact schema:
{
  "type": "refine_template",
  "request_id": "${requestId}",
  "org_id": "${auth.org_id || ""}",
  "generation_meta": { "timestamp_iso": "${
      new Date().toISOString()
    }", "request_id": "${requestId}" },
  "template": { same structure as create_template },
  "change_log": [{ "change": "string", "reason": "string" }],
  "warnings": []
}

Return ONLY the JSON object. No markdown fences, no extra text.`;

  const userPrompt = `Refine this template: "${
    existingTemplate.title || "Untitled"
  }". Author says: ${authorInstruction}`;

  try {
    const raw = await callAI(systemPrompt, userPrompt);
    const parsed = parseAIJson(raw, {
      type: "refine_template",
      request_id: requestId,
      org_id: auth.org_id || null,
      generation_meta: {
        timestamp_iso: new Date().toISOString(),
        request_id: requestId,
      },
      template: existingTemplate,
      change_log: [],
      warnings: ["AI response could not be parsed as JSON"],
    });
    parsed.type = "refine_template";
    parsed.request_id = requestId;
    if (extraWarnings.length) {
      parsed.warnings = [...(parsed.warnings || []), ...extraWarnings];
    }
    return jsonResponse(parsed, headers);
  } catch (e: any) {
    if (e.status) return errorResponse(e.status, { error: e.message }, headers);
    throw e;
  }
}
