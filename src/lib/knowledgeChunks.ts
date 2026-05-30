import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { 
  ChunkPK, 
  StableChunkId, 
  ChunkRef, 
  PackId, 
  isUuidString 
} from "@/types/brands";

export interface ChunkContent {
  id: ChunkPK;           // Internal UUID
  chunk_id: StableChunkId; // Stable TEXT id
  chunk_pk: ChunkPK;     // Unified alias for id
  stable_chunk_id: StableChunkId | null; // Unified alias for chunk_id
  content: string;
  path: string;
  start_line: number;
  end_line: number;
  metadata: Json | null;
  is_redacted: boolean | null;
}

/**
 * Internal helper to map database row to ChunkContent interface
 */
function mapToChunkContent(row: any): ChunkContent {
  return {
    ...row,
    id: row.id as ChunkPK,
    chunk_id: row.chunk_id as StableChunkId,
    chunk_pk: row.id as ChunkPK,
    stable_chunk_id: row.chunk_id as StableChunkId
  };
}

/**
 * Fetch a single knowledge chunk by its primary key (UUID).
 */
export async function fetchKnowledgeChunkByPK(
  packId: PackId, 
  chunkPk: ChunkPK
): Promise<ChunkContent | null> {
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("id, chunk_id, content, path, start_line, end_line, metadata, is_redacted")
    .eq("pack_id", packId)
    .eq("id", chunkPk)
    .maybeSingle();

  if (!data || error) return null;
  return mapToChunkContent(data);
}

/**
 * Fetch a single knowledge chunk by its stable identifier (e.g., C00001).
 */
export async function fetchKnowledgeChunkByStableId(
  packId: PackId, 
  stableId: StableChunkId
): Promise<ChunkContent | null> {
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("id, chunk_id, content, path, start_line, end_line, metadata, is_redacted")
    .eq("pack_id", packId)
    .eq("chunk_id", stableId)
    .maybeSingle();

  if (!data || error) return null;
  return mapToChunkContent(data);
}

/**
 * Batch fetch multiple knowledge chunks by a list of references (mixed UUID or TEXT).
 * Returns a map keyed by BOTH the primary key (UUID) and the stable ID (TEXT).
 */
export async function batchFetchKnowledgeChunks(
  packId: PackId, 
  refs: ChunkRef[]
): Promise<Record<string, ChunkContent>> {
  if (refs.length === 0) return {};

  const uuidRefs = refs.filter(isUuidString);
  const textRefs = refs.filter(ref => !isUuidString(ref));

  let query = supabase
    .from("knowledge_chunks")
    .select("id, chunk_id, content, path, start_line, end_line, metadata, is_redacted")
    .eq("pack_id", packId);

  // Build OR filter for mixed identifiers
  if (uuidRefs.length > 0 && textRefs.length > 0) {
    query = query.or(`id.in.(${uuidRefs.join(",")}),chunk_id.in.(${textRefs.join(",")})`);
  } else if (uuidRefs.length > 0) {
    query = query.in("id", uuidRefs);
  } else {
    query = query.in("chunk_id", textRefs);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[KnowledgeChunks:Batch] Error fetching chunks:", error);
    return {};
  }

  const map: Record<string, ChunkContent> = {};
  for (const row of data || []) {
    const chunk = mapToChunkContent(row);
    map[chunk.id] = chunk;
    map[chunk.chunk_id] = chunk;
  }
  return map;
}
