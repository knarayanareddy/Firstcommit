import { useState, useMemo, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Highlight, themes } from "prism-react-renderer";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
  X,
  Code,
  MessageSquare,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { detectLanguage, isMarkdownContent, getSourceTypeFromPath } from "@/lib/language-detect";
import { buildSourceLink } from "@/lib/source-link-builder";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  useCodeExplorer,
  getMergedFileContent,
  type FileNode,
  type Citation,
} from "@/hooks/useCodeExplorer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CodeExplorerProps {
  packId: string;
  moduleTitle: string;
  moduleData: any;
  isOpen: boolean;
  onClose: () => void;
}

// Annotation colors
const ANNOTATION_COLORS = [
  { bg: "bg-blue-500/20", border: "border-blue-500/40", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  { bg: "bg-amber-500/20", border: "border-amber-500/40", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  { bg: "bg-purple-500/20", border: "border-purple-500/40", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
  { bg: "bg-rose-500/20", border: "border-rose-500/40", text: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500" },
  { bg: "bg-cyan-500/20", border: "border-cyan-500/40", text: "text-cyan-600 dark:text-cyan-400", dot: "bg-cyan-500" },
];

function getFileIcon(name: string, isOpen?: boolean) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "ts" || ext === "tsx") return <FileCode className="h-4 w-4 text-blue-500" />;
  if (ext === "js" || ext === "jsx") return <FileCode className="h-4 w-4 text-yellow-500" />;
  if (ext === "py") return <FileCode className="h-4 w-4 text-green-500" />;
  if (ext === "go") return <FileCode className="h-4 w-4 text-cyan-500" />;
  if (ext === "rs") return <FileCode className="h-4 w-4 text-orange-500" />;
  if (ext === "md" || ext === "mdx") return <FileText className="h-4 w-4 text-muted-foreground" />;
  if (ext === "json" || ext === "yaml" || ext === "yml") return <FileCode className="h-4 w-4 text-purple-500" />;
  return <FileCode className="h-4 w-4 text-muted-foreground" />;
}

// File tree node component
function FileTreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
  expandedDirs,
  onToggleDir,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string, chunkIds: string[]) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
}) {
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = selectedPath === node.path;

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => onToggleDir(node.path)}
          className={cn(
            "w-full flex items-center gap-1.5 py-1 px-2 text-sm hover:bg-muted/50 rounded transition-colors",
            "text-left"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-amber-500 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node.path, node.chunkIds)}
      className={cn(
        "w-full flex items-center gap-1.5 py-1 px-2 text-sm rounded transition-colors",
        "text-left",
        isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      {getFileIcon(node.name)}
      <span className="truncate flex-1">{node.name}</span>
      {node.hasAnnotations && (
        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
      )}
    </button>
  );
}

