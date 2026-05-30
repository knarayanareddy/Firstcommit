import type { EvidenceSpan } from "./types.ts";
import { batchRerankWithLLM } from "./reranker.ts";
import {
  extractQualifiedSymbolsFromText,
  normalizeCandidateSymbols,
  SupportedLanguage,
} from "./symbol-dictionary.ts";

export interface DetectiveMetrics {
  detective_enabled: boolean;
  kg_enabled: boolean;
  kg_added_spans: number;
  kg_definition_hits: number;
  kg_reference_hits: number;
  kg_time_ms: number;
  hops_run: number;
  hop0_count: number;
  hop1_added: number;
  hop2_added: number;
  symbols_extracted: number;
  rerank_skipped: boolean;
  rerank_skip_reason: string | null;
  rerank_kept: number;
  time_ms: number;
}

// ─── KG CONFIGURATION (v2) ───
const KG_RETRIEVAL_ENABLED = Deno.env.get("KG_RETRIEVAL_ENABLED") !== "false";
const KG_EXPAND_LIMIT = Number(Deno.env.get("KG_EXPAND_LIMIT") || "12");
const KG_MAX_SYMBOLS = Number(Deno.env.get("KG_MAX_SYMBOLS") || "20");
const KG_MAX_TIME_MS = Number(Deno.env.get("KG_MAX_TIME_MS") || "1500");
const KG_SKIP_RERANK_ENABLED =
  Deno.env.get("KG_SKIP_RERANK_ENABLED") !== "false";
const KG_SKIP_RERANK_MIN_DEFINITION_HITS = Number(
  Deno.env.get("KG_SKIP_RERANK_MIN_DEFINITION_HITS") || "1",
);
const KG_SKIP_RERANK_MIN_REFERENCE_HITS = Number(
  Deno.env.get("KG_SKIP_RERANK_MIN_REFERENCE_HITS") || "1",
);

// ─── KG engine selection (Phase 7) ───────────────────────────────────────────
// "native" (default) keeps the array-overlap symbol RPCs. "age" resolves the
// traversal RPCs to their *_age variants (Apache AGE graph; see
// scripts/enable-age-graph.sql). Same signatures + return shape => interaction
// schema preserved; this only changes which SQL function backs the traversal.
const KG_ENGINE = (Deno.env.get("KG_ENGINE") || "native").toLowerCase();
const kgFn = (
  name: string,
): string => (KG_ENGINE === "age" ? `${name}_age` : name);

/**
 * Orchestrates the Multi-Hop Detective Retrieval Loop.
 */
