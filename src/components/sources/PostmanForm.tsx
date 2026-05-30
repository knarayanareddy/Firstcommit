import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface PostmanConfig {
  collectionJson?: string;
  collectionUrl?: string;
  postmanApiKey?: string;
  label: string;
}

interface PostmanFormProps {
  onSubmit: (config: PostmanConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

export function PostmanForm({ onSubmit, onBack, isSubmitting }: PostmanFormProps) {
  const [mode, setMode] = useState<"paste" | "api">("paste");
  const [collectionJson, setCollectionJson] = useState("");
  const [collectionUrl, setCollectionUrl] = useState("");
  const [postmanApiKey, setPostmanApiKey] = useState("");
  const [label, setLabel] = useState("");

  const canSubmit = label && (mode === "paste" ? collectionJson : collectionUrl && postmanApiKey);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-sm">PM</div>
        <div>
          <h3 className="font-semibold text-foreground">Postman Collection</h3>
          <p className="text-xs text-muted-foreground">API request collections</p>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Label</label>
        <Input placeholder="e.g., Backend API Collection" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button variant={mode === "paste" ? "default" : "outline"} size="sm" onClick={() => setMode("paste")}>Paste JSON</Button>
        <Button variant={mode === "api" ? "default" : "outline"} size="sm" onClick={() => setMode("api")}>Postman API</Button>
      </div>
      {mode === "paste" ? (
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Collection JSON</label>
          <Textarea placeholder="Paste exported Postman collection JSON..." value={collectionJson} onChange={(e) => setCollectionJson(e.target.value)} rows={8} />
        </div>
      ) : (
        <>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Collection URL or ID</label>
            <Input placeholder="Collection ID or URL" value={collectionUrl} onChange={(e) => setCollectionUrl(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Postman API Key</label>
            <Input type="password" placeholder="PMAK-..." value={postmanApiKey} onChange={(e) => setPostmanApiKey(e.target.value)} />
          </div>
        </>
      )}
      <Button onClick={() => onSubmit({ collectionJson: mode === "paste" ? collectionJson : undefined, collectionUrl: mode === "api" ? collectionUrl : undefined, postmanApiKey: mode === "api" ? postmanApiKey : undefined, label })} disabled={isSubmitting || !canSubmit} className="w-full gap-2">
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Add & Ingest
      </Button>
    </div>
  );
}
