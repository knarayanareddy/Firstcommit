import { DashboardLayout } from "@/components/DashboardLayout";
import { usePack } from "@/hooks/usePack";
import { useTrustSummary, useTrustTimeSeries, useLatestRequests, useIngestionSummary } from "@/hooks/useTrustData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCcw, 
  Clock, 
  Search, 
  FileText, 
  Activity,
  ArrowUpRight,
  Database,
  MessageSquare,
  ChevronRight,
  Filter
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar
} from "recharts";
import { format } from "date-fns";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { LifecycleHealthPanel } from "@/components/trust/LifecycleHealthPanel";
import { AiAuditLogPanel } from "@/components/trust/AiAuditLogPanel";
// Import hook for freshness queue
import { useFreshnessQueueSummary } from "@/hooks/useTrustData";

export default function TrustDashboard() {
  const { packId } = useParams<{ packId: string }>();
  const [days, setDays] = useState(7);
  const [useRaw, setUseRaw] = useState(false);
  const { currentPack } = usePack();
  
  const { data: summary, isLoading: loadingSummary } = useTrustSummary(packId || "", days, useRaw);
  const { data: timeSeries, isLoading: loadingCharts } = useTrustTimeSeries(packId || "", days, useRaw);
  const { data: requests, isLoading: loadingRequests } = useLatestRequests(packId || "");
  const { data: ingestion } = useIngestionSummary(packId || "");
  const { data: freshnessQueue } = useFreshnessQueueSummary(packId || "");

  if (!packId) return null;

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Trust & Quality Console</h1>
            </div>
            <p className="text-muted-foreground">
              Monitor grounding health, refusal rates, and pipeline performance for <span className="text-foreground font-medium">{currentPack?.title}</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
              <Button
                variant={!useRaw ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setUseRaw(false)}
                className="h-8 px-3 text-xs"
              >
                Rollups (fast)
              </Button>
              <Button
                variant={useRaw ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setUseRaw(true)}
                className="h-8 px-3 text-xs"
              >
                Raw (debug)
              </Button>
            </div>

            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
            {[7, 30, 90].map((d) => (
              <Button
                key={d}
                variant={days === d ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDays(d)}
                className="h-8 px-3 text-xs"
              >
                {d} days
              </Button>
            ))}
          </div>
          </div>
        </div>

        {/* Fallback Banner */}
        {!useRaw && summary && summary.total_requests > 0 && (!timeSeries || timeSeries.length === 0) && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-3 rounded-lg flex items-center gap-3 text-xs"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p>Rollups still generating for this period. Showing partial data or use "Raw (debug)" mode for real-time metrics.</p>
          </motion.div>
        )}

        {/* SLO Health Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Grounding Gate Pass"
            value={`${summary?.pass_rate.toFixed(1)}%`}
            description="Responses meeting SLO"
            icon={<ShieldCheck className="w-4 h-4 text-green-500" />}
            status={summary && summary.pass_rate > 90 ? "success" : "warning"}
          />
          <MetricCard
            title="Refusal Rate"
            value={`${summary?.refusal_rate.toFixed(1)}%`}
            description="Insufficient evidence"
            icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />}
            status={summary && summary.refusal_rate < 5 ? "success" : "warning"}
          />
          <MetricCard
            title="Avg Strip Rate"
            value={`${summary?.avg_strip_rate.toFixed(2)}`}
            description="Unverified claims per req"
            icon={<Activity className="w-4 h-4 text-blue-500" />}
            status={summary && summary.avg_strip_rate < 0.1 ? "success" : "warning"}
          />
          <MetricCard
            title="P95 Latency"
            value={`${(summary?.p95_latency || 0 / 1000).toFixed(1)}s`}
            description="Total request time"
            icon={<Clock className="w-4 h-4 text-purple-500" />}
            status={summary && summary.p95_latency < 10000 ? "success" : "warning"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Charts */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Performance Over Time
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries}>
                  <defs>
                    <linearGradient id="colorPass" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="created_at" 
                    tickFormatter={(val) => format(new Date(val), "MMM d")}
                    fontSize={10}
                    tick={{ fill: 'rgba(255,255,255,0.4)' }}
                  />
                  <YAxis fontSize={10} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #333' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total_latency_ms" 
                    stroke="#8b5cf6" 
                    fillOpacity={0} 
                    strokeWidth={2}
                    name="Latency (ms)"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="strip_rate" 
                    stroke="#10b981" 
                    fill="url(#colorPass)" 
                    strokeWidth={2}
                    name="Strip Rate"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Ingestion & Content Health */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    Ingestion Health
                  </span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tight">Active</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Chunks</span>
                  <span className="font-medium">{ingestion?.total_chunks}</span>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recent Jobs</p>
                  {ingestion?.latest_jobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                      <span className="truncate max-w-[120px]">{job.id.split('-')[0]}</span>
                      <Badge variant={job.status === 'completed' ? 'secondary' : 'outline'} className={`text-[9px] h-4 ${job.status === 'completed' ? 'bg-green-500/10 text-green-500' : ''}`}>
                        {job.status}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="w-full text-xs h-8 gap-2" asChild>
                  <Link to={`/packs/${packId}/ingestion`}>
                    View Ingestion Detail <ChevronRight className="w-3 h-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Content Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-muted-foreground">Unresolved Feedback</span>
                  <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">0</Badge>
                </div>
                <Button variant="ghost" size="sm" className="w-full text-xs h-8 gap-2" asChild>
                  <Link to={`/packs/${packId}/quality/content`}>
                    Review Feedback <ChevronRight className="w-3 h-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4 text-primary" />
                  Universal Freshness Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pending Triggers</span>
                  {freshnessQueue?.pending_count !== undefined ? (
                    <Badge variant={freshnessQueue.pending_count > 0 ? "secondary" : "outline"} className={freshnessQueue.pending_count > 0 ? "bg-blue-500/10 text-blue-500" : ""}>
                      {freshnessQueue.pending_count} pending
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                   <span className="text-muted-foreground">Recent Failures</span>
                   <span className={freshnessQueue?.recent_failures ? "text-red-500 font-medium" : "text-muted-foreground"}>
                     {freshnessQueue?.recent_failures || 0}
                   </span>
                </div>
                <div className="text-[10px] text-muted-foreground pt-2 border-t mt-2">
                  Last processed: {freshnessQueue?.last_processed_at ? format(new Date(freshnessQueue.last_processed_at), "MMM d, HH:mm:ss") : "Never"}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Lifecycle & Retention Health */}
        <section>
          <div className="flex items-center gap-2 mb-4">
             <Database className="w-5 h-5 text-primary" />
             <h2 className="text-lg font-bold">Lifecycle & Retention</h2>
          </div>
          <LifecycleHealthPanel packId={packId} />
        </section>

        {/* AI Governance Audit Log */}
        <section>
          <div className="flex items-center gap-2 mb-4">
             <ShieldCheck className="w-5 h-5 text-primary" />
             <h2 className="text-lg font-bold">AI Governance Audit Log</h2>
          </div>
          <AiAuditLogPanel packId={packId} />
        </section>

        {/* Latest Requests Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Latest AI Requests</CardTitle>
              <CardDescription className="text-xs">Audit every grounding decision</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Filter className="w-3 h-3" /> Filter
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Search className="w-3 h-3" /> Search
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left font-medium py-3 px-4">Time</th>
                    <th className="text-left font-medium py-3 px-4">Task</th>
                    <th className="text-left font-medium py-3 px-4">Outcome</th>
                    <th className="text-right font-medium py-3 px-4">Citations</th>
                    <th className="text-right font-medium py-3 px-4">Strip Rate</th>
                    <th className="text-right font-medium py-3 px-4">Latency</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {requests?.map((req) => (
                    <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group">
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {format(new Date(req.created_at), "HH:mm:ss MMM d")}
                      </td>
                      <td className="py-3 px-4">
                         <Badge variant="outline" className="capitalize text-[10px]">{req.task_type?.replace('_', ' ')}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {req.grounding_gate_passed ? (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-0">Passed</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-0">Refused</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {req.citations_found || 0}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {req.strip_rate?.toFixed(2) || '0.00'}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                        {req.total_latency_ms}ms
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100" asChild>
                          <Link to={`/packs/${packId}/trust/requests/${req.request_id}`}>
                            <ArrowUpRight className="w-4 h-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" className="text-xs">
                Load More
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ title, value, description, icon, status }: { 
  title: string; 
  value: string; 
  description: string; 
  icon: React.ReactNode;
  status: 'success' | 'warning' | 'error';
}) {
  return (
    <Card className={`relative overflow-hidden ${status === 'warning' ? 'border-yellow-500/20' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
          {title}
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-1">{value}</div>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
