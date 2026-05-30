import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, XCircle, ExternalLink, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface SharePointFormProps {
  onSubmit: (data: SharePointConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting?: boolean;
}

export interface SharePointConfig {
  siteUrl: string;
  documentLibrary: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export function SharePointForm({ onSubmit, onBack, isSubmitting }: SharePointFormProps) {
  const [siteUrl, setSiteUrl] = useState("");
  const [documentLibrary, setDocumentLibrary] = useState("Shared Documents");
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!siteUrl || !tenantId || !clientId || !clientSecret) {
      toast.error("Please fill in all required fields");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Get access token using client credentials flow
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      
      const tokenResp = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
        }),
      });

      if (!tokenResp.ok) {
        const error = await tokenResp.json();
        setTestResult({
          success: false,
          message: `❌ Authentication failed: ${error.error_description || error.error}`,
        });
        return;
      }

      const tokenData = await tokenResp.json();
      
      // Test access to the site
      const hostname = new URL(siteUrl).hostname;
      const sitePath = new URL(siteUrl).pathname;
      
      const siteResp = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`,
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      );

      if (siteResp.ok) {
        const siteData = await siteResp.json();
        setTestResult({
          success: true,
          message: `✅ Connected to site: ${siteData.displayName || siteData.name}`,
        });
      } else if (siteResp.status === 403) {
        setTestResult({
          success: false,
          message: "❌ Access denied. Ensure the app has Sites.Read.All permission.",
        });
      } else if (siteResp.status === 404) {
        setTestResult({
          success: false,
          message: "❌ Site not found. Check the site URL.",
        });
      } else {
        setTestResult({
          success: false,
          message: `❌ Failed to access site: ${siteResp.status}`,
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
    if (!siteUrl || !tenantId || !clientId || !clientSecret) {
      toast.error("Please fill in all required fields");
      return;
    }
    await onSubmit({ siteUrl, documentLibrary, tenantId, clientId, clientSecret });
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
        <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
          <span className="text-white font-bold text-lg">S</span>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Connect SharePoint</h3>
          <p className="text-xs text-muted-foreground">Import documents from a SharePoint site</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Site URL</label>
        <Input
          placeholder="https://company.sharepoint.com/sites/engineering"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Document Library</label>
        <Input
          placeholder="Shared Documents"
          value={documentLibrary}
          onChange={(e) => setDocumentLibrary(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Usually "Shared Documents" or "Documents"
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Tenant ID</label>
          <Input
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Client ID</label>
          <Input
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Client Secret</label>
        <Input
          type="password"
          placeholder="●●●●●●●●●●●●●●●●"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
        />
      </div>

      <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
        <strong className="text-foreground">Setup Instructions:</strong>
        <ol className="list-decimal list-inside mt-1 space-y-1">
          <li>Register an app in Azure AD (portal.azure.com → App registrations)</li>
          <li>Add API permission: Microsoft Graph → Application → Sites.Read.All</li>
          <li>Create a client secret and copy the value</li>
          <li>Grant admin consent for the permissions</li>
        </ol>
      </div>

      <a
        href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Open Azure AD App Registrations <ExternalLink className="w-3 h-3" />
      </a>

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
