// @ts-nocheck
import { calculateCost, createTrace } from "../_shared/telemetry.ts";
import type { TraceBuilder } from "../_shared/telemetry.ts";
import { batchRerankWithLLM } from "./reranker.ts";
import { verifyClaims, verifyGroundedness } from "./verifier.ts";
import type { EvidenceSpan } from "./types.ts";
import {
  buildLanguageBlock,
  buildLearnerProfileBlock,
  buildLimitsConstraintBlock,
  buildMermaidBlock,
  buildPackBlock,
  buildSpansBlock,
} from "./prompts.ts";
import {
  errorResponse,
  jsonResponse,
  structuredError,
  unsupportedTask,
} from "./responses.ts";
import { authenticateRequest, checkPackAccess } from "./auth.ts";
import { resolveGroundingPolicy } from "./grounding.ts";
import {
  callWithAgenticReview,
  GROUNDING_RULES,
  SECURITY_RULES_BLOCK,
} from "./generation-core.ts";
import { recordAiAudit, recordRagMetrics } from "./persistence.ts";
import {
  type AIConfig,
  callAI,
  parseAIJson,
  PROVIDER_ENDPOINTS,
  resolveAIConfig,
} from "./ai-call.ts";
import { canonicalizeCitations } from "./utils/citation-mapper.ts";
import { resolveSnippets } from "./utils/snippet-resolver.ts";
import {
  computeGroundingScore,
  evaluateGroundingGate,
  getRetryDirective,
} from "./grounding-gate.ts";
import { getInvalidCitations } from "./utils/citation-validator.ts";
import type {
  GroundingAttemptMetrics,
  GroundingDecision,
  GroundingPolicy,
} from "./grounding-gate.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { requireUser } from "../_shared/authz.ts";
import {
  parseAndValidateExternalUrl,
  safeFetch,
} from "../_shared/external-url-policy.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";

// ─── TASK HANDLERS (monolith split, stage 4b) ───
import { handleValidateKey } from "./handlers/validate-key.ts";
import { handleModulePlanner } from "./handlers/module-planner.ts";
import { handleGenerateGlossary } from "./handlers/generate-glossary.ts";
import { handleGeneratePaths } from "./handlers/generate-paths.ts";
import { handleGenerateAskLead } from "./handlers/generate-ask-lead.ts";
import { handleCreateTemplate } from "./handlers/create-template.ts";
import { handleRefineTemplate } from "./handlers/refine-template.ts";
import { handleGenerateExercises } from "./handlers/generate-exercises.ts";
import { handleVerifyExercise } from "./handlers/verify-exercise.ts";
import {
  buildSectionIndex,
  enforceNoDirectCode,
  preprocessEnvelope,
} from "./envelope.ts";

const ALLOWED_ORIGINS = parseAllowedOrigins();

// enforceNoDirectCode moved to ./envelope.ts (monolith split, stage 3c-ii).

// EvidenceSpan moved to ./types.ts (breaks the verifier/faithfulness -> index.ts import cycle).
export type { EvidenceSpan };

// TODO: Replace in-memory rate limiting with a shared durable store (Redis/PostgreSQL) for cross-instance quotas.
// ─── RATE LIMITING ───
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now - val.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(key);
    }
  }
}, 120_000);

const LANGFUSE_SAMPLE_RATE = Number(
  Deno.env.get("LANGFUSE_SAMPLE_RATE") || "1.0",
);

// redactText + redactSpans moved to ./envelope.ts (monolith split, stage 3c-ii).
// resolveGroundingPolicy moved to ./grounding.ts (monolith split, stage 3b).

// sanitizeInputs moved to ./envelope.ts (monolith split, stage 3c-ii).

// SECURITY_RULES_BLOCK + GROUNDING_RULES moved to ./generation-core.ts (monolith split, stage 4a).

// ─── HELPERS ───
// Response builders moved to ./responses.ts (stage 3a).

// buildSpansBlock moved to ./prompts.ts (monolith split, stage 1b).

// quickVerifyCitations moved to ./grounding.ts (monolith split, stage 3b).

