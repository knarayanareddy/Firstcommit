import { useState } from "react";
import { ArrowLeft, FileText, Upload, Globe, ClipboardPaste, Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { FileUploadZone } from "@/components/FileUploadZone";
import { extractText, type ExtractionResult, formatFileSize } from "@/lib/file-extractors";
import { motion, AnimatePresence } from "framer-motion";

interface DocumentFormProps {
  onSubmitDocument: (content: string, label: string, storagePaths?: string[]) => Promise<void>;
  onSubmitUrl: (config: UrlImportConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

export interface UrlImportConfig {
  url: string;
  crawlMode: "single" | "crawl";
  maxDepth: number;
  maxPages: number;
  followInternalOnly: boolean;
  includePdfs: boolean;
  label: string;
}

type FileProcessingState = {
  file: File;
  status: "pending" | "processing" | "done" | "error";
  result?: ExtractionResult;
  error?: string;
};

export function DocumentForm({ onSubmitDocument, onSubmitUrl, onBack, isSubmitting }: DocumentFormProps) {
  const [tab, setTab] = useState("upload");

  // Upload tab state
  const [files, setFiles] = useState<File[]>([]);
  const [uploadLabel, setUploadLabel] = useState("");
  const [processing, setProcessing] = useState(false);
  const [fileStates, setFileStates] = useState<FileProcessingState[]>([]);
  const [processedTexts, setProcessedTexts] = useState<{ name: string; text: string }[]>([]);

  // URL tab state
  const [url, setUrl] = useState("");
  const [urlLabel, setUrlLabel] = useState("");
  const [crawlMode, setCrawlMode] = useState<"single" | "crawl">("single");
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(50);
  const [followInternalOnly, setFollowInternalOnly] = useState(true);
  const [includePdfs, setIncludePdfs] = useState(false);

  // Paste tab state
  const [pasteLabel, setPasteLabel] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [pasteFormat, setPasteFormat] = useState("markdown");

  const processFiles = async () => {
    setProcessing(true);
    const states: FileProcessingState[] = files.map((f) => ({ file: f, status: "pending" as const }));
    setFileStates(states);
    const results: { name: string; text: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      setFileStates((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: "processing" } : s))
      );

      try {
        const result = await extractText(files[i]);
        results.push({ name: files[i].name, text: result.text });
        setFileStates((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "done", result } : s))
        );
      } catch (err: any) {
        setFileStates((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "error", error: err.message } : s
          )
        );
      }
    }

    setProcessedTexts(results);
    setProcessing(false);
  };

  const handleUploadSubmit = async () => {
    if (processedTexts.length === 0) {
      // Need to process first
      await processFiles();
      return;
    }

    // Combine all extracted text with file separators
    const combined = processedTexts
      .map((r) => `=== FILE: ${r.name} ===\n\n${r.text}`)
      .join("\n\n---\n\n");

    const lbl = uploadLabel || files.map((f) => f.name).join(", ");
    await onSubmitDocument(combined, lbl);
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) return;
    await onSubmitUrl({
      url: url.trim(),
      crawlMode,
      maxDepth,
      maxPages,
      followInternalOnly,
      includePdfs,
      label: urlLabel || new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`).hostname,
    });
  };

  const handlePasteSubmit = async () => {
    if (!pasteContent.trim()) return;
    await onSubmitDocument(pasteContent, pasteLabel || "Pasted Document");
  };

  const processedCount = fileStates.filter((s) => s.status === "done").length;
  const errorCount = fileStates.filter((s) => s.status === "error").length;
  const totalWarnings = fileStates
    .filter((s) => s.result)
    .flatMap((s) => s.result!.metadata.extractionWarnings);
  const progress = fileStates.length > 0 ? ((processedCount + errorCount) / fileStates.length) * 100 : 0;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center gap-2 mb-2">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Add Document Source</h3>
          <p className="text-xs text-muted-foreground">Upload files, import from URL, or paste content</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="upload" className="flex-1 gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" />
            Upload Files
          </TabsTrigger>
          <TabsTrigger value="url" className="flex-1 gap-1.5 text-xs">
            <Globe className="w-3.5 h-3.5" />
            Import URL
          </TabsTrigger>
          <TabsTrigger value="paste" className="flex-1 gap-1.5 text-xs">
            <ClipboardPaste className="w-3.5 h-3.5" />
            Paste Text
          </TabsTrigger>
        </TabsList>

        {/* ─── UPLOAD TAB ─── */}
        <TabsContent value="upload" className="space-y-4 mt-4">
          {fileStates.length === 0 ? (
            <>
              <FileUploadZone files={files} onFilesChange={setFiles} />
              {files.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Label (optional)
                  </label>
                  <Input
                    placeholder="e.g., Engineering Documentation"
                    value={uploadLabel}
                    onChange={(e) => setUploadLabel(e.target.value)}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={onBack} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleUploadSubmit}
                  disabled={files.length === 0 || isSubmitting}
                  className="flex-1 gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Upload & Ingest ({files.length})
                </Button>
              </div>
            </>
          ) : (
            /* Processing / Results View */
            <div className="space-y-3">
              <div className="space-y-2">
                {fileStates.map((fs, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md bg-muted/30"
                  >
                    {fs.status === "done" && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    {fs.status === "processing" && <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />}
                    {fs.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />}
                    {fs.status === "error" && <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />}
                    <span className="truncate text-foreground">{fs.file.name}</span>
                    {fs.result && (
                      <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                        {fs.result.metadata.pageCount
                          ? `${fs.result.metadata.pageCount} pages, `
                          : ""}
                        {fs.result.text.split(/\s+/).length.toLocaleString()} words
                      </span>
                    )}
                    {fs.error && (
                      <span className="text-xs text-destructive ml-auto flex-shrink-0">{fs.error}</span>
                    )}
                  </div>
                ))}
              </div>

              {processing && (
                <div className="space-y-1">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Processing {processedCount + errorCount}/{fileStates.length} files
                  </p>
                </div>
              )}

              <AnimatePresence>
                {totalWarnings.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="bg-accent/50 border border-accent rounded-lg p-3"
                  >
                    <p className="text-xs font-medium text-accent-foreground flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Warnings
                    </p>
                    {totalWarnings.map((w, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {w}</p>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {!processing && processedTexts.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFileStates([]);
                      setProcessedTexts([]);
                    }}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={async () => {
                      const combined = processedTexts
                        .map((r) => `=== FILE: ${r.name} ===\n\n${r.text}`)
                        .join("\n\n---\n\n");
                      const lbl = uploadLabel || files.map((f) => f.name).join(", ");
                      await onSubmitDocument(combined, lbl);
                    }}
                    disabled={isSubmitting}
                    className="flex-1 gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Ingest {processedTexts.length} file{processedTexts.length > 1 ? "s" : ""}
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── URL TAB ─── */}
        <TabsContent value="url" className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">URL</label>
            <Input
              placeholder="https://docs.company.com/architecture"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Import mode</label>
            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="crawlMode"
                  checked={crawlMode === "single"}
                  onChange={() => setCrawlMode("single")}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm text-foreground">Single page</p>
                  <p className="text-xs text-muted-foreground">Import just this URL</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="crawlMode"
                  checked={crawlMode === "crawl"}
                  onChange={() => setCrawlMode("crawl")}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm text-foreground">Crawl site</p>
                  <p className="text-xs text-muted-foreground">Follow links and import connected pages</p>
                </div>
              </label>
            </div>
          </div>

          {crawlMode === "crawl" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Max depth</label>
                <Select value={String(maxDepth)} onValueChange={(v) => setMaxDepth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Max pages</label>
                <Select value={String(maxPages)} onValueChange={(v) => setMaxPages(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100, 200].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 col-span-2 text-sm">
                <input
                  type="checkbox"
                  checked={followInternalOnly}
                  onChange={(e) => setFollowInternalOnly(e.target.checked)}
                />
                <span className="text-xs text-foreground">Follow internal links only (same domain)</span>
              </label>
              <label className="flex items-center gap-2 col-span-2 text-sm">
                <input
                  type="checkbox"
                  checked={includePdfs}
                  onChange={(e) => setIncludePdfs(e.target.checked)}
                />
                <span className="text-xs text-foreground">Include linked PDFs</span>
              </label>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Label (optional)</label>
            <Input
              placeholder="e.g., Architecture Docs Site"
              value={urlLabel}
              onChange={(e) => setUrlLabel(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleUrlSubmit}
              disabled={!url.trim() || isSubmitting}
              className="flex-1 gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Import
            </Button>
          </div>
        </TabsContent>

        {/* ─── PASTE TAB ─── */}
        <TabsContent value="paste" className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Label</label>
            <Input
              placeholder="e.g., Quick Notes"
              value={pasteLabel}
              onChange={(e) => setPasteLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Format</label>
            <Select value={pasteFormat} onValueChange={setPasteFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="plaintext">Plain Text</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Textarea
              placeholder="Paste your content here..."
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              rows={8}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handlePasteSubmit}
              disabled={!pasteContent.trim() || isSubmitting}
              className="flex-1 gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Source
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
