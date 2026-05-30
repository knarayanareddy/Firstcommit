import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useContentFreshness } from "@/hooks/useContentFreshness";
import { useGeneratedModules } from "@/hooks/useGeneratedModules";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP_TOOLTIPS } from "@/data/help-tooltips";

export default function ContentHealthPage() {
  const { freshness, staleCount, freshPct, totalSections, checkStaleness, isLoading } = useContentFreshness();
  const { modules } = useGeneratedModules();
  const { hasPackPermission } = useRole();

  if (!hasPackPermission("author")) {
    return <DashboardLayout><div className="text-center py-20 text-muted-foreground">Author access required.</div></DashboardLayout>;
  }

  const staleItems = freshness.filter(f => f.is_stale);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between" data-tour="health-header">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" /> Content Health
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              {freshPct}% fresh • {staleCount} stale section{staleCount !== 1 ? "s" : ""} of {totalSections}
              <HelpTooltip content={HELP_TOOLTIPS.contentHealth.freshnessScore} />
            </p>
          </div>
          <Button size="sm" onClick={() => checkStaleness.mutate(undefined, { onSuccess: () => toast.success("Staleness check complete") })}
            disabled={checkStaleness.isPending} className="gap-2">
            {checkStaleness.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Check Now
          </Button>
        </div>

        {/* Health bar */}
        <div className="h-3 bg-muted rounded-full overflow-hidden flex">
          <div className="h-full bg-primary transition-all" style={{ width: `${freshPct}%` }} />
          {staleCount > 0 && <div className="h-full bg-destructive/60 transition-all" style={{ width: `${100 - freshPct}%` }} />}
        </div>

        {/* Module health overview */}
        <section className="space-y-3" data-tour="health-card">
          <h2 className="text-lg font-semibold text-foreground">Module Overview</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {modules.map(mod => {
              const sections = freshness.filter(f => f.module_key === mod.module_key);
              const stale = sections.filter(f => f.is_stale).length;
              const total = sections.length;
              const color = stale === 0 ? "text-primary" : stale <= 2 ? "text-amber-500" : "text-destructive";
              return (
                <motion.div key={mod.module_key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-card-foreground truncate">{mod.title}</h3>
                    {stale === 0 ? <CheckCircle2 className={`w-4 h-4 ${color}`} /> : <AlertTriangle className={`w-4 h-4 ${color}`} />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {total === 0 ? "Not tracked" : stale === 0 ? "All sections fresh" : `${stale}/${total} sections stale`}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Stale sections */}
        {staleItems.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Stale Sections ({staleItems.length})</h2>
            <div className="space-y-2">
              {staleItems.map(f => {
                const mod = modules.find(m => m.module_key === f.module_key);
                return (
                  <div key={f.id} className="bg-card border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                    <HelpTooltip content={HELP_TOOLTIPS.contentHealth.staleContent} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-card-foreground">{mod?.title ?? f.module_key} › {f.section_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.referenced_chunk_ids.length} referenced chunk{f.referenced_chunk_ids.length !== 1 ? "s" : ""} changed
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Stale</Badge>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {isLoading && <div className="text-center py-12 text-muted-foreground">Loading health data...</div>}
        {!isLoading && totalSections === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No content freshness data yet. Generate modules first, then run a staleness check.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
