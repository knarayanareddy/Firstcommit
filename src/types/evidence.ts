import { 
  ChunkPK, 
  StableChunkId, 
  ChunkRef, 
  asChunkRefLenient, 
  asChunkPK, 
  asStableChunkIdStrict, 
  asStableChunkIdLenient,
  isUuidString,
  isStableChunkIdString
} from "./brands";

/**
 * Normalization result with branded types
 */
export interface NormalizedChunkRef {
  chunk_ref: ChunkRef;
  chunk_pk: ChunkPK;
  stable_chunk_id: StableChunkId | null;
  metadata?: {
    source: "legacy" | "strict";
  };
}

export interface EvidenceSpanV2 {
  span_id: string;
  path: string;
  
  /**
   * The unified identifier used for UI lookups.
   * Can be either a row UUID or a stable TEXT chunk_id.
   */
  chunk_ref: ChunkRef;

  /**
   * The explicit database primary key (UUID).
   * Always present in modern retrieval responses.
   */
  chunk_pk: ChunkPK;

  /**
   * The stable business identifier (e.g., C00001).
   * May be null for legacy or unstructured chunks.
   */
  stable_chunk_id: StableChunkId | null;

  start_line?: number;
  end_line?: number;
  content?: string;
}

/**
 * Centralized normalization function to bridge legacy string inputs 
 * to the new branded identifier contract.
 * 
 * This is the primary mechanism for maintaining backward compatibility with
 * stored chat responses and older API versions.
 */
export function normalizeChunkRef(input: {
  chunk_ref?: string | null;
  chunk_pk?: string | null;
  stable_chunk_id?: string | null;
  chunk_id?: string | null; // Legacy field
}): NormalizedChunkRef {
  const DUMMY_PK = "00000000-0000-0000-0000-000000000000" as ChunkPK;

  if (!input) {
    return { 
      chunk_ref: asChunkRefLenient(""), 
      chunk_pk: DUMMY_PK, 
      stable_chunk_id: null,
      metadata: { source: "legacy" }
    };
  }

  // Determine actual values from available fields
  const rawRef = input.chunk_ref || input.chunk_id || "";
  const rawPK = input.chunk_pk || (isUuidString(rawRef) ? rawRef : null);
  const rawStable = input.stable_chunk_id || (isUuidString(rawRef) ? null : rawRef);

  const isStrict = rawStable ? isStableChunkIdString(rawStable) : false;

  return {
    chunk_ref: asChunkRefLenient(rawRef),
    chunk_pk: rawPK ? asChunkPK(rawPK) : DUMMY_PK,
    stable_chunk_id: rawStable ? (isStrict ? asStableChunkIdStrict(rawStable) : asStableChunkIdLenient(rawStable)) : null,
    metadata: {
      source: isStrict ? "strict" : "legacy"
    }
  };
}
