import { supabase } from "@/integrations/supabase/client";
import { EvidenceSpanV2 as EvidenceSpan, normalizeChunkRef } from "@/types/evidence";
import { PackId, ChunkPK, ChunkRef, asChunkPK, asChunkRefLenient } from "@/types/brands";

export async function fetchEvidenceSpans(
  packId: PackId,
  query: string,
  maxSpans: number = 10,
  extraParams?: { module_key?: string; track_key?: string; match_threshold?: number },
): Promise<EvidenceSpan[]> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return [];

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/retrieve-spans`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pack_id: packId,
          query,
          max_spans: maxSpans,
          ...extraParams,
        }),
      }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const rawSpans = data.spans || [];
    
    // Normalize and brand incoming spans
    return rawSpans.map((s: any) => {
      const normalized = normalizeChunkRef(s);
      return {
        ...s,
        chunk_ref: normalized.chunk_ref,
        chunk_pk: normalized.chunk_pk,
        stable_chunk_id: normalized.stable_chunk_id
      } as EvidenceSpan;
    });
  } catch {
    return [];
  }
}

/**
 * Multi-query retrieval: fires N queries in parallel, merges results
 * by chunk_pk. Chunks appearing in more queries rank higher.
 * Falls back to single-query if only one query is provided.
 */
export async function fetchEvidenceSpansMultiQuery(
  packId: PackId,
  queries: string[],
  maxSpans: number = 20,
  extraParams?: { module_key?: string; track_key?: string; match_threshold?: number },
): Promise<EvidenceSpan[]> {
  const uniqueQueries = [...new Set(queries.filter(Boolean))];
  if (uniqueQueries.length === 0) return [];
  if (uniqueQueries.length === 1) {
    return fetchEvidenceSpans(packId, uniqueQueries[0] as string, maxSpans, extraParams);
  }

  // Fire all queries in parallel, fetching more per-query so after dedup
  // we still have enough to fill the `maxSpans` budget.
  const perQueryLimit = Math.ceil((maxSpans * 1.5) / uniqueQueries.length) + 5;
  const allResults = await Promise.all(
    uniqueQueries.map((q) =>
      fetchEvidenceSpans(packId, q, perQueryLimit, extraParams)
    )
  );

  // Merge: track how many queries each chunk_pk appeared in & first-seen span
  const hitCount = new Map<ChunkPK, number>();
  const spanMap = new Map<ChunkPK, EvidenceSpan>();

  for (const spans of allResults) {
    const seenInBatch = new Set<ChunkPK>();
    for (const span of spans) {
      const key = span.chunk_pk;
      if (!seenInBatch.has(key)) {
        seenInBatch.add(key);
        hitCount.set(key, (hitCount.get(key) ?? 0) + 1);
        if (!spanMap.has(key)) spanMap.set(key, span);
      }
    }
  }

  // Sort by query-frequency (desc), re-assign stable span_ids
  const merged = [...spanMap.values()].sort(
    (a, b) => {
      const keyB = b.chunk_pk;
      const keyA = a.chunk_pk;
      return (hitCount.get(keyB) ?? 0) - (hitCount.get(keyA) ?? 0);
    }
  );

  return merged.slice(0, maxSpans).map((span, idx) => ({
    ...span,
    span_id: `S${idx + 1}`,
  }));
}

/**
 * Generate a diverse set of search query variants for a given task type.
 * This avoids a round-trip LLM call for query rewriting while still giving
 * multi-angle coverage of the knowledge base.
 */
export function buildRetrievalQueries(
  baseQuery: string,
  context: { packTitle?: string | null; packDescription?: string | null; taskType?: string }
): string[] {
  const queries: string[] = [baseQuery];

  const title = context.packTitle?.toLowerCase() ?? "";
  const desc = context.packDescription?.toLowerCase() ?? "";
  const task = context.taskType ?? "";

  if (task === "module_planner") {
    queries.push(`${title} architecture overview setup getting started`);
    queries.push(`${title} configuration deployment infrastructure workflow`);
    queries.push(`${title} key concepts components patterns best practices`);
  } else if (task === "generate_module" || task === "refine_module") {
    // base query is already the module title + description combination
    queries.push(`${baseQuery} implementation example code`);
    queries.push(`${baseQuery} background concepts prerequisites`);
  } else if (task === "generate_glossary") {
    queries.push(`${title} terminology definitions vocabulary`);
    queries.push(`${title} ${desc} technical terms abbreviations`);
  } else if (task === "generate_paths") {
    queries.push(`${title} onboarding steps checklist first day`);
    queries.push(`${title} setup guide environment configuration`);
  } else if (task === "generate_ask_lead" || task === "chat" || task === "global_chat") {
    queries.push(`${title} team process decisions FAQ`);
    queries.push(`${title} common questions challenges pitfalls`);
  }

  // Always deduplicate and return the first 4 max
  return [...new Set(queries)].slice(0, 4);
}