export async function runDetectiveRetrieval(
  supabase: any,
  envelope: any,
  initialSpans: EvidenceSpan[],
  queryText: string,
  options: {
    maxHops: number;
    maxSymbols: number;
    maxSpansTotal: number;
    maxTimeMs: number;
  } = {
    maxHops: 1,
    maxSymbols: 12,
    maxSpansTotal: 25,
    maxTimeMs: 5000,
  },
): Promise<{ finalSpans: EvidenceSpan[]; metrics: DetectiveMetrics }> {
  const startTime = Date.now();
  let currentSpans = [...initialSpans];
  let hopsRun = 0;
  let symbolsExtractedCount = 0;
  let hop1AddedCount = 0;
  let hop2AddedCount = 0;

  const packId = envelope.pack?.pack_id;
  const orgId = envelope.pack?.org_id;

  // Hop 0: Use initial spans or fetch them
  if (currentSpans.length === 0 && packId) {
    const { data: hop0Spans, error } = await supabase.rpc("hybrid_search_v2", {
      p_org_id: orgId,
      p_pack_id: packId,
      p_query_text: queryText,
      p_query_embedding: null, // Hop 0 server-side often uses text-only if embedding not provided
      p_match_count: 15,
    });
    if (!error && hop0Spans) {
      currentSpans = hop0Spans.map((s: any, idx: number) => ({
        ...s,
        span_id: `S${idx + 1}`,
        chunk_ref: s.chunk_id || s.id,
        chunk_pk: s.id,
        stable_chunk_id: s.chunk_id || null,
      }));
    }
  }

  const hop0Count = currentSpans.length;

  // KG Metrics Tracking
  let kgAddedCount = 0;
  let kgDefHits = 0;
  let kgRefHits = 0;
  let kgTimeMs = 0;
  let kgAttempted = false;
  let rerankSkipped = false;
  let rerankSkipReason: string | null = null;

  // ─── KG EXPANSION (Step 2 Integration) ───
  if (KG_RETRIEVAL_ENABLED && currentSpans.length > 0) {
    // Note: kgTimeMs now specifically measures RPC latency per Option A
    try {
      const seedIds = currentSpans.map((s) => s.chunk_pk);
      // Extract symbols using existing logic but cap specifically for KG
      const symbols = await extractCandidateSymbols(
        currentSpans.slice(0, 10), // Use top 10 as seeds for symbol extraction
        supabase,
        packId,
        KG_MAX_SYMBOLS,
      );
      symbolsExtractedCount = symbols.length;

      if (symbols.length > 0) {
        // Budget Guard: Skip KG expansion if we have already exceeded the KG time limit
        if (Date.now() - startTime > KG_MAX_TIME_MS) {
          console.warn(
            "[Detective] Skipping KG expansion due to elapsed time limit",
          );
        } else {
          kgAttempted = true;
          const rpcStart = Date.now();
          const { data: kgSpans, error: kgError } = await supabase.rpc(
            kgFn("kg_expand_v1"),
            {
              p_org_id: orgId,
              p_pack_id: packId,
              p_seed_ids: seedIds,
              p_symbols: symbols,
              p_limit: KG_EXPAND_LIMIT,
            },
          );
          kgTimeMs = Date.now() - rpcStart;

          if (!kgError && kgSpans) {
            const existingChunkPks = new Set(
              currentSpans.map((s) => s.chunk_pk),
            );
            const newKgSpans = kgSpans
              .filter((s: any) => !existingChunkPks.has(s.id))
              .map((s: any) => ({
                ...s,
                span_id: "",
                chunk_ref: s.chunk_id || s.id,
                chunk_pk: s.id,
                stable_chunk_id: s.chunk_id || null,
                text: s.content,
                relevance_score: s.score, // Use SQL score as initial relevance
                metadata: {
                  ...(s.metadata || {}),
                  relation_type: s.relation_type,
                  relation_symbol: s.relation_symbol,
                },
              }));

            kgAddedCount = newKgSpans.length;
            kgDefHits = newKgSpans.filter((s: any) =>
              s.metadata?.relation_type === "definition"
            ).length;
            kgRefHits = newKgSpans.filter((s: any) =>
              s.metadata?.relation_type === "reference"
            ).length;

            currentSpans = [...currentSpans, ...newKgSpans].slice(
              0,
              options.maxSpansTotal,
            );
          }
        }
      }
    } catch (e) {
      console.warn("[Detective] KG expansion failed:", e);
    }
  }

  // Hop 1 Loop (currently capped at 1 for v1)
  while (
    hopsRun < options.maxHops && Date.now() - startTime < options.maxTimeMs
  ) {
    hopsRun++;

    // 1. Rerank Hop 0 to find the most relevant context for symbols
    const topK = await batchRerankWithLLM(queryText, currentSpans.slice(0, 15));
    const keptForSymbols = topK.slice(0, 8);

    // 2. Extract symbols
    const symbols = await extractCandidateSymbols(
      keptForSymbols,
      supabase,
      packId,
      options.maxSymbols,
    );
    symbolsExtractedCount = symbols.length;

    if (symbols.length === 0) break;

    // 3. Hop 1 Retrieval (Definitions)
    const { data: hop1Spans, error: hop1Error } = await supabase.rpc(
      kgFn("definition_search_v1"),
      {
        p_org_id: orgId,
        p_pack_id: packId,
        p_symbols: symbols,
        p_match_count: 15,
      },
    );

    if (hop1Error) {
      console.error("[Detective] Hop 1 RPC error:", hop1Error);
      break;
    }

    if (hop1Spans && hop1Spans.length > 0) {
      const existingChunkPks = new Set(currentSpans.map((s) => s.chunk_pk));
      const newSpans = hop1Spans
        .filter((s: any) => !existingChunkPks.has(s.id))
        .map((s: any) => ({
          ...s,
          span_id: "", // Will be renumbered
          chunk_ref: s.chunk_id || s.id,
          chunk_pk: s.id,
          stable_chunk_id: s.chunk_id || null,
          text: s.content,
        }));

      hop1AddedCount += newSpans.length;
      currentSpans = [...currentSpans, ...newSpans].slice(
        0,
        options.maxSpansTotal,
      );
    }

    // 4. Hop 2 Retrieval (References - Impact Analysis)
    // Only run if we still have space and time
    if (
      currentSpans.length < options.maxSpansTotal &&
      Date.now() - startTime < options.maxTimeMs
    ) {
      // Pick top 2 symbols for reference expansion to avoid over-fetching
      const topSymbolsForRefs = symbols.slice(0, 2);
      for (const sym of topSymbolsForRefs) {
        const { data: refSpans, error: refError } = await supabase.rpc(
          kgFn("find_references_v1"),
          {
            p_pack_id: packId,
            p_symbol: sym,
            p_limit: 5,
          },
        );

        if (refError) {
          console.error(`[Detective] Hop 2 RPC error for ${sym}:`, refError);
          continue;
        }

        if (refSpans && refSpans.length > 0) {
          const existingChunkPks = new Set(currentSpans.map((s) => s.chunk_pk));
          const newRefSpans = refSpans
            .filter((s: any) => !existingChunkPks.has(s.id || s.chunk_pk))
            .map((s: any) => ({
              ...s,
              span_id: "",
              chunk_ref: s.chunk_id || s.id,
              chunk_pk: s.id || s.chunk_pk,
              stable_chunk_id: s.chunk_id || null,
              text: s.content || "", // RPC might return content or snippet
            }));

          hop2AddedCount += newRefSpans.length;
          currentSpans = [...currentSpans, ...newRefSpans].slice(
            0,
            options.maxSpansTotal,
          );
        }
        if (currentSpans.length >= options.maxSpansTotal) break;
      }
    }

    // Stop if we hit the cap
    if (currentSpans.length >= options.maxSpansTotal) break;
  }

  // ─── Rerank Skip Policy (Step 3 Integration) ───
  // We skip the external LLM reranker if the Knowledge Graph expansion was
  // successful and found both a definition and a reference, and the total span
  // count is small enough to be highly relevant.
  const shouldSkipRerank = KG_SKIP_RERANK_ENABLED &&
    kgDefHits >= KG_SKIP_RERANK_MIN_DEFINITION_HITS &&
    kgRefHits >= KG_SKIP_RERANK_MIN_REFERENCE_HITS &&
    currentSpans.length <= 12;

  let finalSpans: EvidenceSpan[];
  if (shouldSkipRerank) {
    rerankSkipped = true;
    rerankSkipReason = "graph_confident";

    // Relation weights for local sorting: definition > reference > neighbor
    const relationWeights: Record<string, number> = {
      "definition": 0.5, // Bonus for being a formal definition
      "reference": 0.3,
      "neighbor": 0.0,
      "import_link": 0.1,
    };

    finalSpans = currentSpans.slice().sort((a: any, b: any) => {
      const weightA = relationWeights[a.metadata?.relation_type || ""] || 0;
      const weightB = relationWeights[b.metadata?.relation_type || ""] || 0;
      const scoreA = (a.relevance_score || 0) + weightA;
      const scoreB = (b.relevance_score || 0) + weightB;
      return scoreB - scoreA;
    });
  } else {
    finalSpans = await batchRerankWithLLM(queryText, currentSpans);
  }

  // Renumber Spans S1..Sn
  const renumberedSpans = finalSpans.map((s, idx) => ({
    ...s,
    span_id: `S${idx + 1}`,
  }));

  const timeMs = Date.now() - startTime;

  return {
    finalSpans: renumberedSpans,
    metrics: {
      detective_enabled: true,
      kg_enabled: kgAttempted,
      kg_added_spans: kgAddedCount,
      kg_definition_hits: kgDefHits,
      kg_reference_hits: kgRefHits,
      kg_time_ms: kgTimeMs,
      hops_run: hopsRun,
      hop0_count: hop0Count,
      hop1_added: hop1AddedCount,
      hop2_added: hop2AddedCount,
      symbols_extracted: symbolsExtractedCount,
      rerank_skipped: rerankSkipped,
      rerank_skip_reason: rerankSkipReason,
      rerank_kept: renumberedSpans.length,
      time_ms: timeMs,
    },
  };
}

