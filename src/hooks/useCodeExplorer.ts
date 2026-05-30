import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { PackId, ChunkRef, isUuidString } from "@/types/brands";
import { batchFetchKnowledgeChunks } from "@/lib/knowledgeChunks";

export interface Citation {
  span_id: string;
  path?: string;
  chunk_ref?: string;
  chunk_id?: string; // Legacy/DB
  chunk_pk?: string;
  stable_chunk_id?: string | null;
  start_line?: number;
  end_line?: number;
  note?: string;
  section_heading?: string;
  section_id?: string;
}

export interface ChunkData {
  id: string;
  chunk_id: string; // Database column
  chunk_ref: string; // Unified ref
  chunk_pk: string; // UUID alias
  stable_chunk_id: string | null; // TEXT alias
  content: string;
  path: string;
  start_line: number;
  end_line: number;
  metadata: Record<string, any> | null;
  annotations: Citation[];
}

export interface FileNode {
  path: string;
  name: string;
  type: "file" | "dir";
  children?: FileNode[];
  chunkIds: string[];
  hasAnnotations: boolean;
}

export interface CodeExplorerData {
  files: FileNode[];
  chunks: Map<string, ChunkData>;
  flatFiles: { path: string; chunkIds: string[]; hasAnnotations: boolean }[];
}

/**
 * Build a file tree from a list of file paths
 */
function buildFileTree(
  paths: { path: string; chunkIds: string[]; hasAnnotations: boolean }[]
): FileNode[] {
  const root: FileNode[] = [];

  for (const { path, chunkIds, hasAnnotations } of paths) {
    // Remove source prefix (repo:owner/repo/, doc:, etc.)
    let cleanPath = path;
    const colonIndex = path.indexOf(":");
    if (colonIndex !== -1) {
      cleanPath = path.slice(colonIndex + 1);
    }

    const parts = cleanPath.split("/").filter(Boolean);
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");

      let existing = currentLevel.find((n) => n.name === part);
      if (!existing) {
        existing = {
          path: isFile ? path : fullPath,
          name: part,
          type: isFile ? "file" : "dir",
          children: isFile ? undefined : [],
          chunkIds: isFile ? chunkIds : [],
          hasAnnotations: isFile ? hasAnnotations : false,
        };
        currentLevel.push(existing);
      }

      if (!isFile && existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  // Sort directories first, then alphabetically
  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined,
      }));
  };

  return sortNodes(root);
}

/**
 * Extract all citations from a module's data
 */
export function extractModuleCitations(moduleData: any): Citation[] {
  const citations: Citation[] = [];

  // From sections
  if (moduleData?.sections) {
    for (const section of moduleData.sections) {
      if (section.citations) {
        for (const c of section.citations) {
          citations.push({
            ...c,
            section_heading: section.heading,
            section_id: section.section_id,
          });
        }
      }
    }
  }

  // From endcap
  if (moduleData?.endcap?.citations) {
    for (const c of moduleData.endcap.citations) {
      citations.push({
        ...c,
        section_heading: "Key Takeaways",
        section_id: "endcap",
      });
    }
  }

  // From evidence_index
  if (moduleData?.evidence_index) {
    for (const entry of moduleData.evidence_index) {
      if (entry.citations) {
        for (const c of entry.citations) {
          if (!citations.find((existing) => existing.span_id === c.span_id)) {
            citations.push({
              ...c,
              note: entry.topic,
            });
          }
        }
      }
    }
  }

  return citations;
}

/**
 * Fetch code context for a module
 */