export function CodeExplorer({ packId, moduleTitle, moduleData, isOpen, onClose }: CodeExplorerProps) {
  const { resolvedMode } = useTheme();
  const isMobile = useIsMobile();
  const codeRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAnnotations, setShowAnnotations] = useState(true);

  // File tree state
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Fetch code explorer data
  const { data: explorerData, isLoading } = useCodeExplorer(packId, moduleData, isOpen);

  // Auto-select first file when data loads
  useEffect(() => {
    if (explorerData && explorerData.flatFiles.length > 0 && !selectedPath) {
      const firstFile = explorerData.flatFiles[0];
      setSelectedPath(firstFile.path);
      setSelectedChunkIds(firstFile.chunkIds);

      // Expand parent directories
      const colonIndex = firstFile.path.indexOf(":");
      const cleanPath = colonIndex !== -1 ? firstFile.path.slice(colonIndex + 1) : firstFile.path;
      const parts = cleanPath.split("/");
      const newExpanded = new Set<string>();
      for (let i = 1; i < parts.length; i++) {
        newExpanded.add(parts.slice(0, i).join("/"));
      }
      setExpandedDirs(newExpanded);
    }
  }, [explorerData, selectedPath]);

  // Get merged content for selected file
  const fileContent = useMemo(() => {
    if (!explorerData || selectedChunkIds.length === 0) {
      return { content: "", startLine: 1, annotations: [] };
    }
    return getMergedFileContent(explorerData.chunks, selectedChunkIds);
  }, [explorerData, selectedChunkIds]);

  // Assign colors to annotations
  const coloredAnnotations = useMemo(() => {
    return fileContent.annotations.map((ann, i) => ({
      ...ann,
      color: ANNOTATION_COLORS[i % ANNOTATION_COLORS.length],
    }));
  }, [fileContent.annotations]);

  // Build a map of line -> annotation for highlighting
  const lineAnnotationMap = useMemo(() => {
    const map = new Map<number, typeof coloredAnnotations[0]>();
    for (const ann of coloredAnnotations) {
      for (let line = ann.startLine; line <= ann.endLine; line++) {
        if (!map.has(line)) {
          map.set(line, ann);
        }
      }
    }
    return map;
  }, [coloredAnnotations]);

  const handleSelectFile = (path: string, chunkIds: string[]) => {
    setSelectedPath(path);
    setSelectedChunkIds(chunkIds);
  };

  const handleToggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fileContent.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToLine = (line: number) => {
    if (codeRef.current) {
      const lineElement = codeRef.current.querySelector(`[data-line="${line}"]`);
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  // Detect language and build source link
  const language = selectedPath ? detectLanguage(selectedPath) : "text";
  const isMarkdown = selectedPath ? isMarkdownContent(selectedPath) : false;
  const sourceType = selectedPath ? getSourceTypeFromPath(selectedPath) : null;

  const firstChunk = selectedChunkIds.length > 0 ? explorerData?.chunks.get(selectedChunkIds[0]) : null;
  const sourceLink = selectedPath && firstChunk
    ? buildSourceLink(selectedPath, firstChunk.start_line, firstChunk.end_line, { metadata: firstChunk.metadata || {} })
    : null;

  const codeTheme = resolvedMode === "dark" ? themes.nightOwl : themes.github;

  // Mobile file selector
  const mobileFileOptions = explorerData?.flatFiles.map((f) => ({
    value: f.path,
    label: f.path.split("/").pop() || f.path,
    chunkIds: f.chunkIds,
  })) || [];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-4xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              <SheetTitle className="text-base">
                Code Explorer — {moduleTitle}
              </SheetTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading source files...</p>
            </div>
          </div>
        ) : !explorerData || explorerData.flatFiles.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <FileCode className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No source files found for this module</p>
            </div>
          </div>
        ) : (
          <div className={cn("flex-1 flex min-h-0", isMobile ? "flex-col" : "flex-row")}>
            {/* File Tree (Desktop) / Dropdown (Mobile) */}
            {isMobile ? (
              <div className="p-3 border-b shrink-0">
                <Select
                  value={selectedPath || ""}
                  onValueChange={(value) => {
                    const file = mobileFileOptions.find((f) => f.value === value);
                    if (file) handleSelectFile(file.value, file.chunkIds);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a file..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mobileFileOptions.map((file) => (
                      <SelectItem key={file.value} value={file.value}>
                        {file.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="w-64 border-r flex flex-col shrink-0">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="py-2">
                    {explorerData.files.map((node) => (
                      <FileTreeNode
                        key={node.path}
                        node={node}
                        depth={0}
                        selectedPath={selectedPath}
                        onSelect={handleSelectFile}
                        expandedDirs={expandedDirs}
                        onToggleDir={handleToggleDir}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Code Viewer */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* File header */}
              {selectedPath && (
                <div className="p-3 border-b flex items-center justify-between gap-3 shrink-0 bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileIcon(selectedPath.split("/").pop() || "")}
                    <span className="text-sm font-mono truncate">{selectedPath.split("/").pop()}</span>
                    {sourceType && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {sourceType.icon} {sourceType.type}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleCopy}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                    {sourceLink && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => window.open(sourceLink, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="hidden sm:inline">View Original</span>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Code content */}
              <ScrollArea className="flex-1">
                <div ref={codeRef} className="p-4">
                  {isMarkdown ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <MarkdownRenderer>{fileContent.content}</MarkdownRenderer>
                    </div>
                  ) : (
                    <Highlight theme={codeTheme} code={fileContent.content} language={language}>
                      {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                          className={cn(className, "text-sm overflow-x-auto")}
                          style={{ ...style, margin: 0, background: "transparent" }}
                        >
                          <code>
                            {tokens.map((line, i) => {
                              const lineNumber = fileContent.startLine + i;
                              const annotation = lineAnnotationMap.get(lineNumber);
                              const lineProps = getLineProps({ line, key: i });

                              return (
                                <div
                                  key={i}
                                  {...lineProps}
                                  data-line={lineNumber}
                                  className={cn(
                                    lineProps.className,
                                    "table-row",
                                    annotation && annotation.color.bg
                                  )}
                                >
                                  <span className="table-cell text-right pr-4 select-none text-muted-foreground/50 text-xs w-12 sticky left-0 bg-inherit">
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
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Annotations Panel (Desktop only) */}
            {!isMobile && coloredAnnotations.length > 0 && showAnnotations && (
              <div className="w-64 border-l flex flex-col shrink-0">
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Annotations</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {coloredAnnotations.length}
                  </Badge>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-2">
                    {coloredAnnotations.map((ann, i) => (
                      <button
                        key={i}
                        onClick={() => scrollToLine(ann.startLine)}
                        className={cn(
                          "w-full text-left p-2 rounded-md border transition-colors",
                          ann.color.border,
                          ann.color.bg,
                          "hover:opacity-80"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", ann.color.dot)} />
                          <span className={cn("text-xs font-mono", ann.color.text)}>
                            L{ann.startLine}–{ann.endLine}
                          </span>
                        </div>
                        {ann.citation.section_heading && (
                          <p className="text-xs text-muted-foreground mb-1">
                            From: {ann.citation.section_heading}
                          </p>
                        )}
                        {ann.citation.note && (
                          <p className="text-xs text-foreground/80 line-clamp-2">
                            {ann.citation.note}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* Mobile annotations toggle */}
        {isMobile && coloredAnnotations.length > 0 && (
          <div className="border-t p-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-2"
              onClick={() => setShowAnnotations(!showAnnotations)}
            >
              <MessageSquare className="h-3 w-3" />
              {showAnnotations ? "Hide" : "Show"} {coloredAnnotations.length} Annotations
            </Button>
            {showAnnotations && (
              <ScrollArea className="max-h-40 mt-2">
                <div className="space-y-1">
                  {coloredAnnotations.map((ann, i) => (
                    <button
                      key={i}
                      onClick={() => scrollToLine(ann.startLine)}
                      className={cn(
                        "w-full text-left p-2 rounded-md text-xs",
                        ann.color.bg
                      )}
                    >
                      <span className={cn("font-mono", ann.color.text)}>
                        L{ann.startLine}–{ann.endLine}
                      </span>
                      {ann.citation.note && (
                        <span className="text-muted-foreground ml-2 truncate">
                          {ann.citation.note}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
