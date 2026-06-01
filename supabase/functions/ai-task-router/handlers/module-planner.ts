// @ts-nocheck
/**
 * handlers/module-planner.ts — `module_planner` task handler (monolith split, stage 4b).
 */
import { GROUNDING_RULES, SECURITY_RULES_BLOCK, callWithAgenticReview } from "../generation-core.ts";
import { buildLanguageBlock, buildLearnerProfileBlock, buildPackBlock, buildSpansBlock } from "../prompts.ts";
import { batchRerankWithLLM } from "../reranker.ts";
import { errorResponse, jsonResponse, structuredError } from "../responses.ts";
import { resolveSnippets } from "../utils/snippet-resolver.ts";
import { verifyClaims } from "../verifier.ts";

export async function handleModulePlanner(
  envelope: any,
  headers: Record<string, string>,
  extraWarnings: string[] = [],
): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  // BUGFIX (stage 4b.3): `retrieval` was referenced below but never defined in
  // this handler (every sibling handler defines it) — a latent ReferenceError
  // masked by @ts-nocheck. Restored to match the standard handler idiom.
  const retrieval = envelope.retrieval || {};
  const packTitle = pack.title || "this codebase";

  // ─── RERANKING & RELEVANCE GATE (PHASE 3) ───
  let evidenceSpans = retrieval.evidence_spans || [];
  if (evidenceSpans.length > 0) {
    evidenceSpans = await batchRerankWithLLM(
      `Plan a comprehensive onboarding module for ${packTitle}`,
      evidenceSpans,
    );
  }

  if (evidenceSpans.length === 0) {
    return structuredError(
      requestId,
      "grounding_failed",
      "I'm sorry, I couldn't find enough relevant technical context to plan a meaningful module. Please ensure your sources are indexed and try again.",
      { suggested_search_queries: ["list source files", "pack summary"] },
    );
  }

  const spansBlock = buildSpansBlock(evidenceSpans);
  const packBlock = buildPackBlock(pack);

  const hasTracks = (pack.tracks || []).length > 0;
  const tracksInstruction = hasTracks
    ? "The pack already has these tracks defined. Assign modules to existing tracks where appropriate."
    : "The pack has no tracks yet. Propose tracks based on what you see in the evidence.";

  const systemPrompt =
    `You are RocketBoard AI Module Planner. Your job is to analyze codebase evidence spans and propose a structured onboarding plan.
1. Analyze the evidence spans to understand the codebase/system architecture.
2. Detect technology signals (e.g., "uses_kubernetes", "has_ci_pipeline", "uses_typescript", "has_monitoring", "has_auth_system", "uses_react", "has_database_migrations", etc.).
3. ${tracksInstruction}
4. Propose an ordered list of onboarding modules that cover the key areas a new engineer needs to learn.
5. EVERY claim MUST be cited using the exact format: [SOURCE: filepath:start_line-end_line].

GUIDELINES:
- Order modules from foundational (setup, architecture overview) to advanced (deployment, monitoring).
- Each module should be completable in 10-30 minutes of reading.
- Assign difficulty levels: beginner for setup/overview, intermediate for core systems, advanced for complex topics.
- Include a mix of cross-cutting modules (architecture, conventions) and track-specific modules.
${SECURITY_RULES_BLOCK}${GROUNDING_RULES}${
      buildLanguageBlock(envelope.context, pack)
    }${buildLearnerProfileBlock(envelope.context)}
${packBlock}${spansBlock}

You MUST respond with VALID JSON matching this exact schema:
{
  "type": "module_planner",
  "request_id": "${requestId}",
  "pack_id": "${pack.pack_id || ""}",
  "pack_version": ${pack.pack_version || 1},
  "generation_meta": { "timestamp_iso": "${
      new Date().toISOString()
    }", "request_id": "${requestId}" },
  "detected_signals": [
    { "signal_key": "string", "confidence": "high|medium|low", "explanation": "string", "citations": [{ "span_id": "S1" }] }
  ],
  "tracks": [
    { "track_key": "string", "title": "string", "description": "string" }
  ],
  "module_plan": [
    {
      "module_key": "mod-1",
      "title": "string",
      "description": "string",
      "estimated_minutes": 15,
      "difficulty": "beginner|intermediate|advanced",
      "rationale": "string",
      "citations": [{ "span_id": "S1" }],
      "track_key": "string|null",
      "audience": "technical",
      "depth": "standard"
    }
  ],
  "contradictions": [],
  "warnings": []
}

Return ONLY the JSON object. No markdown fences, no extra text.`;

  const userPrompt =
    `Analyze the ${spans.length} evidence spans provided and create a comprehensive onboarding module plan for the "${
      pack.title || "unknown"
    }" pack.`;

  const spans = evidenceSpans;
  try {
    const parsed = await callWithAgenticReview(
      "module_planner",
      requestId,
      systemPrompt,
      userPrompt,
      evidenceSpans,
      envelope.context?.ai_config,
      {
        type: "module_planner",
        request_id: requestId,
        pack_id: pack.pack_id || null,
        pack_version: pack.pack_version || 1,
        generation_meta: {
          timestamp_iso: new Date().toISOString(),
          request_id: requestId,
        },
        detected_signals: [],
        tracks: [],
        module_plan: [],
        contradictions: [],
        warnings: ["AI response could not be parsed as JSON"],
      },
      async (parsed) => {
        if (!parsed.module_plan) {
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
        const metrics = { citations_found: 0 };

        for (const mod of parsed.module_plan) {
          if (mod.rationale) {
            const { verifiedText, claims_total, claims_stripped } =
              await verifyClaims(mod.rationale, evidenceSpans);
            const { finalMarkdown, snippets_resolved } = resolveSnippets(
              verifiedText,
              evidenceSpans,
            );
            mod.rationale = finalMarkdown;
            totalClaims += claims_total;
            totalStripped += claims_stripped;
            totalSnippets += snippets_resolved;
          }
          if (mod.citations) metrics.citations_found += mod.citations.length;
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
          citations_found: metrics.citations_found,
          source_map: [], // Not collected per-item yet, manifest will use evidenceSpans
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
