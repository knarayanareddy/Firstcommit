import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Highlight, themes } from "prism-react-renderer";
import { X, Copy, ExternalLink, Check, FileCode, FileText, AlertTriangle, Bookmark as BookmarkIcon } from "lucide-react";
import { BookmarkButton } from "@/components/BookmarkButton";
import { useEvidenceSpanContent } from "@/hooks/useEvidenceSpanContent";
import { detectLanguage, isMarkdownContent, getSourceTypeFromPath } from "@/lib/language-detect";
import { buildSourceLink, parsePathToBreadcrumbs, getShortFileName } from "@/lib/source-link-builder";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { ChunkPK, StableChunkId, ChunkRef, PackId } from "@/types/brands";

export interface EvidenceSpan {
  span_id: string;
  path: string;
  chunk_ref: ChunkRef;
  chunk_pk: ChunkPK;
  stable_chunk_id: StableChunkId | null;
  start_line?: number;
  end_line?: number;
  note?: string;
}

interface EvidenceSpanViewerProps {
  span: EvidenceSpan | null;
  packId: PackId;
  isOpen: boolean;
  onClose: () => void;
}

export function EvidenceSpanViewer({ span, packId, isOpen, onClose }: EvidenceSpanViewerProps) {
  const [copied, setCopied] = useState(false);
  const { resolvedMode } = useTheme();

  const { data: chunkContent, isLoading } = useEvidenceSpanContent(
    isOpen ? packId : null,
    isOpen ? span?.chunk_ref ?? null : null
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!span) return null;

  const path = chunkContent?.path || span.path;
  const startLine = chunkContent?.start_line || span.start_line || 1;
  const endLine = chunkContent?.end_line || span.end_line;
  const content = chunkContent?.content || "";
  const metadata = (typeof chunkContent?.metadata === "object" && chunkContent?.metadata !== null && !Array.isArray(chunkContent.metadata))
    ? (chunkContent.metadata as Record<string, unknown>)
    : {};
  const isRedacted = chunkContent?.is_redacted || false;

  const language = detectLanguage(path);
  const isMarkdown = isMarkdownContent(path);
  const sourceType = getSourceTypeFromPath(path);
  const sourceLink = buildSourceLink(path, startLine, endLine, { metadata: metadata as Record<string, any> });
  const breadcrumbs = parsePathToBreadcrumbs(path);
  const fileName = getShortFileName(path);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeTheme = resolvedMode === "dark" ? themes.nightOwl : themes.github;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b bg-muted/30">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {isMarkdown ? (
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <DialogTitle className="text-sm font-medium truncate">
                  {fileName}
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {sourceType.icon} {sourceType.type}
                </Badge>
                {isRedacted && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Redacted
                  </Badge>
                )}
              </div>

              {/* Breadcrumb path */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto">
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center">
                    {i > 0 && <span className="mx-1 text-muted-foreground/50">/</span>}
                    <span className={cn(i === breadcrumbs.length - 1 && "text-foreground font-medium")}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </div>

              {/* Line info & chunk ID */}
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                {endLine && <span>Lines {startLine}–{endLine}</span>}
                <span>•</span>
                <span className="font-mono text-[10px]" title="Stable Identifier">
                  {span.stable_chunk_id || "Ephemeral"}
                </span>
                <span>•</span>
                <span className="font-mono text-[10px] opacity-70" title="Database UUID">
                  {span.chunk_pk.split("-")[0]}...
                </span>
                <span>•</span>
                <span className="font-mono text-[10px]">[{span.span_id}]</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <BookmarkButton
                type="code_snippet"
                referenceKey={`${span.stable_chunk_id || span.chunk_pk}:${startLine}-${endLine}`}
                label={fileName}
                subtitle={path}
                previewText={content?.slice(0, 100)}
              />
              {sourceLink && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => window.open(sourceLink, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  View Original
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={handleCopy}
                disabled={!content}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : isMarkdown ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <MarkdownRenderer>{content}</MarkdownRenderer>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Highlight theme={codeTheme} code={content} language={language}>
                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                      className={cn(className, "text-sm overflow-x-auto p-4")}
                      style={{ ...style, margin: 0, background: "transparent" }}
                    >
                      <code>
                        {tokens.map((line, i) => {
                          const lineNumber = startLine + i;
                          const lineProps = getLineProps({ line, key: i });
                          return (
                            <div
                              key={i}
                              {...lineProps}
                              className={cn(lineProps.className, "table-row")}
                            >
                              <span className="table-cell text-right pr-4 select-none text-muted-foreground/50 text-xs w-12">
                                {lineNumber}
                              </span>
                              <span className="table-cell">
                                {line.map((token, key) => (
                                  <span key={key} {...getTokenProps({ token, key })} />
                                ))}
                              </span>
                            </div>
                          );
                        })}
                      </code>
                    </pre>
                  )}
                </Highlight>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer - Citation note */}
        {span.note && (
          <div className="p-3 border-t bg-muted/30">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Why this is relevant:</span>{" "}
              {span.note}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
