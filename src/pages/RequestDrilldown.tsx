import { DashboardLayout } from "@/components/DashboardLayout";
import { useRequestDetail } from "@/hooks/useTrustData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link } from "react-router-dom";
import { PackId, ChunkRef } from "@/types/brands";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ExternalLink, 
  FileCode, 
  ShieldCheck, 
  AlertCircle, 
  Clock, 
  Copy,
  Terminal,
  Search,
  CheckCircle2
} from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { format } from "date-fns";
import { toast } from "sonner";

export default function RequestDrilldown() {
  const { packId, requestId } = useParams<{ packId: string, requestId: string }>();
  const { data: request, isLoading } = useRequestDetail(requestId || "");

  const { data: chunks } = useQuery({
    queryKey: ["request_chunks", request?.source_map],
    queryFn: async () => {
      const ids = (request?.source_map as any[])?.map(m => m.chunk_id).filter(Boolean);
      if (!ids?.length || !packId) return [];
      
      const { batchFetchKnowledgeChunks } = await import("@/lib/knowledgeChunks");
      const chunksMap = await batchFetchKnowledgeChunks(packId as PackId, ids as ChunkRef[]);
      
      // Get unique chunks (result is keyed by both PK and Stable ID)
      const seenIds = new Set<string>();
      return Object.values(chunksMap).filter(c => {
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
      });
    },
    enabled: !!request?.source_map && !!packId,
  });

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;
  if (!request) return <DashboardLayout>Request not found</DashboardLayout>;

  const handleCopyManifest = () => {
    navigator.clipboard.writeText(JSON.stringify(request, null, 2));
    toast.success("Evidence manifest copied to clipboard");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
            <Link to={`/packs/${packId}/trust`}>
              <ChevronLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Request Audit
              <Badge variant="outline" className="font-mono text-[10px]">{requestId?.slice(0, 8)}</Badge>
            </h1>
            <p className="text-xs text-muted-foreground">{format(new Date(request.created_at), "PPPP 'at' p")}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-2" onClick={handleCopyManifest}>
              <Copy className="w-3 h-3" /> Copy Manifest
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Meta Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatusBox label="Outcome" value={request.grounding_gate_passed ? "Passed" : "Refused"} sub={request.grounding_gate_reason || "Verified"} status={request.grounding_gate_passed ? "success" : "error"} />
              <StatusBox label="Latency" value={`${request.total_latency_ms}ms`} sub={`${request.attempts} attempts`} icon={<Clock className="w-3 h-3" />} />
              <StatusBox label="Grounding" value={request.strip_rate?.toFixed(2) || "0.00"} sub={`of ${request.claims_total} claims`} />
              <StatusBox label="Context" value={request.citations_found || 0} sub={`${request.unique_files_count} files`} icon={<Search className="w-3 h-3" />} />
            </div>

            {/* Response Content */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Model Response</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-invert max-w-none">
                <MarkdownRenderer>{request.canonical_response || "No response recorded"}</MarkdownRenderer>
              </CardContent>
            </Card>

            {/* Debug Hints */}
            {!request.grounding_gate_passed && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="pt-6 text-sm text-red-500 space-y-2">
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                    <AlertCircle className="w-3 h-3" /> System Remediation Hints
                  </div>
                  <p>Grounding Gate refused this response because it failed the required SLO.</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs opacity-80">
                    <li>The query triggered {request.claims_total} claims but {request.claims_stripped} were unverified.</li>
                    <li>Ensure the sources covering this topic are indexed and high-quality.</li>
                    <li>Try enabling <strong>Detective Mode</strong> if the knowledge requires multi-hop retrieval.</li>
                    <li>If the query is too broad, suggest the user narrows the scope.</li>
                  </ul>
                  <div className="pt-2">
                    <Button variant="outline" size="sm" className="h-7 text-[10px] border-red-500/20 text-red-500 hover:bg-red-500/10" asChild>
                       <Link to={`/packs/${packId}/sources`}>Manage Sources</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  Evidence Bundle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(request.source_map as any[])?.length ? (
                  (request.source_map as any[]).map((m, i) => (
                    <div key={i} className="group relative bg-muted/30 rounded-lg p-3 border border-border/50 hover:border-primary/30 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="secondary" className="font-mono text-[9px] h-4">S{i+1}</Badge>
                        <span className="text-[10px] text-muted-foreground">{m.path?.split('/').pop()}</span>
                      </div>
                      <p className="text-[11px] font-mono text-foreground truncate mb-2">{m.path}</p>
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] text-muted-foreground">Lines {m.line_start}-{m.line_end}</span>
                         <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            View <ExternalLink className="w-2 h-2" />
                         </Button>
                      </div>
                    </div>
                  ))
                ) : (
                   <p className="text-xs text-muted-foreground italic">No citations recorded in source map.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Task Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Task Type</span>
                  <Badge variant="outline" className="capitalize h-5">{request.task_type?.replace('_', ' ')}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium">{request.model_used || "Unknown"}</span>
                </div>
                {request.detective_enabled && (
                  <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 space-y-2">
                    <p className="font-bold text-[10px] text-primary uppercase tracking-widest">Detective Loop Data</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hops</span>
                      <span className="font-medium">{request.retrieval_hops}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Symbols</span>
                      <span className="font-medium">{request.symbols_extracted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Added Spans</span>
                      <span className="font-medium">{request.expanded_chunks_added}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatusBox({ label, value, sub, icon, status }: { label: string, value: string | number, sub: string, icon?: React.ReactNode, status?: 'success' | 'error' | 'default' }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <div className={`text-lg font-bold ${status === 'success' ? 'text-green-500' : status === 'error' ? 'text-red-500' : ''}`}>{value}</div>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
