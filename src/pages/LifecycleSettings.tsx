import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { usePack } from "@/hooks/usePack";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Database, 
  Trash2, 
  Download, 
  ShieldAlert, 
  History, 
  AlertTriangle,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  Clock,
  Search,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function LifecycleSettings() {
  const { packId } = useParams<{ packId: string }>();
  const { currentPack } = usePack();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<any>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [purging, setPurging] = useState<string | null>(null);

  useEffect(() => {
    if (packId) {
      fetchData();
    }
  }, [packId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Policy
      const { data: policyData } = await (supabase as any)
        .from("pack_lifecycle_policies")
        .select("*")
        .eq("pack_id", packId)
        .single();
      
      if (policyData) {
        setPolicy(policyData);
      } else {
        // Defaults
        setPolicy({
          pack_id: packId,
          retention_rag_metrics_days: 90,
          retention_ingestion_jobs_days: 90,
          retention_feedback_days: 365,
          retention_audit_days: 365,
          legal_hold: false
        });
      }

      // 2. Fetch Sources
      const { data: sourceData } = await supabase
        .from("pack_sources")
        .select("*")
        .eq("pack_id", packId);
      setSources(sourceData || []);

      // 3. Fetch Audit Logs
      const { data: logData } = await (supabase as any)
        .from("lifecycle_audit_events")
        .select("*")
        .eq("pack_id", packId)
        .order("created_at", { ascending: false })
        .limit(10);
      setAuditLogs(logData || []);

    } catch (error: any) {
      toast.error("Failed to load lifecycle settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolicy = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("pack_lifecycle_policies")
        .upsert(policy);
      
      if (error) throw error;
      toast.success("Retention policy updated");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePurgeSource = async (sourceId: string, mode: "dry_run" | "execute") => {
    setPurging(sourceId);
    try {
      const { data, error } = await supabase.functions.invoke("purge-source", {
        body: { pack_id: packId, source_id: sourceId, mode }
      });

      if (error) throw error;

      if (mode === "dry_run") {
        toast.info(`Dry run: ${data.counts.knowledge_chunks} chunks and ${data.counts.ingestion_jobs} jobs would be deleted.`);
      } else {
        toast.success(`Purge complete: Deleted ${data.counts.knowledge_chunks} chunks.`);
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.message || "Purge failed");
    } finally {
      setPurging(null);
    }
  };

  const handleExport = () => {
    toast.info("Export functionality is scheduled for v1.1. Contact support for manual exports.");
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading lifecycle settings...</div>;

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Data Lifecycle & Compliance</h1>
            </div>
            <p className="text-muted-foreground">
              Manage data retention, purge ingested content, and enforce compliance for <span className="text-foreground font-medium">{currentPack?.title}</span>.
            </p>
          </div>
          <Badge variant={policy?.legal_hold ? "destructive" : "outline"} className="px-3 py-1 gap-1.5 uppercase tracking-wider text-[10px] font-bold">
            {policy?.legal_hold ? <ShieldAlert className="w-3 h-3" /> : null}
            {policy?.legal_hold ? "Legal Hold Enabled" : "Standard Policy"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Controls */}
          <div className="lg:col-span-2 space-y-8">
            {/* Retention Policies */}
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Retention Policies
                </CardTitle>
                <CardDescription>
                  Configure how long operational data is kept before automatic purging.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="retention_metrics">AI Metrics Retention (Days)</Label>
                    <Input 
                      id="retention_metrics" 
                      type="number" 
                      value={policy?.retention_rag_metrics_days}
                      onChange={(e) => setPolicy({ ...policy, retention_rag_metrics_days: parseInt(e.target.value) })}
                    />
                    <p className="text-[10px] text-muted-foreground">Applies to rag_metrics table.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retention_jobs">Ingestion Jobs Retention (Days)</Label>
                    <Input 
                      id="retention_jobs" 
                      type="number" 
                      value={policy?.retention_ingestion_jobs_days}
                      onChange={(e) => setPolicy({ ...policy, retention_ingestion_jobs_days: parseInt(e.target.value) })}
                    />
                    <p className="text-[10px] text-muted-foreground">Applies to ingestion_jobs table history.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retention_audit">Audit Log Retention (Days)</Label>
                    <Input 
                      id="retention_audit" 
                      type="number" 
                      value={policy?.retention_audit_days}
                      onChange={(e) => setPolicy({ ...policy, retention_audit_days: parseInt(e.target.value) })}
                    />
                    <p className="text-[10px] text-muted-foreground">Applies to lifecycle_audit_events.</p>
                  </div>
                  <div className="flex flex-col justify-center space-y-2 p-4 rounded-lg bg-muted/30 border border-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          Legal Hold 
                          <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
                        </Label>
                        <p className="text-[10px] text-muted-foreground">Suspends all automated and manual purges. (Enforcement coming soon)</p>
                      </div>
                      <Switch 
                        checked={policy?.legal_hold}
                        onCheckedChange={(checked) => setPolicy({ ...policy, legal_hold: checked })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-6 bg-muted/10">
                <Button onClick={handleSavePolicy} disabled={saving} className="ml-auto gap-2">
                  {saving && <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
                  Save Policy Changes
                </Button>
              </CardFooter>
            </Card>

            {/* Source Purge Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-destructive" />
                  Per-Source Purge
                </CardTitle>
                <CardDescription>
                  Safely remove all ingested artifacts (chunks and jobs) for specific connectors.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sources.length === 0 ? (
                    <p className="text-sm text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                      No active sources found.
                    </p>
                  ) : (
                    sources.map((source) => (
                      <div key={source.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border bg-card shadow-sm gap-4">
                        <div className="space-y-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{source.config?.title || source.type}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold">
                            <Badge variant="outline" className="text-[8px] h-4">{source.type}</Badge>
                            <span>ID: {source.id.split('-')[0]}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs gap-1.5 hover:bg-destructive/5"
                            disabled={purging !== null || policy?.legal_hold}
                            onClick={() => handlePurgeSource(source.id, "dry_run")}
                          >
                            <Search className="w-3.5 h-3.5" /> Dry Run
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="h-8 text-xs gap-1.5"
                            disabled={purging !== null || policy?.legal_hold}
                            onClick={() => {
                              const confirmText = prompt(`To purge all data for ${source.config?.title || source.type}, type "PURGE" to confirm:`);
                              if (confirmText === "PURGE") {
                                handlePurgeSource(source.id, "execute");
                              } else {
                                toast.error("Purge cancelled: confirmation text did not match.");
                              }
                            }}
                          >
                            {purging === source.id ? (
                               <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            Purge
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-8">
             {/* Audit Log Overview */}
             <Card className="border-border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    Recent Lifecycle Events
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-6">
                      <History className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">No recent events</p>
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="text-xs space-y-1.5 p-3 rounded bg-muted/30 border border-muted/50">
                        <div className="flex items-center justify-between">
                          <span className="font-bold uppercase text-[9px] text-primary">{log.action.replace('_', ' ')}</span>
                          <span className="text-[9px] text-muted-foreground">{format(new Date(log.created_at), "MMM d, HH:mm")}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">Target: {log.target_type} ({log.target_id?.split('-')[0]})</p>
                        {log.rows_deleted && (
                          <div className="flex gap-2">
                            {Object.entries(log.rows_deleted).map(([key, val]: [string, any]) => (
                              <Badge key={key} variant="outline" className="text-[8px] bg-background">-{val} {key}</Badge>
                            ))}
                          </div>
                        )}
                        {log.status === "failed" && (
                          <Badge variant="destructive" className="text-[8px] h-3.5">Failed</Badge>
                        )}
                      </div>
                    ))
                  )}
                  <Button variant="ghost" size="sm" className="w-full text-xs h-8 gap-2">
                    View Full Audit Log <History className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
             </Card>

             {/* Guidance */}
             <Card className="bg-primary/5 border-primary/20">
               <CardHeader className="pb-3">
                 <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                   <ShieldAlert className="w-4 h-4" />
                   Compliance & Safety
                 </CardTitle>
               </CardHeader>
               <CardContent className="space-y-3 text-xs text-muted-foreground">
                 <div className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <p><span className="text-foreground font-medium">Atomic Purge:</span> Deletes all knowledge chunks and job records for the source.</p>
                 </div>
                 <div className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <p><span className="text-foreground font-medium">Data Sovereignty:</span> Only authors of this pack can initiate purges or exports.</p>
                 </div>
                 <div className="flex gap-2 border-t pt-3 mt-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                    <p><span className="text-foreground font-medium">Retention Jobs:</span> Run daily at 02:00 UTC. Legal Hold will block all scheduled deletions.</p>
                 </div>
               </CardContent>
             </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
