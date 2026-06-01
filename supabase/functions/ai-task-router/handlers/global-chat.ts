// @ts-nocheck
/**
 * handlers/global-chat.ts — `global_chat` task handler (monolith split, stage 4b).
 */
import { createServiceClient } from "../../_shared/supabase-clients.ts";
import type { TraceBuilder } from "../../_shared/telemetry.ts";
import { runDetectiveRetrieval } from "../detective-retrieval.ts";
import { buildSectionIndex, enforceNoDirectCode } from "../envelope.ts";
import {
  callWithAgenticReview,
  GROUNDING_RULES,
  SECURITY_RULES_BLOCK,
} from "../generation-core.ts";
import {
  buildLanguageBlock,
  buildLearnerProfileBlock,
  buildPackBlock,
  buildSpansBlock,
} from "../prompts.ts";
import { batchRerankWithLLM } from "../reranker.ts";
import { errorResponse, jsonResponse, structuredError } from "../responses.ts";
import { canonicalizeCitations } from "../utils/citation-mapper.ts";
import { getInvalidCitations } from "../utils/citation-validator.ts";
import { resolveSnippets } from "../utils/snippet-resolver.ts";
import { verifyClaims } from "../verifier.ts";

export async function handleGlobalChat(
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
