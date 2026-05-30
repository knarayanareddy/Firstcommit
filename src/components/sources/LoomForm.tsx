import { useState } from "react";
import { ArrowLeft, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface LoomConfig {
  apiKey?: string;
  workspaceId?: string;
  videoTitle?: string;
  videoUrl?: string;
  transcriptContent?: string;
}

interface LoomFormProps {
  onSubmit: (config: LoomConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

export function LoomForm({ onSubmit, onBack, isSubmitting }: LoomFormProps) {
  const [mode, setMode] = useState<"api" | "upload">("upload");
  const [apiKey, setApiKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [transcriptContent, setTranscriptContent] = useState("");

  const canSubmit = mode === "api" ? apiKey : (videoTitle && transcriptContent);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
          <Video className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Loom / Video Transcripts</h3>
          <p className="text-xs text-muted-foreground">Import video content</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant={mode === "api" ? "default" : "outline"} size="sm" onClick={() => setMode("api")}>Loom API</Button>
        <Button variant={mode === "upload" ? "default" : "outline"} size="sm" onClick={() => setMode("upload")}>Upload Transcript</Button>
      </div>

      {mode === "api" ? (
        <>
          <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 rounded-lg text-sm border border-amber-500/20">
            <strong>⚠️ Limited API availability</strong>
            <p className="mt-1 text-xs opacity-90">
              The Loom public API has limited availability and may not work reliably.
              For guaranteed ingestion, use the <strong>Upload Transcript</strong> tab and paste your transcript text directly.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Loom API Key</label>
            <Input type="password" placeholder="Your Loom API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Workspace ID (optional)</label>
            <Input placeholder="Filter by workspace" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from <a href="https://www.loom.com/developer/apps" target="_blank" rel="noopener noreferrer" className="underline">loom.com/developer/apps</a>
          </p>
        </>
      ) : (
        <>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Video Title</label>
            <Input placeholder="Architecture Walkthrough" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Video URL (optional)</label>
            <Input placeholder="https://loom.com/share/abc123" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Transcript (.srt, .vtt, or plain text)</label>
            <Textarea 
              placeholder="Paste transcript here...&#10;&#10;Supports SRT, VTT, or plain text format" 
              value={transcriptContent} 
              onChange={(e) => setTranscriptContent(e.target.value)} 
              rows={8} 
            />
          </div>
        </>
      )}

      <Button 
        onClick={() => onSubmit({ 
          apiKey: mode === "api" ? apiKey : undefined, 
          workspaceId: mode === "api" ? workspaceId : undefined,
          videoTitle: mode === "upload" ? videoTitle : undefined,
          videoUrl: mode === "upload" ? videoUrl : undefined,
          transcriptContent: mode === "upload" ? transcriptContent : undefined,
        })} 
        disabled={isSubmitting || !canSubmit} 
        className="w-full gap-2"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Add & Ingest
      </Button>
    </div>
  );
}
