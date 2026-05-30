import { useState, useEffect } from "react";
import { 
  FileSearch, 
  ShieldCheck, 
  History, 
  Eye, 
  Scale, 
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Info,
  Fingerprint
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
import { format } from "date-fns";

interface AiAuditLogPanelProps {
  packId: string;
}

export function AiAuditLogPanel({ packId }: AiAuditLogPanelProps) {
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
      // 1. Fetch Policy for retention info
      const { data: policyData } = await (supabase as any)
        .from("pack_lifecycle_policies")
        .select("*")
        .eq("pack_id", packId)
        .single();
      setPolicy(policyData);

      // 2. Fetch Latest 15 Audit Events
      const { data: eventData } = await (supabase as any)
        .from("ai_audit_events")
        .select("*")
        .eq("pack_id", packId)
        .order("created_at", { ascending: false })
        .limit(15);
      setEvents(eventData || []);

    } catch (error) {
      console.error("Failed to fetch AI audit logs", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="animate-pulse h-64 bg-muted/20 rounded-lg border border-dashed" />;

  const passRate = events.length > 0 
    ? (events.filter(e => e.grounding_gate_passed).length / events.length) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Retention Window
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{policy?.retention_audit_days || 90} Days</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tight">AI Audit Trail Persistence</p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Scale className="w-3.5 h-3.5" /> Grounding Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passRate.toFixed(1)}%</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tight">Gate Pass Rate (Last {events.length})</p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Fingerprint className="w-3.5 h-3.5" /> Identity Scoping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-medium text-muted-foreground">Every interaction is tied to User, Pack, and Org for durable forensic audit.</div>
            <p className="text-[10px] text-primary mt-2 uppercase font-bold tracking-tight">MULTI-TENANT ISOLATION ENABLED</p>
          </CardContent>
        </Card>
      </div>

      {/* Audit Log Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-primary" />
              AI Governance Audit Log
            </CardTitle>
            <CardDescription>Verified records of AI decisions, evidence used, and content signatures.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="h-8 gap-1.5 text-xs font-bold uppercase tracking-wider">
            <History className="w-3.5 h-3.5" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-muted/10">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No AI audit events recorded for this pack yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-bold text-muted-foreground">Task</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-muted-foreground text-center">Outcome</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-muted-foreground">Reason</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-muted-foreground">Evidence</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-muted-foreground text-right">Time</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id} className="cursor-pointer hover:bg-muted/30 group" onClick={() => setSelectedEvent(event)}>
                    <TableCell className="font-medium text-xs whitespace-nowrap">
                      <span className="uppercase tracking-tight inline-block px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 font-bold text-[9px]">
                        {event.task_type?.replace('_', ' ') || 'unknown'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {event.grounding_gate_passed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground max-w-[150px] truncate">
                      {event.grounding_gate_reason || 'OK'}
                    </TableCell>
                    <TableCell className="text-[10px] font-bold text-muted-foreground">
                       {event.citations_found || 0} citations / {event.unique_files_count || 0} files
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground whitespace-nowrap font-mono text-[10px]">
                       {format(new Date(event.created_at), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                       <Eye className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Audit Event: {selectedEvent?.request_id?.split('-')[0]}
            </DialogTitle>
            <DialogDescription>
              Forensic detail for {selectedEvent?.task_type} request on {selectedEvent && format(new Date(selectedEvent.created_at), "PPpp")}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
            {/* Identity & Origin */}
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <h4 className="text-[10px] uppercase font-bold text-muted-foreground">User Identity</h4>
                 <div className="text-xs font-mono bg-muted p-2 rounded border border-muted-foreground/10">{selectedEvent?.user_id}</div>
               </div>
               <div className="space-y-1">
                 <h4 className="text-[10px] uppercase font-bold text-muted-foreground">Trace ID (Langfuse)</h4>
                 <div className="text-xs font-mono bg-muted p-2 rounded border border-muted-foreground/10">{selectedEvent?.trace_id || 'N/A'}</div>
               </div>
            </div>

            {/* Decision Logic */}
            <div className="p-4 bg-muted/20 border rounded-lg space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> Grounding Verdict
              </h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="flex flex-col">
                   <span className="text-[9px] uppercase font-bold text-muted-foreground">Gate Passed</span>
                   <Badge variant={selectedEvent?.grounding_gate_passed ? "outline" : "destructive"} className="w-fit h-5 text-[9px]">
                      {selectedEvent?.grounding_gate_passed ? "YES" : "NO"}
                   </Badge>
                </div>
                <div className="flex flex-col">
                   <span className="text-[9px] uppercase font-bold text-muted-foreground">Attempts</span>
                   <span className="text-sm font-bold">{selectedEvent?.attempts}</span>
                </div>
                <div className="flex flex-col">
                   <span className="text-[9px] uppercase font-bold text-muted-foreground">Strip Rate</span>
                   <span className="text-sm font-bold">{(selectedEvent?.strip_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex flex-col">
                   <span className="text-[9px] uppercase font-bold text-muted-foreground">File Breadth</span>
                   <span className="text-sm font-bold">{selectedEvent?.unique_files_count}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-muted-foreground/10">
                <span className="text-[9px] uppercase font-bold text-muted-foreground">Verdict Reason</span>
                <p className="text-xs text-muted-foreground mt-1 italic">{selectedEvent?.grounding_gate_reason}</p>
              </div>
            </div>

            {/* Evidence Manifest */}
            <div className="space-y-2">
               <h4 className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                 <FileText className="w-4 h-4 text-primary" /> Evidence Manifest
               </h4>
               <div className="border rounded-lg overflow-hidden">
                 <Table className="bg-muted/5">
                   <TableHeader className="bg-muted/30">
                     <TableRow className="hover:bg-transparent">
                       <TableHead className="h-8 text-[9px] font-black uppercase">Badge</TableHead>
                       <TableHead className="h-8 text-[9px] font-black uppercase">File Path</TableHead>
                       <TableHead className="h-8 text-[9px] font-black uppercase">Lines</TableHead>
                       <TableHead className="h-8 text-[9px] font-black uppercase">Chunk</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {(selectedEvent?.evidence_manifest?.citations || []).map((cit: any, idx: number) => (
                       <TableRow key={`${cit.badge}-${idx}`} className="hover:bg-muted/20">
                         <TableCell className="py-2 text-[10px]"><Badge variant="outline" className="h-4 px-1 text-[9px] font-bold">{cit.badge}</Badge></TableCell>
                         <TableCell className="py-2 text-[10px] font-mono truncate max-w-[200px]">{cit.path}</TableCell>
                         <TableCell className="py-2 text-[10px] text-muted-foreground whitespace-nowrap">{cit.start}-{cit.end}</TableCell>
                         <TableCell className="py-2 text-[10px] font-mono text-muted-foreground opacity-50">{(cit.chunk_id || '').split('-')[0]}...</TableCell>
                       </TableRow>
                     ))}
                     {(!selectedEvent?.evidence_manifest?.citations || selectedEvent?.evidence_manifest?.citations.length === 0) && (
                       <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-[10px] text-muted-foreground italic">No direct citations recorded for this generation.</TableCell>
                       </TableRow>
                     )}
                   </TableBody>
                 </Table>
               </div>
            </div>

            {/* Content Retention (Hashes & Previews) */}
            <div className="space-y-3">
               <h4 className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                 <ShieldCheck className="w-4 h-4 text-secondary" /> Data Integrity & Retention
               </h4>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground">Prompt Hash</span>
                      <span className="text-[9px] font-mono opacity-40">{selectedEvent?.prompt_hash?.slice(0, 12)}...</span>
                    </div>
                    <div className="bg-muted p-2 rounded text-[10px] italic text-muted-foreground border leading-relaxed min-h-[40px]">
                      {selectedEvent?.prompt_preview || 'Content redacted / not stored'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground">Response Hash</span>
                      <span className="text-[9px] font-mono opacity-40">{selectedEvent?.response_hash?.slice(0, 12)}...</span>
                    </div>
                    <div className="bg-muted p-2 rounded text-[10px] italic text-muted-foreground border leading-relaxed min-h-[40px]">
                      {selectedEvent?.response_preview || 'Content redacted / not stored'}
                    </div>
                  </div>
               </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 mt-2 border-t">
            <Button variant="outline" onClick={() => setSelectedEvent(null)}>Close Audit Detail</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
