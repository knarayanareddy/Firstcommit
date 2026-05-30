import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface LinearConfig {
  apiKey: string;
  teamId: string;
}

interface LinearFormProps {
  onSubmit: (config: LinearConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

export function LinearForm({ onSubmit, onBack, isSubmitting }: LinearFormProps) {
  const [apiKey, setApiKey] = useState("");
  const [teamId, setTeamId] = useState("");

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">L</div>
        <div>
          <h3 className="font-semibold text-foreground">Linear</h3>
          <p className="text-xs text-muted-foreground">Issues, projects & cycles</p>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">API Key</label>
        <Input type="password" placeholder="lin_api_..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Team ID</label>
        <Input placeholder="Team UUID or identifier" value={teamId} onChange={(e) => setTeamId(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">Create an API key at <a href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer" className="underline">linear.app/settings/api</a></p>
      <Button onClick={() => onSubmit({ apiKey, teamId })} disabled={isSubmitting || !apiKey || !teamId} className="w-full gap-2">
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Add & Ingest
      </Button>
    </div>
  );
}
