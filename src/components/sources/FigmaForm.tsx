import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export interface FigmaConfig {
  fileUrl: string;
  fileKey: string;
  personalAccessToken: string;
  includeComponents: boolean;
  includeComments: boolean;
  includeLayerStructure: boolean;
}

interface FigmaFormProps {
  onSubmit: (config: FigmaConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

function extractFileKey(input: string): string {
  const match = input.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  return match ? match[1] : input;
}

export function FigmaForm({ onSubmit, onBack, isSubmitting }: FigmaFormProps) {
  const [fileUrl, setFileUrl] = useState("");
  const [personalAccessToken, setPersonalAccessToken] = useState("");
  const [includeComponents, setIncludeComponents] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [includeLayerStructure, setIncludeLayerStructure] = useState(false);

  const fileKey = extractFileKey(fileUrl);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-sm">F</div>
        <div>
          <h3 className="font-semibold text-foreground">Figma</h3>
          <p className="text-xs text-muted-foreground">Design files & components</p>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">File URL or Key</label>
        <Input placeholder="https://figma.com/file/abc123/Design or abc123" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
        {fileKey && fileKey !== fileUrl && <p className="text-xs text-muted-foreground mt-1">File key: {fileKey}</p>}
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Personal Access Token</label>
        <Input type="password" placeholder="figd_..." value={personalAccessToken} onChange={(e) => setPersonalAccessToken(e.target.value)} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2"><Checkbox checked={includeComponents} onCheckedChange={(v) => setIncludeComponents(!!v)} /><span className="text-sm">Include component descriptions</span></div>
        <div className="flex items-center gap-2"><Checkbox checked={includeComments} onCheckedChange={(v) => setIncludeComments(!!v)} /><span className="text-sm">Include comments</span></div>
        <div className="flex items-center gap-2"><Checkbox checked={includeLayerStructure} onCheckedChange={(v) => setIncludeLayerStructure(!!v)} /><span className="text-sm">Include detailed layer structure</span></div>
      </div>
      <p className="text-xs text-muted-foreground">Create a token at <a href="https://www.figma.com/developers/api#access-tokens" target="_blank" rel="noopener noreferrer" className="underline">figma.com/developers/api</a></p>
      <Button onClick={() => onSubmit({ fileUrl, fileKey, personalAccessToken, includeComponents, includeComments, includeLayerStructure })} disabled={isSubmitting || !fileKey || !personalAccessToken} className="w-full gap-2">
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Add & Ingest
      </Button>
    </div>
  );
}
