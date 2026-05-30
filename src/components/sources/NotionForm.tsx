import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, XCircle, ExternalLink, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface NotionFormProps {
  onSubmit: (data: NotionConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting?: boolean;
}

export interface NotionConfig {
  integrationToken: string;
  rootPageId?: string;
}

export function NotionForm({ onSubmit, onBack, isSubmitting }: NotionFormProps) {
  const [integrationToken, setIntegrationToken] = useState("");
  const [rootPageId, setRootPageId] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!integrationToken) {
      toast.error("Please enter your integration token");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Test by searching for pages
      const resp = await fetch("https://api.notion.com/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${integrationToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 10,
          filter: { property: "object", value: "page" },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const pageCount = data.results?.length || 0;
        setTestResult({
          success: true,
          message: `✅ Connected! Found ${pageCount} accessible page${pageCount !== 1 ? "s" : ""}.`,
        });
      } else if (resp.status === 401) {
        setTestResult({
          success: false,
          message: "❌ Invalid integration token.",
        });
      } else {
        const error = await resp.json();
        setTestResult({
          success: false,
          message: `❌ Connection failed: ${error.message || resp.statusText}`,
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
    if (!integrationToken) {
      toast.error("Please enter your integration token");
      return;
    }
    await onSubmit({ integrationToken, rootPageId: rootPageId || undefined });
  };

  // Extract page ID from Notion URL if pasted
  const handleRootPageChange = (value: string) => {
    // Handle Notion URLs like https://notion.so/Page-Title-abc123def456
    const match = value.match(/([a-f0-9]{32})|([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (match) {
      setRootPageId(match[0].replace(/-/g, ""));
    } else {
      setRootPageId(value);
    }
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
        <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center">
          <span className="text-white font-bold text-lg">N</span>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Connect Notion</h3>
          <p className="text-xs text-muted-foreground">Import pages from your Notion workspace</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Integration Token</label>
        <Input
          placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          type="password"
          value={integrationToken}
          onChange={(e) => setIntegrationToken(e.target.value)}
        />
        <a
          href="https://www.notion.so/my-integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
        >
          Create an integration <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Root Page ID <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          placeholder="abc123def456 or full Notion URL"
          value={rootPageId}
          onChange={(e) => handleRootPageChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Leave empty to import all shared pages, or specify a page to import its children.
        </p>
      </div>

      <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
        <strong className="text-foreground">Important:</strong> Share the pages you want to import
        with your integration in Notion. Go to a page → Share → Invite → Select your integration.
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
