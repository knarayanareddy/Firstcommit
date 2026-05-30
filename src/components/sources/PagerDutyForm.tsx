import { useState } from "react";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export interface PagerDutyConfig {
  apiKey: string;
  serviceIds: string[];
  includeServices: boolean;
  includeOncall: boolean;
  includeIncidents: boolean;
  fetchRunbooks: boolean;
}

interface PagerDutyFormProps {
  onSubmit: (config: PagerDutyConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

export function PagerDutyForm({ onSubmit, onBack, isSubmitting }: PagerDutyFormProps) {
  const [apiKey, setApiKey] = useState("");
  const [serviceIdsInput, setServiceIdsInput] = useState("");
  const [includeServices, setIncludeServices] = useState(true);
  const [includeOncall, setIncludeOncall] = useState(true);
  const [includeIncidents, setIncludeIncidents] = useState(true);
  const [fetchRunbooks, setFetchRunbooks] = useState(false);

  const serviceIds = serviceIdsInput.split(",").map(s => s.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">PagerDuty</h3>
          <p className="text-xs text-muted-foreground">Services & on-call structure</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">API Key</label>
        <Input type="password" placeholder="Your PagerDuty API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Service IDs (optional, comma-separated)</label>
        <Input placeholder="Leave empty to fetch all services" value={serviceIdsInput} onChange={(e) => setServiceIdsInput(e.target.value)} />
        <p className="text-xs text-muted-foreground mt-1">Filter to specific services, or leave empty for all</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox checked={includeServices} onCheckedChange={(v) => setIncludeServices(!!v)} />
          <span className="text-sm">Services & escalation policies</span>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={includeOncall} onCheckedChange={(v) => setIncludeOncall(!!v)} />
          <span className="text-sm">On-call schedules</span>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={includeIncidents} onCheckedChange={(v) => setIncludeIncidents(!!v)} />
          <span className="text-sm">Recent incident patterns (last 30 days)</span>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={fetchRunbooks} onCheckedChange={(v) => setFetchRunbooks(!!v)} />
          <span className="text-sm">Fetch & ingest linked runbooks</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Create a read-only API key at <a href="https://support.pagerduty.com/docs/api-access-keys" target="_blank" rel="noopener noreferrer" className="underline">PagerDuty API Access Keys</a>
      </p>

      <Button 
        onClick={() => onSubmit({ apiKey, serviceIds, includeServices, includeOncall, includeIncidents, fetchRunbooks })} 
        disabled={isSubmitting || !apiKey} 
        className="w-full gap-2"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Add & Ingest
      </Button>
    </div>
  );
}
