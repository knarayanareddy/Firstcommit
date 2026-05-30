import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, Plus, Trash2, Loader2, AlertTriangle, Github, FileText, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePack } from "@/hooks/usePack";
import { useIngestion } from "@/hooks/useIngestion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface BulkSource {
  id: string;
  type: string;
  uri: string;
  label: string;
}

interface BulkImportModalProps {
  existingUris: string[];
}

export function BulkImportModal({ existingUris }: BulkImportModalProps) {
  const { currentPackId } = usePack();
  const { triggerIngestion } = useIngestion();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<BulkSource[]>([
    { id: crypto.randomUUID(), type: "github_repo", uri: "", label: "" },
  ]);
  const [configJson, setConfigJson] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [duplicates, setDuplicates] = useState<string[]>([]);

  const addRow = () => {
    setSources(prev => [...prev, { id: crypto.randomUUID(), type: "github_repo", uri: "", label: "" }]);
  };

  const removeRow = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const updateRow = (id: string, field: keyof BulkSource, value: string) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "github_repo": return <Github className="w-3.5 h-3.5" />;
      case "document": return <FileText className="w-3.5 h-3.5" />;
      case "url": return <Globe className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const parseConfig = (): BulkSource[] => {
    try {
      const parsed = JSON.parse(configJson);
      const arr = Array.isArray(parsed) ? parsed : parsed.sources;
      if (!Array.isArray(arr)) throw new Error("Expected array");
      return arr.map((s: any) => ({
        id: crypto.randomUUID(),
        type: s.type || s.source_type || "github_repo",
        uri: s.uri || s.source_uri || s.url || "",
        label: s.label || s.name || "",
      }));
    } catch {
      toast.error("Invalid JSON. Expected an array of { type, uri, label }");
      return [];
    }
  };

  const importSources = async (toImport: BulkSource[]) => {
    const valid = toImport.filter(s => s.uri.trim());
    if (valid.length === 0) {
      toast.error("No valid sources to import");
      return;
    }

    // Check duplicates
    const dupes = valid.filter(s => existingUris.includes(s.uri.trim()));
    setDuplicates(dupes.map(d => d.uri));
    const unique = valid.filter(s => !existingUris.includes(s.uri.trim()));

    if (unique.length === 0) {
      toast.warning("All sources already exist in this pack");
      return;
    }

    setImporting(true);
    setTotal(unique.length);
    setProgress(0);

    let success = 0;
    for (const source of unique) {
      try {
        const { data, error } = await supabase
          .from("pack_sources")
          .insert({
            pack_id: currentPackId,
            source_type: source.type,
            source_uri: source.uri.trim(),
            label: source.label || null,
          })
          .select()
          .single();
        if (error) throw error;

        // Auto-trigger ingestion
        await triggerIngestion.mutateAsync({
          sourceId: data.id,
          sourceType: source.type,
          sourceUri: source.uri.trim(),
          label: source.label || undefined,
        });
        success++;
      } catch (err: any) {
        console.error(`Failed to import ${source.uri}:`, err.message);
      }
      setProgress(prev => prev + 1);
    }

    queryClient.invalidateQueries({ queryKey: ["pack_sources", currentPackId] });
    setImporting(false);
    toast.success(`Imported ${success}/${unique.length} sources${dupes.length > 0 ? ` (${dupes.length} duplicates skipped)` : ""}`);
    if (success > 0) {
      setOpen(false);
      setSources([{ id: crypto.randomUUID(), type: "github_repo", uri: "", label: "" }]);
      setConfigJson("");
      setDuplicates([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Sources</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="form" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="json">JSON Config</TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="space-y-3 mt-3">
            {sources.map((source, i) => (
              <div key={source.id} className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg border border-border/50">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Select value={source.type} onValueChange={(v) => updateRow(source.id, "type", v)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="github_repo">
                          <span className="flex items-center gap-1.5">{typeIcon("github_repo")} GitHub</span>
                        </SelectItem>
                        <SelectItem value="url">
                          <span className="flex items-center gap-1.5">{typeIcon("url")} URL</span>
                        </SelectItem>
                        <SelectItem value="document">
                          <span className="flex items-center gap-1.5">{typeIcon("document")} Document</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Label (optional)"
                      value={source.label}
                      onChange={(e) => updateRow(source.id, "label", e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <Input
                    placeholder={source.type === "github_repo" ? "https://github.com/org/repo" : "https://..."}
                    value={source.uri}
                    onChange={(e) => updateRow(source.id, "uri", e.target.value)}
                  />
                  {duplicates.includes(source.uri.trim()) && (
                    <p className="text-xs text-yellow-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Already exists
                    </p>
                  )}
                </div>
                {sources.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-1" onClick={() => removeRow(source.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}

            <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={addRow}>
              <Plus className="w-3.5 h-3.5" /> Add Another
            </Button>

            {importing && (
              <div className="space-y-1">
                <Progress value={(progress / total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{progress}/{total} imported</p>
              </div>
            )}

            <Button
              className="w-full gap-2"
              disabled={importing || sources.every(s => !s.uri.trim())}
              onClick={() => importSources(sources)}
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? "Importing..." : `Import ${sources.filter(s => s.uri.trim()).length} Source(s)`}
            </Button>
          </TabsContent>

          <TabsContent value="json" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Paste a JSON array of sources. Each object needs <code>type</code>, <code>uri</code>, and optionally <code>label</code>.
            </p>
            <Textarea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              placeholder={`[\n  { "type": "github_repo", "uri": "https://github.com/org/repo", "label": "API" },\n  { "type": "url", "uri": "https://docs.example.com", "label": "Docs" }\n]`}
              rows={8}
              className="font-mono text-xs"
            />

            {importing && (
              <div className="space-y-1">
                <Progress value={(progress / total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{progress}/{total} imported</p>
              </div>
            )}

            <Button
              className="w-full gap-2"
              disabled={importing || !configJson.trim()}
              onClick={() => {
                const parsed = parseConfig();
                if (parsed.length > 0) importSources(parsed);
              }}
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? "Importing..." : "Parse & Import"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