async function fetchModuleCodeContext(
  packId: string,
  citations: Citation[]
): Promise<CodeExplorerData> {
  // Get unique chunk IDs (could be UUID or TEXT)
  const chunkRefs = [...new Set(citations.map((c) => c.chunk_ref || c.chunk_id).filter(Boolean) as string[])];
  
  if (chunkRefs.length === 0) {
    return { files: [], chunks: new Map(), flatFiles: [] };
  }

  // Use the centralized batch fetcher
  const chunksDataMap = await batchFetchKnowledgeChunks(packId as PackId, chunkRefs as ChunkRef[]);
  
  // Get unique chunks by ID (filtering out duplicates from the dual-keyed map)
  const seenIds = new Set<string>();
  const chunksData = Object.values(chunksDataMap).filter(chunk => {
    if (seenIds.has(chunk.id)) return false;
    seenIds.add(chunk.id);
    return true;
  });

  // Build chunks map with annotations
  const chunks = new Map<string, ChunkData>();
  const pathToChunks = new Map<string, string[]>();
  const pathHasAnnotations = new Map<string, boolean>();

  for (const chunk of chunksData || []) {
    // Find citations for this chunk: match on either UUID or TEXT
    const chunkCitations = citations.filter((c) => 
      (c.chunk_ref === chunk.id || c.chunk_ref === chunk.chunk_id) ||
      (c.chunk_id === chunk.id || c.chunk_id === chunk.chunk_id)
    );

    const metadata = typeof chunk.metadata === "object" && chunk.metadata !== null && !Array.isArray(chunk.metadata)
      ? (chunk.metadata as Record<string, unknown>)
      : null;

    const chunk_ref = chunk.chunk_id || chunk.id;

    chunks.set(chunk_ref, {
      id: chunk.id,
      chunk_id: chunk.chunk_id,
      chunk_ref,
      chunk_pk: chunk.id,
      stable_chunk_id: chunk.chunk_id,
      content: chunk.content,
      path: chunk.path,
      start_line: chunk.start_line,
      end_line: chunk.end_line,
      metadata: metadata as Record<string, any> | null,
      annotations: chunkCitations,
    });

    // Track paths
    const existingChunks = pathToChunks.get(chunk.path) || [];
    existingChunks.push(chunk_ref);
    pathToChunks.set(chunk.path, existingChunks);

    if (chunkCitations.length > 0) {
      pathHasAnnotations.set(chunk.path, true);
    }
  }

  // Build flat files list
  const flatFiles = Array.from(pathToChunks.entries()).map(([path, chunkIds]) => ({
    path,
    chunkIds,
    hasAnnotations: pathHasAnnotations.get(path) || false,
  }));

  // Build file tree
  const files = buildFileTree(flatFiles);

  return { files, chunks, flatFiles };
}

/**
 * Hook to fetch and manage code explorer data for a module
 */
export function useCodeExplorer(
  packId: string | null,
  moduleData: any | null,
  enabled: boolean = true
) {
  const citations = moduleData ? extractModuleCitations(moduleData) : [];

  return useQuery({
    queryKey: ["code-explorer", packId, citations.map((c) => c.chunk_id).sort().join(",")],
    queryFn: async () => {
      if (!packId || citations.length === 0) {
        return { files: [], chunks: new Map(), flatFiles: [] } as CodeExplorerData;
      }
      return fetchModuleCodeContext(packId, citations);
    },
    enabled: Boolean(packId && moduleData && enabled && citations.length > 0),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Get merged content for a file from multiple chunks
 */
export function getMergedFileContent(
  chunks: Map<string, ChunkData>,
  chunkIds: string[]
): { content: string; startLine: number; annotations: { startLine: number; endLine: number; citation: Citation }[] } {
  const relevantChunks = chunkIds
    .map((id) => chunks.get(id))
    .filter(Boolean)
    .sort((a, b) => a!.start_line - b!.start_line) as ChunkData[];

  if (relevantChunks.length === 0) {
    return { content: "", startLine: 1, annotations: [] };
  }

  // For now, just concatenate chunks (they may overlap, but this is simpler)
  // In production, you'd want to merge overlapping line ranges
  let mergedContent = "";
  let currentLine = relevantChunks[0].start_line;
  const annotations: { startLine: number; endLine: number; citation: Citation }[] = [];

  for (const chunk of relevantChunks) {
    if (chunk.start_line > currentLine) {
      // Add gap indicator
      mergedContent += `\n// ... (lines ${currentLine} - ${chunk.start_line - 1} not shown) ...\n\n`;
    }
    mergedContent += chunk.content;
    if (!chunk.content.endsWith("\n")) {
      mergedContent += "\n";
    }
    currentLine = chunk.end_line + 1;

    // Collect annotations
    for (const citation of chunk.annotations) {
      annotations.push({
        startLine: citation.start_line || chunk.start_line,
        endLine: citation.end_line || chunk.end_line,
        citation,
      });
    }
  }

  return {
    content: mergedContent,
    startLine: relevantChunks[0].start_line,
    annotations,
  };
}
