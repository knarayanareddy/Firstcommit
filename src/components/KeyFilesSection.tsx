import { useState, useMemo } from "react";
import { FileCode, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvidenceSpanViewer, type EvidenceSpan } from "@/components/EvidenceSpanViewer";
import { buildSourceLink, getShortFileName } from "@/lib/source-link-builder";
import { getSourceTypeFromPath } from "@/lib/language-detect";
import { cn } from "@/lib/utils";
import { PackId, ChunkPK, StableChunkId, ChunkRef } from "@/types/brands";

interface Citation {
  span_id: string;
  path?: string;
  chunk_ref?: ChunkRef | string;
  chunk_pk?: ChunkPK | string;
  stable_chunk_id?: StableChunkId | string | null;
  start_line?: number;
  end_line?: number;
}

interface EvidenceIndexEntry {
  topic: string;
  citations: Citation[];
}

interface KeyFilesSectionProps {
  evidenceIndex: EvidenceIndexEntry[];
  packId: PackId;
}

interface KeyFile {
  path: string;
  topics: string[];
  citations: Citation[];
}

export function KeyFilesSection({ evidenceIndex, packId }: KeyFilesSectionProps) {
  const [viewerSpan, setViewerSpan] = useState<EvidenceSpan | null>(null);

  const keyFiles = useMemo(() => {
    const fileMap = new Map<string, KeyFile>();

    for (const entry of evidenceIndex) {
      for (const citation of entry.citations) {
        if (!citation.path) continue;
        const existing = fileMap.get(citation.path);
        if (existing) {
          if (!existing.topics.includes(entry.topic)) {
            existing.topics.push(entry.topic);
          }
        } else {
          fileMap.set(citation.path, {
            path: citation.path,
            topics: [entry.topic],
            citations: [citation],
          });
        }
      }
    }

    return Array.from(fileMap.values()).slice(0, 10); // Limit to 10 files
  }, [evidenceIndex]);

  if (keyFiles.length === 0) return null;

  return (
    <>
      <div className="rounded-lg border bg-card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Key Files in This Module</h3>
        </div>
        <div className="space-y-2">
          {keyFiles.map((file) => {
            const sourceType = getSourceTypeFromPath(file.path);
            const fileName = getShortFileName(file.path);
            const firstCitation = file.citations[0];
            const sourceLink = buildSourceLink(file.path, firstCitation?.start_line, firstCitation?.end_line);

            return (
              <div
                key={file.path}
                className="flex items-center justify-between gap-3 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{sourceType.icon}</span>
                    <span className="text-sm font-mono truncate">{fileName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {file.topics.join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {firstCitation?.chunk_ref && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setViewerSpan({
                        span_id: firstCitation.span_id,
                        path: file.path,
                        chunk_ref: (firstCitation.chunk_ref || firstCitation.span_id) as ChunkRef,
                        chunk_pk: (firstCitation.chunk_pk || firstCitation.span_id) as ChunkPK,
                        stable_chunk_id: (firstCitation.stable_chunk_id || null) as StableChunkId | null,
                        start_line: firstCitation.start_line,
                        end_line: firstCitation.end_line,
                      })}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  )}
                  {sourceLink && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => window.open(sourceLink, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Original
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {viewerSpan && (
        <EvidenceSpanViewer
          span={viewerSpan}
          packId={packId}
          isOpen={Boolean(viewerSpan)}
          onClose={() => setViewerSpan(null)}
        />
      )}
    </>
  );
}
