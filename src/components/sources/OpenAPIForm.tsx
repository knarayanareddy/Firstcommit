import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface OpenAPIConfig {
  specUrl?: string;
  specContent?: string;
  label: string;
}

interface OpenAPIFormProps {
  onSubmit: (config: OpenAPIConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

export function OpenAPIForm({ onSubmit, onBack, isSubmitting }: OpenAPIFormProps) {
  const [mode, setMode] = useState<"url" | "paste">("url");
  const [specUrl, setSpecUrl] = useState("");
  const [specContent, setSpecContent] = useState("");
  const [label, setLabel] = useState("");

  const canSubmit = label && (mode === "url" ? specUrl : specContent);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-sm">API</div>
        <div>
          <h3 className="font-semibold text-foreground">OpenAPI / Swagger</h3>
          <p className="text-xs text-muted-foreground">API specification files</p>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Label</label>
        <Input placeholder="e.g., Main API" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button variant={mode === "url" ? "default" : "outline"} size="sm" onClick={() => setMode("url")}>URL</Button>
        <Button variant={mode === "paste" ? "default" : "outline"} size="sm" onClick={() => setMode("paste")}>Paste Spec</Button>
      </div>
      {mode === "url" ? (
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Spec URL</label>
          <Input placeholder="https://api.company.com/openapi.json" value={specUrl} onChange={(e) => setSpecUrl(e.target.value)} />
        </div>
      ) : (
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Spec Content (JSON or YAML)</label>
          <Textarea placeholder="Paste your OpenAPI/Swagger spec here..." value={specContent} onChange={(e) => setSpecContent(e.target.value)} rows={8} />
        </div>
      )}
      <Button onClick={() => onSubmit({ specUrl: mode === "url" ? specUrl : undefined, specContent: mode === "paste" ? specContent : undefined, label })} disabled={isSubmitting || !canSubmit} className="w-full gap-2">
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Add & Ingest
      </Button>
    </div>
  );
}
