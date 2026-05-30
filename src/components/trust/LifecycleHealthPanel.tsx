import { useState, useEffect } from "react";
import { 
  Database, 
  ShieldAlert, 
  History, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface LifecycleHealthPanelProps {
  packId: string;
}

export function LifecycleHealthPanel({ packId }: LifecycleHealthPanelProps) {
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

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
      setPolicy(policyData);

      // 2. Fetch Latest 10 Events
      const { data: eventData } = await (supabase as any)
        .from("lifecycle_audit_events")
        .select("*")
        .eq("pack_id", packId)
        .order("created_at", { ascending: false })
        .limit(10);
      setEvents(eventData || []);

    } catch (error) {
      console.error("Failed to fetch lifecycle metrics", error);
    } finally {
      setLoading(false);
    }
  };

  const lastRetentionRun = events.find(e => e.action === "retention_cleanup" && e.status === "completed");

  if (loading) return <div className="animate-pulse h-64 bg-muted/20 rounded-lg border border-dashed" />;

  return (
    <div className="space-y-6">
      {/* Policy & Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Retention Window
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{policy?.retention_rag_metrics_days || 90} Days</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tight">AI Metrics (rag_metrics)</p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <History className="w-3.5 h-3.5" /> Last Cleanup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {lastRetentionRun 
                ? format(new Date(lastRetentionRun.created_at), "MMM d, HH:mm")
                : "No runs yet"}
            </div>
            {lastRetentionRun && (
              <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tight">
                Deleted: {lastRetentionRun.rows_deleted?.rag_metrics || 0} metrics
              </p>
            )}
          </CardContent>
        </Card>

        <Card className={policy?.legal_hold ? "bg-destructive/5 border-destructive/20 shadow-sm" : "bg-card shadow-sm border-border"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShieldAlert className={policy?.legal_hold ? "w-3.5 h-3.5 text-destructive" : "w-3.5 h-3.5"} /> Compliance Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={policy?.legal_hold ? "destructive" : "outline"} className="h-6 gap-1.5 uppercase tracking-wider text-[10px] font-bold">
              {policy?.legal_hold ? "Legal Hold Enabled" : "Standard Policy"}
            </Badge>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium">
              {policy?.legal_hold 
                ? "Automatic and manual deletions are suspended."
                : "Data is being managed according to retention policy."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Audit Event List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Lifecycle Audit Trail
            </CardTitle>
            <CardDescription>Recent purge, retention, and maintenance events.</CardDescription>
          </div>
          <Link to={`/packs/${packId}/settings/lifecycle`}>
            <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8">
              Open Settings <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-muted/10">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No lifecycle events recorded for this pack.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-bold text-muted-foreground">Action</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-muted-foreground">Target</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-muted-foreground">Deleted</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-muted-foreground text-right">Time</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id} className="cursor-pointer hover:bg-muted/30 group" onClick={() => setSelectedEvent(event)}>
                    <TableCell className="font-medium text-xs whitespace-nowrap">
                      <span className="uppercase tracking-tight inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary-foreground font-bold text-[9px]">
                        {event.action.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground italic">
                      {event.target_type}{event.target_id ? `:${event.target_id.split('-')[0]}` : ''}
                    </TableCell>
                    <TableCell>
                      {event.status === "completed" ? (
                        <Badge variant="outline" className="h-5 text-[9px] gap-1 border-green-500/30 bg-green-500/5 text-green-600">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Completed
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="h-5 text-[9px] gap-1">
                          <XCircle className="w-2.5 h-2.5" /> Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {Object.entries(event.rows_deleted || {}).map(([key, val]: [string, any]) => (
                        <span key={key} className="inline-block mr-2 text-[10px] font-bold">
                          {val} {key.split('_')[0]}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground whitespace-nowrap">
                       {format(new Date(event.created_at), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                       <Info className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Event Details: {selectedEvent?.action.replace('_', ' ')}
            </DialogTitle>
            <DialogDescription>
              Detailed logs and parameters for the lifecycle event from {selectedEvent && format(new Date(selectedEvent.created_at), "PPpp")}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Status</h4>
                 <Badge variant={selectedEvent?.status === 'completed' ? 'outline' : 'destructive'} className="h-6">
                    {selectedEvent?.status}
                 </Badge>
               </div>
               <div>
                  <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Actor ID</h4>
                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{selectedEvent?.actor_user_id || 'System'}</code>
               </div>
            </div>

            <div>
              <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Rows Deleted</h4>
              <div className="bg-muted/30 p-3 rounded-lg border flex flex-wrap gap-4">
                 {selectedEvent?.rows_deleted && Object.entries(selectedEvent.rows_deleted).map(([key, val]: [string, any]) => (
                   <div key={key} className="flex flex-col">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold">{key}</span>
                      <span className="text-lg font-bold text-primary">{val}</span>
                   </div>
                 ))}
                 {(!selectedEvent?.rows_deleted || Object.keys(selectedEvent.rows_deleted).length === 0) && (
                   <span className="text-xs text-muted-foreground italic underline decoration-dotted">No rows affected.</span>
                 )}
              </div>
            </div>

            {selectedEvent?.error_message && (
              <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                <h4 className="text-[10px] uppercase font-bold text-destructive mb-1 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Error Message
                </h4>
                <p className="text-xs text-destructive-foreground font-mono">{selectedEvent.error_message}</p>
              </div>
            )}

            <div>
              <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Parameters</h4>
              <pre className="text-[10px] bg-muted p-4 rounded-lg overflow-auto border border-muted/50 max-h-48">
                {JSON.stringify(selectedEvent?.parameters, null, 2)}
              </pre>
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setSelectedEvent(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