/**
 * Deterministic symbol extraction from code chunks.
 */
export async function extractCandidateSymbols(
  spans: EvidenceSpan[],
  supabase: any,
  packId: string,
  maxSymbols: number,
): Promise<string[]> {
  const symbolMap = new Map<string, number>();

  const getLangFromPath = (path: string): SupportedLanguage | undefined => {
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ts":
      case "tsx":
        return "typescript";
      case "js":
      case "jsx":
        return "javascript";
      case "py":
        return "python";
      case "go":
        return "go";
      case "java":
        return "java";
      case "rs":
        return "rust";
      default:
        return undefined;
    }
  };

  for (const span of spans) {
    const lang = getLangFromPath(span.path);

    // 1. Metadata preference
    if ((span as any).entity_name) {
      const name = (span as any).entity_name;
      symbolMap.set(name, (symbolMap.get(name) || 0) + 10);
    }

    if (span.chunk_pk || span.chunk_id) {
      const { data: chunk } = await supabase
        .from("knowledge_chunks")
        .select("exported_names, imports")
        .eq("id", span.chunk_pk || span.chunk_id)
        .maybeSingle();

      if (chunk) {
        if (chunk.exported_names) {
          const normalized = normalizeCandidateSymbols(
            chunk.exported_names,
            lang,
          );
          normalized.forEach((name) => {
            symbolMap.set(name, (symbolMap.get(name) || 0) + 5);
          });
        }
        if (chunk.imports) {
          const normalized = normalizeCandidateSymbols(chunk.imports, lang);
          normalized.forEach((name) => {
            symbolMap.set(name, (symbolMap.get(name) || 0) + 3);
          });
        }
      }
    }

    // 2. Dictionary-based extraction from text
    const text = span.text || (span as any).content || "";
    if (text) {
      const extracted = extractQualifiedSymbolsFromText(text, lang);
      extracted.forEach((name) => {
        // Boost weighted slightly for types/classes if they still look like they are being defined
        let weight = 1;
        if (
          text.includes(`class ${name}`) ||
          text.includes(`interface ${name}`) || text.includes(`type ${name}`)
        ) {
          weight = 2;
        }
        symbolMap.set(name, (symbolMap.get(name) || 0) + weight);
      });
    }
  }

  // 3. Sort and Cap
  return Array.from(symbolMap.entries())
    .sort((a, b) => b[1] - a[1]) // highest weight first
    .map((entry) => entry[0])
    .slice(0, maxSymbols);
}
