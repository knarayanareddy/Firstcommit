import { useQuery } from "@tanstack/react-query";
import { 
  ChunkPK, 
  StableChunkId, 
  ChunkRef, 
  PackId, 
  isUuidString 
} from "@/types/brands";
import { 
  fetchKnowledgeChunkByPK, 
  fetchKnowledgeChunkByStableId, 
  batchFetchKnowledgeChunks,
  ChunkContent
} from "@/lib/knowledgeChunks";

export type { ChunkContent };

/**
 * Fetch a single chunk's content by chunk reference (UUID id OR text chunk_id)
 */
async function fetchChunkContent(packId: PackId, chunkRef: ChunkRef): Promise<ChunkContent | null> {
  if (isUuidString(chunkRef)) {
    return fetchKnowledgeChunkByPK(packId, chunkRef as ChunkPK);
  } else {
    return fetchKnowledgeChunkByStableId(packId, chunkRef as StableChunkId);
  }
}

/**
 * Hook to fetch and cache evidence span content
 */
export function useEvidenceSpanContent(packId: PackId | null, chunkRef: ChunkRef | null) {
  return useQuery({
    queryKey: ["chunk-content", packId, chunkRef],
    queryFn: async () => {
      if (!packId || !chunkRef) return null;
      return fetchChunkContent(packId, chunkRef);
    },
    enabled: Boolean(packId && chunkRef),
    staleTime: 10 * 60 * 1000, 
    gcTime: 30 * 60 * 1000, 
  });
}

/**
 * Get a preview of the content (first N lines)
 */
export function getContentPreview(content: string, maxLines: number = 4): string {
  const lines = content.split("\n");
  const previewLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    previewLines.push("...");
  }
  return previewLines.join("\n");
}

/**
 * Batch fetch multiple chunks at once (resilient to mixed UUID/TEXT)
 */
export function useEvidenceSpanContents(packId: PackId | null, chunkRefs: ChunkRef[]) {
  return useQuery({
    queryKey: ["chunk-contents-batch", packId, [...chunkRefs].sort().join(",")],
    queryFn: async () => {
      if (!packId || chunkRefs.length === 0) return {};
      return batchFetchKnowledgeChunks(packId, chunkRefs);
    },
    enabled: Boolean(packId && chunkRefs.length > 0),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
