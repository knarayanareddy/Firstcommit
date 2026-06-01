// @ts-nocheck
/**
 * handlers/generate-glossary.ts — `generate_glossary` task handler (monolith split, stage 4b).
 */
import type { TraceBuilder } from "../../_shared/telemetry.ts";
import { enforceNoDirectCode } from "../envelope.ts";
import { GROUNDING_RULES, SECURITY_RULES_BLOCK, callWithAgenticReview } from "../generation-core.ts";
import { buildLearnerProfileBlock, buildPackBlock, buildSpansBlock } from "../prompts.ts";
import { batchRerankWithLLM } from "../reranker.ts";
import { errorResponse, jsonResponse, structuredError } from "../responses.ts";
import { resolveSnippets } from "../utils/snippet-resolver.ts";
import { verifyClaims } from "../verifier.ts";

export async function handleGenerateGlossary(
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
  const density = audience.glossary_density || "standard";

  // ─── RERANKING & RELEVANCE GATE (PHASE 3) ───
  let evidenceSpans = retrieval.evidence_spans || [];
  if (evidenceSpans.length > 0) {
    evidenceSpans = await batchRerankWithLLM(
      `Extract and define key terms for the ${
        pack.title || "this"
      } pack. Density: ${density}`,
      evidenceSpans,
    );
  }

  if (evidenceSpans.length === 0) {
    return structuredError(
      requestId,
      "grounding_failed",
      "I'm sorry, I couldn't find enough relevant context to generate a meaningful glossary. Please ensure your sources are indexed.",
      { suggested_search_queries: ["list main features", "technologies used"] },
    );
  }

  const spansBlock = buildSpansBlock(evidenceSpans);
  const packBlock = buildPackBlock(pack);

  const densityMap: Record<string, string> = {
    low:
      "Only include essential/critical terms that are absolutely necessary to understand the codebase. Aim for 8-12 terms.",
    standard:
      "Include common terms that most engineers would need. Aim for 15-25 terms.",
    high:
      "Be comprehensive — include niche terms, internal jargon, and less obvious concepts. Aim for 25-40 terms.",
  };
  const densityInstruction = densityMap[density] ||
    "Include common terms. Aim for 15-25 terms.";

  const systemPrompt =
    `You are RocketBoard AI Glossary Generator. Generate a pack-specific glossary of technical terms found in the evidence spans.
${SECURITY_RULES_BLOCK}${GROUNDING_RULES}${buildLearnerProfileBlock(context)}
TASK: Generate a glossary for the "${pack.title || "unknown"}" pack.
${packBlock}

GLOSSARY CODE EXAMPLES:
- For technical terms that appear in the codebase, include a brief code example showing how the term is used in THIS pack's code.
- Format the 'context' field to include a small code snippet using markdown fenced code blocks.
- Example: Term 'AuthMiddleware' → Context: 'Used in the API gateway to protect all /api/* routes:\n\`\`\`typescript\napp.use("/api", authMiddleware, apiRouter);\n\`\`\`'

RULES:
- ${densityInstruction}
- Each term must include: term name, definition, context (how it's used in THIS specific pack/codebase, with code examples where applicable), and citations.
- Do NOT include generic programming terms (like "function", "variable", "class") UNLESS they have a pack-specific meaning.
- EVERY claim MUST be cited using the exact format: [SOURCE: filepath:start_line-end_line].
- Audience: ${audience.audience || "technical"}, depth: ${
      audience.depth || "standard"
    }.
- Sort terms alphabetically.
${spansBlock}

You MUST respond with VALID JSON matching this exact schema:
{
  "type": "generate_glossary",
  "request_id": "${requestId}",
  "pack_id": "${pack.pack_id || ""}",
  "pack_version": ${pack.pack_version || 1},
  "generation_meta": { "timestamp_iso": "${
      new Date().toISOString()
    }", "request_id": "${requestId}" },
  "glossary": [
    {
      "term": "string",
      "definition": "string",
      "context": "How this term is used in this specific pack",
      "citations": [{ "span_id": "S1", "path": "...", "chunk_id": "..." }],
      "audience": "${audience.audience || "technical"}"
    }
  ],
  "warnings": []
}

Return ONLY the JSON object. No markdown fences, no extra text.`;

  const userPrompt = `Generate a ${density}-density glossary for the "${
    pack.title || "unknown"
  }" pack using the ${evidenceSpans.length} evidence spans provided.`;

  try {
    const parsed = await callWithAgenticReview(
      "generate_glossary",
      requestId,
      systemPrompt,
      userPrompt,
      evidenceSpans,
      context.ai_config,
      {
        type: "generate_glossary",
        request_id: requestId,
        pack_id: pack.pack_id || null,
        pack_version: pack.pack_version || 1,
        generation_meta: {
          timestamp_iso: new Date().toISOString(),
          request_id: requestId,
        },
        glossary: [],
        warnings: ["AI response could not be parsed as JSON"],
      },
      async (parsed) => {
        if (!parsed.glossary) {
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

        for (const term of parsed.glossary) {
          if (term.context) {
            const raw = term.context;
            const codeCleaned = enforceNoDirectCode(raw);
            const { verifiedText, claims_total, claims_stripped } =
              await verifyClaims(codeCleaned, evidenceSpans);
            const { finalMarkdown, snippets_resolved } = resolveSnippets(
              verifiedText,
              evidenceSpans,
            );

            term.context = finalMarkdown;
            totalClaims += claims_total;
            totalStripped += claims_stripped;
            totalSnippets += snippets_resolved;
            if (term.citations) citationsFound += term.citations.length;
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
