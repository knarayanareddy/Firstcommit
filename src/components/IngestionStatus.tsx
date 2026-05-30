import { Loader2, CheckCircle2, AlertTriangle, Clock, X } from "lucide-react";
import { useIngestion } from "@/hooks/useIngestion";
import { useRole } from "@/hooks/useRole";

export function IngestionStatus() {
  const { jobs, hasActiveJob, cancelIngestion, deleteJob, resetStuckJobs } = useIngestion();
  const { hasPackPermission } = useRole();
  const isAuthor = hasPackPermission("author");

  const activeJobs = jobs.filter((j) => j.status === "pending" || j.status === "processing");
  const recentCompleted = jobs.filter((j) => j.status === "completed").slice(0, 3);
  const recentFailed = jobs.filter((j) => j.status === "failed").slice(0, 2);

  if (!hasActiveJob && recentCompleted.length === 0 && recentFailed.length === 0) return null;

  return (
    <div className="space-y-2">
      {activeJobs.map((job) => {
        const progress = job.total_chunks > 0
          ? Math.min(100, Math.round((job.processed_chunks / job.total_chunks) * 100))
          : 0;

        const lastHeartbeat = job.last_heartbeat_at ? new Date(job.last_heartbeat_at) : null;
        const isStalled = lastHeartbeat && (Date.now() - lastHeartbeat.getTime() > 10 * 60 * 1000);

        return (
          <div key={job.id} className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              {job.status === "processing" ? (
                <Loader2 className={`w-3.5 h-3.5 ${isStalled ? 'text-warning' : 'text-primary'} animate-spin`} />
              ) : (
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-foreground capitalize">
                {isStalled ? "Stalled" : job.status}
              </span>
              
              <div className="flex gap-2 ml-2">
                <button
                  onClick={() => cancelIngestion.mutate(job.id)}
                  disabled={cancelIngestion.isPending}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-destructive/30 text-destructive/80 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  {cancelIngestion.isPending ? "Stopping..." : "Stop"}
                </button>
                {isStalled && isAuthor && (
                  <button
                    onClick={() => resetStuckJobs.mutate({ sourceId: job.source_id })}
                    disabled={resetStuckJobs.isPending}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-warning/30 text-warning hover:bg-warning/10 transition-colors disabled:opacity-50"
                  >
                    {resetStuckJobs.isPending ? "Resetting..." : "Reset"}
                  </button>
                )}
              </div>

              <span className="text-xs text-muted-foreground ml-auto">
                {Math.min(job.processed_chunks, job.total_chunks)}/{job.total_chunks}
              </span>
            </div>
            {job.phase && (
              <div className="text-[10px] text-muted-foreground mb-1 truncate">
                Phase: {job.phase} {job.current_file ? `(${job.current_file})` : ""}
              </div>
            )}
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${isStalled ? 'bg-warning' : 'gradient-primary'} transition-all duration-300 rounded-full`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      })}

      {recentFailed.map((job) => (
        <div key={job.id} className="flex items-center justify-between gap-2 text-xs bg-destructive/10 text-destructive rounded-lg px-3 py-2 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Ingestion failed{job.error_message ? `: ${job.error_message}` : ""}</span>
          </div>
          <button
            onClick={() => deleteJob.mutate(job.id)}
            className="hover:bg-destructive/10 rounded p-0.5 transition-colors"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
