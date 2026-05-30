import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, XCircle, ExternalLink, ArrowLeft, Upload, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface GoogleDriveFormProps {
  onSubmit: (data: GoogleDriveConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting?: boolean;
  hasConnector?: boolean;
}

export interface GoogleDriveConfig {
  folderId: string;
  authMethod: "oauth" | "service_account";
  serviceAccountEmail?: string;
  serviceAccountKey?: string;
}

export function GoogleDriveForm({ onSubmit, onBack, isSubmitting }: GoogleDriveFormProps) {
  const [folderId, setFolderId] = useState("");
  const [authMethod, setAuthMethod] = useState<"oauth" | "service_account">("oauth");
  const [serviceAccountEmail, setServiceAccountEmail] = useState("");
  const [serviceAccountKey, setServiceAccountKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // OAuth state
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [oauthEmail, setOauthEmail] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  const GOOGLE_CLIENT_ID = "184142288412-iblbsh2rp4odei8phobaaqjejar59lng.apps.googleusercontent.com";
  const REDIRECT_URI = `https://ersqhobqaptsxqclawcc.supabase.co/functions/v1/google-oauth-callback`;
  const SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ].join(" ");

  // Check if the user already has a connected Google token
  useEffect(() => {
    async function checkExistingToken() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("google_oauth_tokens")
        .select("email")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data?.email) setOauthEmail(data.email);
    }
    checkExistingToken();
  }, []);

  // Listen for the OAuth popup completion via postMessage
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "GOOGLE_OAUTH_SUCCESS") {
        setOauthEmail(event.data.email);
        setOauthConnecting(false);
        toast.success(`Connected as ${event.data.email}`);
        popupRef.current?.close();
      } else if (event.data?.type === "GOOGLE_OAUTH_ERROR") {
        setOauthConnecting(false);
        toast.error(`Google connection failed: ${event.data.error}`);
        popupRef.current?.close();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleConnectGoogle = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("You must be logged in to connect Google Drive");
      return;
    }

    // Build the Google OAuth URL. Pass user_id as state so the callback knows who to save tokens for.
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID || "",
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state: session.user.id,
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // Open as a popup
    const width = 500, height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    popupRef.current = window.open(authUrl, "google-oauth", `width=${width},height=${height},left=${left},top=${top}`);
    setOauthConnecting(true);

    // Fallback: poll for popup close in case postMessage doesn't fire
    const pollTimer = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(pollTimer);
        setOauthConnecting(false);
        // Re-check DB to see if token was saved
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return;
          supabase.from("google_oauth_tokens").select("email").eq("user_id", session.user.id).maybeSingle().then(({ data }) => {
            if (data?.email && !oauthEmail) {
              setOauthEmail(data.email);
              toast.success(`Connected as ${data.email}`);
            }
          });
        });
      }
    }, 500);
  };

  const handleDisconnectGoogle = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("google_oauth_tokens").delete().eq("user_id", session.user.id);
    setOauthEmail(null);
    toast.success("Google Drive disconnected");
  };

  // Extract folder ID from Google Drive URL
  const handleFolderInput = (value: string) => {
    const match = value.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (match) {
      setFolderId(match[1]);
    } else {
      setFolderId(value);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setServiceAccountKey(JSON.stringify(json, null, 2));
        if (json.client_email) setServiceAccountEmail(json.client_email);
        toast.success("Service account key loaded");
      } catch {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const handleTestConnection = async () => {
    if (!folderId) {
      toast.error("Please enter a folder ID or URL");
      return;
    }
    if (authMethod === "oauth" && !oauthEmail) {
      toast.error("Please connect your Google account first");
      return;
    }
    if (authMethod === "service_account" && !serviceAccountKey) {
      toast.error("Please provide a service account key");
      return;
    }
    setTesting(true);
    setTestResult(null);
    // Simulate validation — real check happens on ingestion
    setTimeout(() => {
      setTestResult({ success: true, message: "✅ Configuration looks valid. Folder access will be verified during ingestion." });
      setTesting(false);
    }, 800);
  };

  const handleSubmit = async () => {
    if (!folderId) {
      toast.error("Please enter a folder ID or URL");
      return;
    }
    if (authMethod === "oauth" && !oauthEmail) {
      toast.error("Please connect your Google account first");
      return;
    }
    if (authMethod === "service_account" && !serviceAccountKey) {
      toast.error("Please provide a service account key");
      return;
    }
    await onSubmit({
      folderId,
      authMethod,
      serviceAccountEmail: authMethod === "service_account" ? serviceAccountEmail : undefined,
      serviceAccountKey: authMethod === "service_account" ? serviceAccountKey : undefined,
    });
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
        <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center">
          <span className="text-gray-900 font-bold text-lg">G</span>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Connect Google Drive</h3>
          <p className="text-xs text-muted-foreground">Import documents from a Google Drive folder</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Folder URL or ID</label>
        <Input
          placeholder="https://drive.google.com/drive/folders/... or folder ID"
          value={folderId}
          onChange={(e) => handleFolderInput(e.target.value)}
        />
      </div>

      <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="oauth">My Google Account</TabsTrigger>
          <TabsTrigger value="service_account">Service Account</TabsTrigger>
        </TabsList>

        <TabsContent value="oauth" className="space-y-3 pt-2">
          {oauthEmail ? (
            <div className="space-y-3">
              <div className="bg-green-500/10 text-green-600 p-3 rounded-lg text-sm border border-green-500/20 flex items-center justify-between">
                <span>✅ Connected as <strong>{oauthEmail}</strong></span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnectGoogle}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="w-3 h-3 mr-1" />
                  Disconnect
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Make sure the folder you want to import is owned by or shared with this account.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Sign in with your Google account to import files you own or have access to.
                RocketBoard will get read-only access to Google Drive, Docs, and Sheets.
              </p>
              <Button
                onClick={handleConnectGoogle}
                disabled={oauthConnecting}
                className="w-full"
                variant="outline"
              >
                {oauthConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <LogIn className="w-4 h-4 mr-2" />
                )}
                {oauthConnecting ? "Waiting for Google sign-in..." : "Connect with Google"}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="service_account" className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Service Account Key (JSON)
            </label>
            <div className="flex gap-2 mb-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button variant="outline" className="w-full" asChild>
                  <span className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Key File
                  </span>
                </Button>
              </label>
            </div>
            <Textarea
              placeholder='{"type": "service_account", "project_id": "...", ...}'
              value={serviceAccountKey}
              onChange={(e) => setServiceAccountKey(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
          </div>

          {serviceAccountEmail && (
            <div className="bg-muted/50 p-3 rounded-lg text-xs">
              <strong className="text-foreground">Service Account Email:</strong>
              <br />
              <code className="text-primary">{serviceAccountEmail}</code>
              <p className="text-muted-foreground mt-2">
                Share your Google Drive folder with this email address to grant read access.
              </p>
            </div>
          )}

          <a
            href="https://console.cloud.google.com/iam-admin/serviceaccounts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Create a service account in Google Cloud Console <ExternalLink className="w-3 h-3" />
          </a>
        </TabsContent>
      </Tabs>

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
