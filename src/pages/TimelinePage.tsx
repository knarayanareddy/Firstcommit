import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useMilestones, PHASE_LABELS, PHASE_ORDER, MilestonePhase, MilestoneStatus } from "@/hooks/useMilestones";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, CheckCircle2, Circle, Clock, Plus, Trash2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP_TOOLTIPS } from "@/data/help-tooltips";

const STATUS_ICON: Record<MilestoneStatus, typeof CheckCircle2> = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
  overdue: AlertTriangle,
};

const STATUS_COLOR: Record<MilestoneStatus, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-primary",
  completed: "text-primary",
  overdue: "text-destructive",
};

export default function TimelinePage() {
  const { milestones, milestonesLoading, addMilestone, deleteMilestone, updateProgress, getStatus, completedCount, totalCount } = useMilestones();
  const { hasPackPermission } = useRole();
  const isAdmin = hasPackPermission("admin");
  const [addOpen, setAddOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPhase, setFormPhase] = useState<MilestonePhase>("week_1");

  const grouped = useMemo(() => {
    const map = new Map<MilestonePhase, typeof milestones>();
    for (const phase of PHASE_ORDER) map.set(phase, []);
    for (const m of milestones) {
      const list = map.get(m.phase as MilestonePhase) ?? [];
      list.push(m);
      map.set(m.phase as MilestonePhase, list);
    }
    return map;
  }, [milestones]);

  const handleAdd = () => {
    if (!formTitle.trim()) { toast.error("Title required"); return; }
    addMilestone.mutate(
      { title: formTitle.trim(), description: formDesc.trim() || null, phase: formPhase, sort_order: milestones.length } as any,
      { onSuccess: () => { toast.success("Milestone added"); setAddOpen(false); setFormTitle(""); setFormDesc(""); } }
    );
  };

  const handleToggle = (milestoneId: string) => {
    const current = getStatus(milestoneId);
    const next: MilestoneStatus = current === "completed" ? "pending" : "completed";
    updateProgress.mutate({ milestoneId, status: next });
  };

  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between" data-tour="timeline-header">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" /> My Timeline
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              {completedCount}/{totalCount} milestones completed ({pct}%)
              <HelpTooltip content={HELP_TOOLTIPS.timeline.milestoneStatus} />
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Add Milestone
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>

        {milestonesLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading timeline...</div>
        ) : totalCount === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No milestones configured yet.
            {isAdmin && " Add milestones to create the onboarding timeline."}
          </div>
        ) : (
          <div className="space-y-8">
            {PHASE_ORDER.map(phase => {
              const items = grouped.get(phase) ?? [];
              if (items.length === 0) return null;
              return (
                <section key={phase}>
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-primary/60" />
                    {PHASE_LABELS[phase]}
                    <Badge variant="outline" className="text-[10px] ml-2">{items.filter(m => getStatus(m.id) === "completed").length}/{items.length}</Badge>
                  </h2>
                  <div className="space-y-2 pl-4 border-l-2 border-border">
                    {items.map((m, i) => {
                      const status = getStatus(m.id);
                      const StatusIcon = STATUS_ICON[status];
                      return (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          data-tour={i === 0 ? "timeline-entry" : undefined}
                          className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                            status === "completed" ? "bg-primary/5" : "bg-card border border-border"
                          }`}
                        >
                          <button onClick={() => handleToggle(m.id)} className="mt-0.5 shrink-0">
                            <StatusIcon className={`w-5 h-5 ${STATUS_COLOR[status]}`} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${status === "completed" ? "line-through text-muted-foreground" : "text-card-foreground"}`}>
                              {m.title}
                            </p>
                            {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                            {m.is_required && <Badge variant="outline" className="text-[9px] mt-1">Required</Badge>}
                          </div>
                          {isAdmin && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive shrink-0"
                              onClick={() => deleteMilestone.mutate(m.id, { onSuccess: () => toast.success("Removed") })}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Add Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title *" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              <Textarea placeholder="Description (optional)" value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2} />
              <Select value={formPhase} onValueChange={v => setFormPhase(v as MilestonePhase)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PHASE_ORDER.map(p => <SelectItem key={p} value={p}>{PHASE_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleAdd} className="w-full" disabled={addMilestone.isPending}>Add Milestone</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
