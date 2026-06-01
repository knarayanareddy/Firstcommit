// @ts-nocheck
/**
 * handlers/generate-paths.ts — `generate_paths` task handler (monolith split, stage 4b).
 */
import type { TraceBuilder } from "../../_shared/telemetry.ts";
import { enforceNoDirectCode } from "../envelope.ts";
import { GROUNDING_RULES, SECURITY_RULES_BLOCK, callWithAgenticReview } from "../generation-core.ts";
import { buildLearnerProfileBlock, buildPackBlock, buildSpansBlock } from "../prompts.ts";
import { batchRerankWithLLM } from "../reranker.ts";
import { errorResponse, jsonResponse, structuredError } from "../responses.ts";
import { resolveSnippets } from "../utils/snippet-resolver.ts";
import { verifyClaims } from "../verifier.ts";

export async function handleGeneratePaths(
  envelope: any,
  headers: Record<string, string>,
  extraWarnings: string[] = [],
  trace?: TraceBuilder,
): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  const context = envelope.context || {};
  const retrieval = envelope.retrieval || {};
  const audience = context.audience_profile || {};
  let evidenceSpans = retrieval.evidence_spans || [];

  const packTitle = pack.title || "this pack";

  // ─── RERANKING & RELEVANCE GATE (PHASE 3) ───
  if (evidenceSpans.length > 0) {
    evidenceSpans = await batchRerankWithLLM(
      `Generate onboarding paths for ${packTitle}. Focus on Day 1 and Week 1 setup.`,
      evidenceSpans,
    );
  }

  if (evidenceSpans.length === 0) {
    return structuredError(
      requestId,
      "grounding_failed",
      `I'm sorry, I couldn't find enough relevant context to generate onboarding paths for "${packTitle}".`,
      {
        suggested_search_queries: [
          "overview of the system",
          "how to build the project",
        ],
      },
    );
  }

  const spansBlock = buildSpansBlock(evidenceSpans);
  const packBlock = buildPackBlock(pack);

  const systemPrompt =
    `You are RocketBoard AI Paths Generator. Generate structured onboarding checklists for Day 1 and Week 1.
${SECURITY_RULES_BLOCK}${GROUNDING_RULES}${buildLearnerProfileBlock(context)}
TASK: Generate onboarding paths for the "${pack.title || "unknown"}" pack.
${packBlock}

RULES:
- Generate 3-5 steps for Day 1 (first day tasks) and 4-6 steps for Week 1 (first week tasks).
- Each step must have: id, title, time_estimate_minutes, steps (substeps), success_criteria, citations, and optionally track_key.
- Day 1 should focus on: environment setup, access, first code change, architecture overview.
- Week 1 should focus on: deeper learning, shipping real work, shadowing, team integration.
- EVERY claim MUST be cited using the exact format: [SOURCE: filepath:start_line-end_line].
- Step IDs should be "d1-1", "d1-2" for Day 1 and "w1-1", "w1-2" for Week 1.
- Audience: ${audience.audience || "technical"}, depth: ${
      audience.depth || "standard"
    }.
- If pack has tracks, assign track_key to relevant steps.

SETUP GUIDE (Day 1 — First Item):
The FIRST item in the Day 1 path MUST be a detailed local development setup guide. Analyze the evidence spans for:
- package.json → detect Node version, scripts (dev, build, test, migrate)
- docker-compose.yml → detect required services (databases, caches, etc.)
- .env.example → detect required environment variables
- Makefile / scripts/ → detect setup scripts
- README.md → detect existing setup instructions
- Dockerfile → detect container setup
- terraform/k8s configs → detect infrastructure requirements

Generate step-by-step setup instructions using ONLY information from evidence.
Include the actual commands from evidence in substeps as bash/shell commands.
Use :::setup, :::config, and :::warning callout blocks in the substeps where appropriate.

CALLOUT SYNTAX for path step substeps:
- For setup commands: :::setup[Title]\ncontent\n:::
- For configuration: :::config[Title]\ncontent\n:::
- For gotchas: :::warning[Title]\ncontent\n:::

If evidence contains a README with setup instructions, use those as the base and enrich with details from other files.
${spansBlock}

You MUST respond with VALID JSON matching this exact schema:
{
  "type": "generate_paths",
  "request_id": "${requestId}",
  "pack_id": "${pack.pack_id || ""}",
  "pack_version": ${pack.pack_version || 1},
  "generation_meta": { "timestamp_iso": "${
      new Date().toISOString()
    }", "request_id": "${requestId}" },
  "day1": [
    {
      "id": "d1-1",
      "title": "string",
      "time_estimate_minutes": 30,
      "steps": ["substep 1", "substep 2"],
      "success_criteria": ["criteria 1"],
      "citations": [{ "span_id": "S1", "path": "...", "chunk_id": "..." }],
      "track_key": "string|null",
      "audience": "${audience.audience || "technical"}",
      "depth": "${audience.depth || "standard"}"
    }
  ],
  "week1": [same structure with "w1-" prefixed IDs],
  "warnings": []
}

Return ONLY the JSON object. No markdown fences, no extra text.`;

  const userPrompt = `Generate Day 1 and Week 1 onboarding paths for the "${
    pack.title || "unknown"
  }" pack using the ${evidenceSpans.length} evidence spans provided.`;

  try {
    const parsed = await callWithAgenticReview(
      "generate_paths",
      requestId,
      systemPrompt,
      userPrompt,
      evidenceSpans,
      context.ai_config,
      {
        type: "generate_paths",
        request_id: requestId,
        pack_id: pack.pack_id || null,
        pack_version: pack.pack_version || 1,
        generation_meta: {
          timestamp_iso: new Date().toISOString(),
          request_id: requestId,
        },
        day1: [],
        week1: [],
        warnings: ["AI response could not be parsed as JSON"],
      },
      async (parsed) => {
        const verifyArray = [...(parsed.day1 || []), ...(parsed.week1 || [])];
        if (verifyArray.length === 0) {
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

        for (const step of verifyArray) {
          if (step.steps) {
            const raw = step.steps.join("\n");
            const codeCleaned = enforceNoDirectCode(raw);
            const { verifiedText, claims_total, claims_stripped } =
              await verifyClaims(codeCleaned, evidenceSpans);
            const { finalMarkdown, snippets_resolved } = resolveSnippets(
              verifiedText,
              evidenceSpans,
            );

            step.steps = finalMarkdown.split("\n").filter((l) =>
              l.trim() !== ""
            );
            totalClaims += claims_total;
            totalStripped += claims_stripped;
            totalSnippets += snippets_resolved;
            if (step.citations) citationsFound += step.citations.length;
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
