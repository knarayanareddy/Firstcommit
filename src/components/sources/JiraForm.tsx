import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export interface JiraConfig {
  baseUrl: string;
  projectKey: string;
  authEmail: string;
  apiToken: string;
  maxIssues: number;
  includeEpics: boolean;
  includeRecent: boolean;
  includeComments: boolean;
  includeResolved: boolean;
}

interface JiraFormProps {
  onSubmit: (config: JiraConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

export function JiraForm({ onSubmit, onBack, isSubmitting }: JiraFormProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [maxIssues, setMaxIssues] = useState(200);
  const [includeEpics, setIncludeEpics] = useState(true);
  const [includeRecent, setIncludeRecent] = useState(true);
  const [includeComments, setIncludeComments] = useState(false);
  const [includeResolved, setIncludeResolved] = useState(false);

  const handleSubmit = () => {
    onSubmit({ baseUrl, projectKey, authEmail, apiToken, maxIssues, includeEpics, includeRecent, includeComments, includeResolved });
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">J</div>
        <div>
          <h3 className="font-semibold text-foreground">Jira</h3>
          <p className="text-xs text-muted-foreground">Issues, epics & workflows</p>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Base URL</label>
        <Input placeholder="https://company.atlassian.net" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Project Key</label>
        <Input placeholder="ENG" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
        <Input placeholder="admin@company.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">API Token</label>
        <Input type="password" placeholder="Your Jira API token" value={apiToken} onChange={(e) => setApiToken(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Max Issues</label>
        <Input type="number" value={maxIssues} onChange={(e) => setMaxIssues(Number(e.target.value))} min={10} max={500} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2"><Checkbox checked={includeEpics} onCheckedChange={(v) => setIncludeEpics(!!v)} /><span className="text-sm">Include epics and structure</span></div>
        <div className="flex items-center gap-2"><Checkbox checked={includeRecent} onCheckedChange={(v) => setIncludeRecent(!!v)} /><span className="text-sm">Include recent issues (last 30 days)</span></div>
        <div className="flex items-center gap-2"><Checkbox checked={includeComments} onCheckedChange={(v) => setIncludeComments(!!v)} /><span className="text-sm">Include comments</span></div>
        <div className="flex items-center gap-2"><Checkbox checked={includeResolved} onCheckedChange={(v) => setIncludeResolved(!!v)} /><span className="text-sm">Include resolved/closed issues</span></div>
      </div>
      <p className="text-xs text-muted-foreground">Generate an API token at <a href="https://id.atlassian.com/manage-profile/security" target="_blank" rel="noopener noreferrer" className="underline">id.atlassian.com</a></p>
      <Button onClick={handleSubmit} disabled={isSubmitting || !baseUrl || !projectKey || !authEmail || !apiToken} className="w-full gap-2">
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Add & Ingest
      </Button>
    </div>
  );
}
