// @ts-nocheck
/**
 * handlers/create-template.ts — `create_template` task handler (monolith split, stage 4b).
 */
import { callAI, parseAIJson } from "../ai-call.ts";
import { SECURITY_RULES_BLOCK } from "../generation-core.ts";
import { buildLanguageBlock, buildPackBlock } from "../prompts.ts";
import { errorResponse, jsonResponse } from "../responses.ts";

export async function handleCreateTemplate(
  envelope: any,
  headers: Record<string, string>,
  extraWarnings: string[] = [],
): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  const context = envelope.context || {};
  const auth = envelope.auth || {};
  const authorInstruction = context.author_instruction || "";

  if (!authorInstruction) {
    return errorResponse(400, {
      type: "error",
      request_id: requestId,
      error_code: "missing_input",
      message: "context.author_instruction is required for create_template",
    });
  }

  const packBlock = buildPackBlock(pack);

  const systemPrompt =
    `You are RocketBoard AI Template Creator. You create module generation templates based on author instructions.
${SECURITY_RULES_BLOCK}${buildLanguageBlock(context, pack)}
TASK: Create a module template based on the author's description.
${packBlock}

RULES:
- Generate a unique template_key (lowercase, underscores, descriptive).
- Create a clear title and description.
- Define trigger_rules that specify when this template should be auto-applied.
- Write generation_instructions that guide the AI when generating modules with this template.
- Create a section_outline with logical section ordering.
- Define evidence_requirements specifying what evidence is needed.

You MUST respond with VALID JSON matching this exact schema:
{
  "type": "create_template",
  "request_id": "${requestId}",
  "org_id": "${auth.org_id || ""}",
  "generation_meta": { "timestamp_iso": "${
      new Date().toISOString()
    }", "request_id": "${requestId}" },
  "template": {
    "template_key": "string",
    "title": "string",
    "description": "string",
    "trigger_rules": {
      "required_signals": ["string"],
      "path_patterns_any": ["string"],
      "file_types_any": ["string"],
      "repo_hints_any": ["string"]
    },
    "generation_instructions": "string",
    "section_outline": [{ "section_id": "string", "heading": "string", "purpose": "string" }],
    "evidence_requirements": [{ "requirement": "string", "why": "string" }]
  },
  "warnings": []
}

Return ONLY the JSON object. No markdown fences, no extra text.`;

  const userPrompt =
    `Create a module template based on this instruction: ${authorInstruction}`;

  try {
    const raw = await callAI(systemPrompt, userPrompt);
    const parsed = parseAIJson(raw, {
      type: "create_template",
      request_id: requestId,
      org_id: auth.org_id || null,
      generation_meta: {
        timestamp_iso: new Date().toISOString(),
        request_id: requestId,
      },
      template: {
        template_key: "default",
        title: "Untitled Template",
        description: "",
        trigger_rules: {
          required_signals: [],
          path_patterns_any: [],
          file_types_any: [],
          repo_hints_any: [],
        },
        generation_instructions: "",
        section_outline: [],
        evidence_requirements: [],
      },
      warnings: ["AI response could not be parsed as JSON"],
    });
    parsed.type = "create_template";
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