// Prompt block builders moved to ./prompts.ts (monolith split, stage 1).

// BYOK config + resolveAIConfig moved to ./ai-call.ts (monolith split, stage 2a).

// callAI + AI_MODEL + JSON parsers moved to ./ai-call.ts (monolith split, stage 2b).

// callWithAgenticReview moved to ./generation-core.ts (monolith split, stage 4a).

// authenticateRequest + checkPackAccess moved to ./auth.ts (stage 3a).

// recordRagMetrics + recordAiAudit moved to ./persistence.ts (stage 3c).

// preprocessEnvelope moved to ./envelope.ts (monolith split, stage 3c-ii).

// buildSectionIndex moved to ./envelope.ts (monolith split, stage 3c-ii).

// ─── CHAT HANDLER ───
async function handleChat(
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

// ─── GLOBAL CHAT HANDLER (Mission Control) ───
async function handleGlobalChat(
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
    retrieval._detective_metrics = detectiveResult.metrics;
  } else if (evidenceSpans.length > 0) {
    evidenceSpans = await batchRerankWithLLM(lastUserMessage, evidenceSpans);
  }

  if (evidenceSpans.length === 0) {
    return structuredError(
      requestId,
      "grounding_failed",
      "I'm sorry, Mission Control couldn't find enough relevant context in your pack to answer that accurately. Try a more specific question about your codebase or settings.",
      {
        suggested_search_queries: [
          "how to add a new module",
          "github source settings",
        ],
      },
    );
  }

  const { markdown: spansBlock, allowedTokens } = buildSpansBlock(
    evidenceSpans,
  );
  const packBlock = buildPackBlock(pack);
  const audienceBlock = audience.audience
    ? `\nAudience: ${audience.audience}, depth: ${audience.depth || "standard"}`
    : "";

  // Fetch section index across all published modules (top 50 headings)
  const sectionIndexBlock = pack.pack_id
    ? await buildSectionIndex(pack.pack_id, null, 50)
    : "";

  const systemPrompt =
    `You are Mission Control, a helpful AI assistant for the RocketBoard onboarding platform. You help users understand:
- The overall platform features and capabilities
- How onboarding packs, modules, tracks, and paths work
- How to use AI generation features (module plans, quizzes, glossaries, paths)
- How to configure settings, manage sources, and customize content
- General questions about the codebase and onboarding workflow

${SECURITY_RULES_BLOCK}${GROUNDING_RULES}${buildLearnerProfileBlock(context)}
CODE IN CHAT RESPONSES:
- For repository code or real implementations, you MUST use the [SNIPPET: filepath:start-end | lang=...] format.
- DO NOT use triple-backticks for codebase content; the server will resolve your [SNIPPET] tags into the actual code lines.
- You may use triple-backticks ONLY for suggestions or pseudocode if you prefix the first line with "// PSEUDOCODE".
- Precede every [SNIPPET] with its corresponding [SOURCE] citation within 300 characters.

RULES:
- Be friendly, concise, and helpful.
- ${envelope.context?.is_global_chat ? "OUTPUT FORMAT CONTRACT (STRICT):" : ""}
  1. Each bullet point MUST be exactly one single sentence.
  2. Each bullet MUST end with one or more citations in the exact format [SOURCE: filepath:start_line-end_line].
  3. Do not include a second sentence in a bullet; if more detail is needed, split it into a new bullet point.
  4. Do not use semicolons (;) to join sentences. Prefer commas (,) if internal punctuation is needed.
  5. The response_markdown MUST consist ONLY of these cited bullet points. No introductory or concluding text.
  6. Do not greet the user.
  7. Do not say "I'm Mission Control".
  8. Do not include pleasantries.
  9. Start immediately with bullet 1.
  10. Never output placeholders like <path> or <SOURCE>.
- If evidence spans are provided, ground your answers in them and cite every technical claim using the exact format: [SOURCE: filepath:start_line-end_line]. The system will convert these to UI badges automatically.
- If you cannot find sufficient evidence for a claim, you MUST output exactly: "Insufficient evidence in current sources." and list it in unverified_claims. Suggest a search query or asking a lead.
- Keep responses under ${limits.max_chat_words || 350} words.
- Use markdown formatting.
- Suggest relevant follow-up questions.

UI ACTIONS (CONTROL THE PLATFORM):
When the user asks to change a setting or navigate somewhere, you can include special [UI_ACTION: slug(label)] tags in your response. The UI will render these as clickable buttons.
Supported action slugs:
- theme_dark: "Switch to Dark Mode"
- theme_light: "Switch to Light Mode"
- navigate_plan: "Go to the Module Plan"
- navigate_sources: "Go to the Sources page"
- open_help: "Open the Help Center"
- open_sandbox: "Enter the Sandbox"
- start_tour: "Start the platform tour"
Example: "I can help with that. [UI_ACTION: theme_dark(Switch to Dark Mode)]"

SECTION REFERENCES: When your answer maps to a specific module section from the Section Index below, include it in referenced_sections. Only include genuinely relevant sections.

CONTRADICTION HANDLING: If you detect contradictions in the evidence while answering, include them in the contradictions array. Be explicit about what conflicts and cite both sides.
${
      buildLanguageBlock(context, pack)
    }${packBlock}${audienceBlock}${sectionIndexBlock}${spansBlock}

RESPONSE TEMPLATE (MUST FOLLOW EXACTLY):
- <one sentence claim> [SOURCE: <copy one allowed token exactly>]
- <one sentence claim> [SOURCE: <copy one allowed token exactly>]
- <one sentence claim> [SOURCE: <copy one allowed token exactly>]
- <one sentence claim> [SOURCE: <copy one allowed token exactly>]
- <one sentence claim> [SOURCE: <copy one allowed token exactly>]
(Replace the <...> content; keep brackets and spacing.)

You MUST respond with VALID JSON matching this schema:
{
  "type": "global_chat",
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
  "warnings": []
}

Return ONLY the JSON object, no markdown fences, no extra text.`;

  const gcMessages = (conversation.messages || []).map((m: any) => ({
    role: m.role,
    content: m.content,
  }));
  const userPrompt = gcMessages.length > 0
    ? JSON.stringify(gcMessages)
    : "Hello.";

  try {
    const parsed = await callWithAgenticReview(
      "global_chat",
      requestId,
      systemPrompt,
      userPrompt,
      evidenceSpans,
      context.ai_config,
      {
        type: "global_chat",
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
      },
      async (parsed) => {
        const raw = parsed.response_markdown || "";

        // Tiny content check: Ban greetings / filler if 0 citations
        const lowQualityGreeting =
          /^(Hi|Hello|I'm Mission Control)/i.test(raw.trim()) ||
          raw.trim().toLowerCase().startsWith("i am mission control");
        const hasNoCitations = !raw.includes("[SOURCE:");

        if (lowQualityGreeting && hasNoCitations) {
          console.warn(
            "[CHECK FAIL] Response is a greeting without citations.",
          );
          return {
            strip_rate: 0,
            claims_total: 0,
            claims_stripped: 0,
            citations_found: 0,
            no_citations_found: true,
            evidence_count: evidenceSpans.length,
          };
        }

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

        console.log("[DEBUG] raw response_markdown:", raw.substring(0, 500));
        const codeCleaned = enforceNoDirectCode(raw);
        const { verifiedText, claims_total, claims_stripped, strip_rate } =
          await verifyClaims(codeCleaned, evidenceSpans);
        console.log(
          `[DEBUG] verifyClaims: total=${claims_total} stripped=${claims_stripped} rate=${strip_rate}`,
        );
        console.log("[DEBUG] verifiedText:", verifiedText.substring(0, 300));
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
    console.error("[handleGlobalChat] error:", e);
    return errorResponse(e.status || 500, {
      error: e.message || "Internal server error",
    }, headers);
  }
}

// ─── MODULE PLANNER HANDLER ───
// handleModulePlanner moved to ./handlers/module-planner.ts (monolith split, stage 4b).

// ─── GENERATE MODULE HANDLER ───
async function handleGenerateModule(
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

// ─── GENERATE QUIZ HANDLER ───
async function handleGenerateQuiz(
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

// ─── GENERATE GLOSSARY HANDLER ───
// handleGenerateGlossary moved to ./handlers/generate-glossary.ts (monolith split, stage 4b).

// ─── GENERATE PATHS HANDLER ───
// handleGeneratePaths moved to ./handlers/generate-paths.ts (monolith split, stage 4b).

// ─── GENERATE ASK LEAD HANDLER ───
// handleGenerateAskLead moved to ./handlers/generate-ask-lead.ts (monolith split, stage 4b).

// ─── REFINE MODULE HANDLER ───
async function handleRefineModule(
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

// ─── SIMPLIFY SECTION HANDLER ───
async function handleSimplifySection(
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
${SECURITY_RULES_BLOCK}${GROUNDED_RULES}${buildLearnerProfileBlock(context)}
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

// ─── CREATE TEMPLATE HANDLER ───
// handleCreateTemplate moved to ./handlers/create-template.ts (monolith split, stage 4b).

// ─── REFINE TEMPLATE HANDLER ───
// handleRefineTemplate moved to ./handlers/refine-template.ts (monolith split, stage 4b).

// ─── GENERATE EXERCISES HANDLER ───
// handleGenerateExercises moved to ./handlers/generate-exercises.ts (monolith split, stage 4b).

// ─── VERIFY EXERCISE HANDLER ───
// handleVerifyExercise moved to ./handlers/verify-exercise.ts (monolith split, stage 4b).

// ─── VALIDATE BYOK KEY ───
// handleValidateKey moved to ./handlers/validate-key.ts (monolith split, stage 4b).

// ─── MAIN HANDLER ───
Deno.serve(async (req: Request) => {
  const currentCorsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);
  const corsResponse = handleCorsPreflight(req, ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;

  // ─── AUTHENTICATION (Phase 1) ───
  // (Redundant call removed; handled by authenticateRequest inside try/catch)

  let trace = createTrace({ taskType: "startup", requestId: "unknown" }, {
    enabled: false,
  });

  try {
    // JWT Authentication
    const authResult = await authenticateRequest(req, currentCorsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    // Late-bind userId to trace if it was already created
    trace.updateMetadata({ userId });

    // Rate limiting
    if (!checkRateLimit(userId)) {
      return structuredError(
        "unknown",
        "rate_limited",
        "Too many requests. Please wait a moment and try again (limit: 30/min).",
        currentCorsHeaders,
      );
    }

    const envelope = await readJson(req, currentCorsHeaders);
    const taskType = envelope.task?.type;
    const requestId = envelope.task?.request_id || envelope.task?.trace_id ||
      crypto.randomUUID();

    if (!taskType) {
      return errorResponse(
        400,
        { error: "Missing task.type in envelope" },
        currentCorsHeaders,
      );
    }

    // ─── Telemetry: create trace ───
    const isErrorOrRetry = (envelope.task?.attempts || 1) > 1;
    const shouldTrace = isErrorOrRetry || Math.random() < LANGFUSE_SAMPLE_RATE;

    trace = createTrace({
      taskType,
      requestId,
      userId,
      packId: envelope.pack?.pack_id,
      org_id: envelope.pack?.org_id,
      moduleKey: envelope.context?.current_module_key ||
        envelope.inputs?.module?.module_key,
      trackKey: envelope.context?.current_track_key,
      environment: Deno.env.get("LANGFUSE_ENVIRONMENT") || "production",
      serviceName: "ai-task-router",
    }, { enabled: shouldTrace });

    // Handle validate key as a special case bypassing normal auth logic if needed
    if (taskType === "validate_key") {
      return handleValidateKey(envelope);
    }

    // Resolve AI Config (BYOK)
    envelope.context = envelope.context || {};
    envelope.context.ai_config = await resolveAIConfig(userId);

    // Pack access authorization
    const authSpan = trace.startSpan("pack-authorization");
    const accessDenied = await checkPackAccess(
      userId,
      envelope,
      currentCorsHeaders,
    );
    if (accessDenied) {
      authSpan.error("Access denied");
      trace.setError("Pack access denied");
      await trace.flush();
      return accessDenied;
    }
    authSpan.end({ authorized: true });

    // Preprocess: sanitize inputs + redact spans
    const preprocessSpan = trace.startSpan("preprocessing", {
      spanCount: envelope.retrieval?.evidence_spans?.length || 0,
    });
    const preprocessed = preprocessEnvelope(envelope, currentCorsHeaders);
    if (preprocessed instanceof Response) {
      preprocessSpan.error("Preprocessing rejected input");
      trace.setError("Input validation failed");
      await trace.flush();
      return preprocessed;
    }
    const { envelope: safeEnvelope, warnings: extraWarnings } = preprocessed;
    preprocessSpan.end({
      warningCount: extraWarnings.length,
      finalSpanCount: safeEnvelope.retrieval?.evidence_spans?.length || 0,
    });

    // ─── Dispatch to handler ───
    let result: Response;
    switch (taskType) {
      case "chat":
        result = await handleChat(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "global_chat":
        result = await handleGlobalChat(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "module_planner":
        result = await handleModulePlanner(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "generate_module":
        result = await handleGenerateModule(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "generate_quiz":
        result = await handleGenerateQuiz(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "generate_glossary":
        result = await handleGenerateGlossary(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "generate_paths":
        result = await handleGeneratePaths(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "generate_ask_lead":
        result = await handleGenerateAskLead(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "simplify_section":
        result = await handleSimplifySection(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "create_template":
        result = await handleCreateTemplate(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
        );
        break;
      case "refine_template":
        result = await handleRefineTemplate(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
        );
        break;
      case "refine_module":
        result = await handleRefineModule(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
        );
        break;
      case "generate_exercises":
        result = await handleGenerateExercises(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
        );
        break;
      case "verify_exercise":
        result = await handleVerifyExercise(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
        );
        break;
      default:
        result = structuredError(
          requestId,
          "unsupported_task",
          `Unknown task type: ${taskType}`,
          currentCorsHeaders,
        );
    }

    // ─── Inject traceId into the response body ───
    try {
      const body = await result.clone().json();
      body.trace_id = trace.getTraceId();
      result = new Response(JSON.stringify(body), {
        status: result.status,
        headers: result.headers,
      });
    } catch { /* non-JSON response, skip injection */ }

    // ─── Record local metrics (Phase 6) ───
    await recordRagMetrics(trace, safeEnvelope);

    // ─── AI Audit Log (Phase 6) ───
    try {
      const respClone = result.clone();
      const body = await respClone.json();
      const markdown = body.display_response || body.response_markdown || "";
      if (markdown) {
        await recordAiAudit(trace, safeEnvelope, markdown);
      }
    } catch (e) {
      console.warn("[serve] AI Audit recording failed:", (e as any).message);
    }

    // ─── Flush telemetry ───
    await trace.flush();
    return result;
  } catch (e: any) {
    if (e.response) return e.response;

    console.error("ai-task-router error:", e);
    trace.setError(e.message || "Unknown error");

    // Part C: Record grounding failure metrics even on 422 refusal path so rag_metrics is never empty.
    if (e.status === 422 || e.error_code === "insufficient_evidence") {
      try {
        const targetEnvelope =
          (typeof safeEnvelope !== "undefined" && safeEnvelope) ||
          (typeof envelope !== "undefined" && envelope);
        if (targetEnvelope) {
          await recordRagMetrics(trace, targetEnvelope);
        }
      } catch (metricsError) {
        console.warn("[catch] Failed to record failure metrics:", metricsError);
      }
    }

    await trace.flush();
    const requestId = (typeof envelope !== "undefined" &&
      (envelope.task?.request_id || envelope.task?.trace_id)) || "unknown";
    if (e.error_code) {
      return structuredError(
        requestId,
        e.error_code,
        e.message || "An error occurred",
        currentCorsHeaders,
      );
    }
    return structuredError(
      requestId,
      "network_error",
      e instanceof Error ? e.message : "Unknown error",
      currentCorsHeaders,
    );
  }
});
