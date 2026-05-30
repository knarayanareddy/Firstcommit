import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, XCircle, ExternalLink, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface ConfluenceFormProps {
  onSubmit: (data: ConfluenceConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting?: boolean;
}

export interface ConfluenceConfig {
  baseUrl: string;
  spaceKey: string;
  authEmail: string;
  apiToken: string;
}

export function ConfluenceForm({ onSubmit, onBack, isSubmitting }: ConfluenceFormProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [spaceKey, setSpaceKey] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!baseUrl || !spaceKey || !authEmail || !apiToken) {
      toast.error("Please fill in all fields");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Test by fetching space info
      const cleanUrl = baseUrl.replace(/\/$/, "");
      const auth = btoa(`${authEmail}:${apiToken}`);
      
      const resp = await fetch(`${cleanUrl}/wiki/api/v2/spaces/${spaceKey}`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      });

      if (resp.ok) {
        const data = await resp.json();
        setTestResult({
          success: true,
          message: `✅ Connected! Found space: ${data.name || spaceKey}`,
        });
      } else if (resp.status === 401) {
        setTestResult({
          success: false,
          message: "❌ Authentication failed. Check your email and API token.",
        });
      } else if (resp.status === 404) {
        setTestResult({
          success: false,
          message: "❌ Space not found. Check the space key.",
        });
      } else {
        setTestResult({
          success: false,
          message: `❌ Connection failed: ${resp.status} ${resp.statusText}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `❌ Connection error: ${err.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!baseUrl || !spaceKey || !authEmail || !apiToken) {
      toast.error("Please fill in all fields");
      return;
    }
    await onSubmit({ baseUrl, spaceKey, authEmail, apiToken });
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg">C</span>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Connect Confluence</h3>
          <p className="text-xs text-muted-foreground">Import wiki pages from a Confluence space</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Base URL</label>
        <Input
          placeholder="https://yourcompany.atlassian.net"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Space Key</label>
        <Input
          placeholder="ENG"
          value={spaceKey}
          onChange={(e) => setSpaceKey(e.target.value.toUpperCase())}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Found in the space URL: /wiki/spaces/<strong>KEY</strong>/...
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
        <Input
          placeholder="admin@company.com"
          type="email"
          value={authEmail}
          onChange={(e) => setAuthEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">API Token</label>
        <Input
          placeholder="●●●●●●●●●●●●●●●●"
          type="password"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
        />
        <a
          href="https://id.atlassian.com/manage-profile/security/api-tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
        >
          Generate an API token <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {testResult && (
        <div
          className={`p-3 rounded-lg text-sm ${
            testResult.success
              ? "bg-green-500/10 text-green-600 border border-green-500/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {testResult.message}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={testing || isSubmitting}
          className="flex-1"
        >
          {testing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : testResult?.success ? (
            <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
          ) : testResult ? (
            <XCircle className="w-4 h-4 mr-2 text-destructive" />
          ) : null}
          Test Connection
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Add Source
        </Button>
      </div>
    </div>
  );
}
