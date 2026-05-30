import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

/**
 * Fetches existing embeddings for a set of content hashes within the same pack and source.
 * This is used by ingestion connectors to avoid regenerating embeddings for unchanged files.
 */
export async function getExistingEmbeddings(
  supabase: SupabaseClient,
  pack_id: string,
  source_id: string,
  hashes: string[],
): Promise<Map<string, number[]>> {
  if (!hashes.length) return new Map();

  const resultMap = new Map<string, number[]>();
  const BATCH_SIZE = 100;

  for (let i = 0; i < hashes.length; i += BATCH_SIZE) {
    const batch = hashes.slice(i, i + BATCH_SIZE);
    // Fetch from the same source to ensure consistency
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("content_hash, embedding")
      .eq("pack_id", pack_id)
      .eq("source_id", source_id)
      .in("content_hash", batch)
      .not("embedding", "is", null)
      .eq("is_redacted", false);

    if (error) {
      console.error("[REUSE] Error fetching existing embeddings batch:", error);
      continue;
    }

    for (const row of (data || [])) {
      // pgvector returns a string like "[0.1,0.2,...]" or already parsed array
      const embedding = typeof row.embedding === "string"
        ? JSON.parse(row.embedding)
        : row.embedding;
      resultMap.set(row.content_hash, embedding);
    }
  }

  return resultMap;
}

/**
 * Fetches existing embeddings from the current active generation of a pack.
 * This is used by reindex-orgs to reuse embeddings across reindexing cycles.
 */
export async function getPreviousGenerationEmbeddings(
  supabase: SupabaseClient,
  pack_id: string,
  hashes: string[],
): Promise<Map<string, number[]>> {
  if (!hashes.length) return new Map();

  const resultMap = new Map<string, number[]>();

  // 1. Find the active generation ID
  const { data: activeGen, error: genErr } = await supabase
    .from("pack_active_generation")
    .select("active_generation_id")
    .eq("pack_id", pack_id)
    .single();

  if (genErr || !activeGen?.active_generation_id) {
    return resultMap;
  }

  // 2. Fetch embeddings from that generation
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("content_hash, embedding")
    .eq("pack_id", pack_id)
    .eq("generation_id", activeGen.active_generation_id)
    .in("content_hash", hashes)
    .not("embedding", "is", null)
    .eq("is_redacted", false);

  if (error) {
    console.error("[REUSE] Error fetching prev generation embeddings:", error);
    return resultMap;
  }

  for (const row of (data || [])) {
    const embedding = typeof row.embedding === "string"
      ? JSON.parse(row.embedding)
      : row.embedding;
    resultMap.set(row.content_hash, embedding);
  }

  return resultMap;
}

/**
 * Calls an embedding endpoint and returns the vector or throws on quota errors.
 */
async function callEmbeddingApi(
  url: string,
  apiKey: string,
  text: string,
): Promise<number[] | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: text.replace(/\n/g, " "),
      model: Deno.env.get("EMBEDDING_MODEL") || "text-embedding-3-small",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429 || res.status === 402) {
      throw new Error(`QUOTA:${res.status}:${body}`);
    }
    console.error(`[EMBEDDING] Error ${res.status} from ${url}:`, body);
    return null;
  }

  const data = await res.json();
  return data.data[0].embedding;
}

/**
 * Generates an embedding for the given text.
 * Prioritizes OpenAI; falls back to local LLM endpoint on quota/billing errors.
 */
export async function generateEmbedding(
  text: string,
  _apiKey?: string,
): Promise<number[] | null> {
  const provider = (Deno.env.get("EMBEDDING_PROVIDER") || "openai").toLowerCase();
  const forceLocal = provider === "local" || provider === "ollama" || provider === "llamacpp";
  const openAIKey = forceLocal ? undefined : Deno.env.get("OPENAI_API_KEY");
  const localKey = Deno.env.get("LOCAL_LLM_API_KEY") || (forceLocal ? "ollama" : undefined);

  if (!openAIKey && !localKey) {
    console.error(
      "[EMBEDDING] No API keys available for embedding generation.",
    );
    return null;
  }

  // Attempt OpenAI first if available
  if (openAIKey) {
    try {
      return await callEmbeddingApi(
        "https://api.openai.com/v1/embeddings",
        openAIKey,
        text,
      );
    } catch (err: any) {
      if (err.message?.startsWith("QUOTA:") && localKey) {
        console.warn(
          `[EMBEDDING] OpenAI quota exceeded, falling back to local LLM endpoint.`,
        );
        // fall through to local LLM endpoint below
      } else {
        console.error("[EMBEDDING] OpenAI error:", err.message);
        return null;
      }
    }
  }

  // local LLM endpoint (primary if no OpenAI key, or fallback on quota error)
  try {
    return await callEmbeddingApi(
      ((Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1") + "/embeddings"),
      localKey!,
      text,
    );
  } catch (err: any) {
    console.error("[EMBEDDING] local LLM endpoint error:", err.message);
    return null;
  }
}

import { updateHeartbeat } from "./ingestion-guards.ts";

/**
 * Processes a batch of chunks: attempts reuse then generates missing embeddings.
 * Updates chunks in-place.
 */
export async function processEmbeddingsWithReuse(
  supabase: SupabaseClient,
  pack_id: string,
  source_id: string,
  chunks: any[],
  openAIApiKey: string,
  jobId?: string,
): Promise<{ reusedCount: number; generatedCount: number }> {
  const indexableChunks = chunks.filter((c) => !c.is_redacted);
  let reusedCount = 0;
  let generatedCount = 0;

  if (indexableChunks.length > 0) {
    const hashes = indexableChunks.map((c) => c.content_hash);
    const existingEmbeddings = await getExistingEmbeddings(
      supabase,
      pack_id,
      source_id,
      hashes,
    );

    for (const chunk of indexableChunks) {
      const reused = existingEmbeddings.get(chunk.content_hash);
      if (reused) {
        chunk.embedding = reused;
        reusedCount++;
      }
    }

    if (openAIApiKey) {
      const remainingToIndex = indexableChunks.filter((c) => !c.embedding);
      if (remainingToIndex.length > 0) {
        // Parallelize embedding generation in batches to avoid overwhelming the gateway/API
        const EMBEDDING_BATCH_SIZE = 50;
        for (
          let i = 0;
          i < remainingToIndex.length;
          i += EMBEDDING_BATCH_SIZE
        ) {
          const batch = remainingToIndex.slice(i, i + EMBEDDING_BATCH_SIZE);
          await Promise.all(
            batch.map(async (chunk) => {
              const vector = await generateEmbedding(
                chunk.content,
                openAIApiKey,
              );
              if (vector) {
                chunk.embedding = vector;
                generatedCount++;
              }
            }),
          );

          // Heartbeat every few batches during the slow embedding phase
          if (jobId && (i / EMBEDDING_BATCH_SIZE) % 5 === 0) {
            const status = await updateHeartbeat(supabase, jobId);
            if (status && status !== "processing") {
              throw new Error(
                `Job ${jobId} is no longer processing (status: ${status}), aborting embeddings.`,
              );
            }
          }
        }
      }
    }
  }

  return { reusedCount, generatedCount };
}
