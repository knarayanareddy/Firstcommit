import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ExternalLink, AlertTriangle, Code, FileText, Slack, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePack } from "@/hooks/usePack";
import { useEvidenceSpanContent, getContentPreview } from "@/hooks/useEvidenceSpanContent";
import { EvidenceSpanViewer, type EvidenceSpan } from "@/components/EvidenceSpanViewer";
import { detectLanguage, isMarkdownContent, getSourceTypeFromPath } from "@/lib/language-detect";
import { buildSourceLink } from "@/lib/source-link-builder";
import { ChunkPK, StableChunkId, ChunkRef, PackId, asChunkRefLenient, asPackId } from "@/types/brands";

interface CitationBadgeProps {
  spanId: string;
  path?: string;
  chunkRef?: ChunkRef | string;
  chunkId?: string; // Legacy alias
  startLine?: number;
  endLine?: number;
  verified?: boolean;
  verificationWarning?: string;
  note?: string;
  packId?: PackId | string;
}

export function CitationBadge({
  spanId,
  path,
  chunkRef,
  chunkId,
  startLine,
  endLine,
  verified,
  verificationWarning,
  note,
  packId: explicitPackId,
}: CitationBadgeProps) {
  const { currentPackId: contextPackId } = usePack();
  const packId = explicitPackId ? asPackId(explicitPackId as string) : contextPackId;
  const [viewerOpen, setViewerOpen] = useState(false);

  const effectiveChunkRef = chunkRef ? asChunkRefLenient(chunkRef as string) : (chunkId ? asChunkRefLenient(chunkId) : undefined);

  // Fetch preview content for hover
  const { data: chunkContent } = useEvidenceSpanContent(
    packId || null,
    effectiveChunkRef || null
  );

  const isFlagged = verified === false;
  const isVerified = verified === true;

  // Determine badge style based on source type
  const sourceType = path ? getSourceTypeFromPath(path) : null;
  const isCode = path ? !isMarkdownContent(path) && detectLanguage(path) !== "text" : false;
  const isDocument = sourceType?.type === "Document" || sourceType?.type === "Confluence" || sourceType?.type === "Notion";
  const isSlack = sourceType?.type === "Slack";
  const isVideo = sourceType?.type === "Loom";

  // Get preview content
  const previewContent = chunkContent ? getContentPreview(chunkContent.content, 5) : null;
  const metadata = (typeof chunkContent?.metadata === "object" && chunkContent?.metadata !== null && !Array.isArray(chunkContent.metadata))
    ? (chunkContent.metadata as Record<string, unknown>)
    : {};

  // Build source link
  const sourceLink = path && chunkContent
    ? buildSourceLink(path, startLine, endLine, { metadata: metadata as Record<string, any> })
    : null;

  const handleClick = () => {
    if (effectiveChunkRef) {
      setViewerOpen(true);
    }
  };

  const handleOpenOriginal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sourceLink) {
      window.open(sourceLink, "_blank");
    }
  };

  const span: EvidenceSpan = {
    span_id: spanId,
    path: path || "",
    chunk_ref: effectiveChunkRef || ("" as ChunkRef),
    chunk_pk: chunkContent?.chunk_pk || ("" as ChunkPK),
    stable_chunk_id: chunkContent?.stable_chunk_id || null,
    start_line: startLine,
    end_line: endLine,
    note,
  };

  // Icon based on content type
  const getIcon = () => {
    if (isFlagged) return <AlertTriangle className="w-2.5 h-2.5" />;
    if (isSlack) return <Slack className="w-2.5 h-2.5" />;
    if (isVideo) return <Film className="w-2.5 h-2.5" />;
    if (isDocument) return <FileText className="w-2.5 h-2.5" />;
    if (isCode) return <Code className="w-2.5 h-2.5" />;
    return <ExternalLink className="w-2.5 h-2.5" />;
  };

  // Badge styles based on source type and verification
  const getBadgeStyle = () => {
    if (isFlagged) {
      return "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20";
    }
    if (isVerified) {
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/20 dark:text-emerald-400";
    }
    if (isSlack) {
      return "bg-muted text-muted-foreground border-border hover:bg-accent";
    }
    if (isVideo) {
      return "bg-purple-500/10 text-purple-700 border-purple-500/20 hover:bg-purple-500/20 dark:text-purple-400";
    }
    if (isDocument) {
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/20 dark:text-emerald-400";
    }
    // Default for code
    return "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:ring-2 hover:ring-primary/50";
  };

  if (!chunkId && !chunkRef && !path) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border cursor-help transition-colors",
              getBadgeStyle()
            )}
          >
            {getIcon()}
            {spanId}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs whitespace-pre-line">
          Citation {spanId} (No source metadata available)
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <HoverCard openDelay={0} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            onClick={handleClick}
            className={cn(
              "relative z-20 inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border cursor-pointer transition-all active:scale-95 pointer-events-auto",
              getBadgeStyle()
            )}
          >
            {getIcon()}
            {spanId}
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="start"
          className="w-80 p-3"
          sideOffset={8}
        >
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">
                  {path?.split("/").pop() || "Source"}
                </div>
                {startLine != null && endLine != null && (
                  <div className="text-[10px] text-muted-foreground">
                    Lines {startLine}–{endLine} • {chunkContent?.stable_chunk_id || effectiveChunkRef}
                  </div>
                )}
              </div>
              {sourceLink && (
                <button
                  onClick={handleOpenOriginal}
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5 shrink-0"
                >
                  View Original <ExternalLink className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            {/* Preview */}
            {previewContent && (
              <div className="rounded border bg-muted/50 p-2 overflow-hidden">
                <pre className="text-[10px] leading-relaxed font-mono text-muted-foreground overflow-hidden whitespace-pre-wrap break-all max-h-24">
                  {previewContent}
                </pre>
              </div>
            )}

            {/* Note */}
            {note && (
              <p className="text-[10px] text-muted-foreground italic">
                {note}
              </p>
            )}

            {/* Warning */}
            {isFlagged && verificationWarning && (
              <div className="flex items-start gap-1.5 text-[10px] text-warning">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                {verificationWarning}
              </div>
            )}

            {/* CTA */}
            <p className="text-[10px] text-muted-foreground">
              Click to view full source
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>

      {/* Full viewer modal */}
      {packId && (
        <EvidenceSpanViewer
          span={span}
          packId={packId}
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
