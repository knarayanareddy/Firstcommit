import React, { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useParams, Link } from "react-router-dom";
import { FileText, ArrowLeft, Settings, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function DocsAdminPage() {
  const { packId } = useParams<{ packId: string }>();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!packId || syncing) return;
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("You must be logged in to sync docs.");
        return;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-pack-docs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pack_id: packId }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Sync failed");

      toast.success(
        `Sync complete: ${result.summary.docs_created} created, ${result.summary.docs_updated} updated.`
      );
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
        <div className="flex items-center gap-4">
          <Link to={`/packs/${packId}/docs`} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 data-tour="docs-admin-header" className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Docs Admin
          </h1>
        </div>
        
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-medium text-foreground mb-2">Sync Documentation</h2>
          <p className="max-w-md mx-auto mb-6">
            Trigger the <strong>Titanium-Hardened</strong> sync engine to import and parse Technical documents from the source repository. Every sync is verified by our automated integrity script with full secret redaction.
          </p>
          <button
            data-tour="docs-sync-button"
            onClick={handleSync}
            disabled={syncing}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
            {syncing ? "Syncing…" : "Sync Repository Docs"}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
