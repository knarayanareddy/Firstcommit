import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useContentFeedback, ContentFeedbackRow } from "@/hooks/useContentFeedback";
import { useChatFeedback, CHAT_FEEDBACK_REASON_LABELS } from "@/hooks/useChatFeedback";
import { useGeneratedModules } from "@/hooks/useGeneratedModules";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Flag, ThumbsUp, ThumbsDown, Star, Filter, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const feedbackTypeLabels: Record<string, { label: string; icon: string }> = {
  thumbs_up: { label: "Helpful", icon: "👍" },
  thumbs_down: { label: "Not helpful", icon: "👎" },
  confusing: { label: "Confusing", icon: "🤔" },
  outdated: { label: "Outdated", icon: "📅" },
  incorrect: { label: "Incorrect", icon: "❌" },
  missing_context: { label: "Missing context", icon: "🔍" },
};

type Tab = "content" | "chat";

export default function FeedbackPage() {
  const { packFeedback, packRatings, resolveFeedback } = useContentFeedback();
  const { packChatFeedback, resolveChatFeedback, isLoadingPackFeedback } = useChatFeedback();
  const { modules: generated } = useGeneratedModules();
  const { hasPackPermission } = useRole();
  const [filterResolved, setFilterResolved] = useState(false);
  const [tab, setTab] = useState<Tab>("content");

  const flagged = useMemo(() =>
    packFeedback.filter(f =>
      !["thumbs_up", "thumbs_down"].includes(f.feedback_type) &&
      (filterResolved ? true : !f.is_resolved)
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [packFeedback, filterResolved]
  );

  const chatReports = useMemo(() =>
    packChatFeedback.filter(f => filterResolved ? true : !f.is_resolved),
    [packChatFeedback, filterResolved]
  );

  const moduleStats = useMemo(() => {
    const map = new Map<string, { up: number; down: number; flags: number; avgRating: number | null }>();
    for (const mod of generated) {
      const up = packFeedback.filter(f => f.module_key === mod.module_key && f.feedback_type === "thumbs_up").length;
      const down = packFeedback.filter(f => f.module_key === mod.module_key && f.feedback_type === "thumbs_down").length;
      const flags = packFeedback.filter(f => f.module_key === mod.module_key && !["thumbs_up", "thumbs_down"].includes(f.feedback_type) && !f.is_resolved).length;
      const ratings = packRatings.filter(r => r.module_key === mod.module_key && !r.section_id);
      const avgRating = ratings.length ? Math.round(ratings.reduce((s, r) => s + r.rating, 0) / ratings.length * 10) / 10 : null;
      map.set(mod.module_key, { up, down, flags, avgRating });
    }
    return map;
  }, [generated, packFeedback, packRatings]);

  const handleResolve = (id: string) => {
    resolveFeedback.mutate(id, { onSuccess: () => toast.success("Marked as resolved") });
  };

  const handleResolveChatFeedback = (id: string) => {
    resolveChatFeedback.mutate(id, { onSuccess: () => toast.success("Chat report resolved") });
  };

  if (!hasPackPermission("author")) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">You need author access to view feedback.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div data-tour="feedback-header">
          <h1 className="text-2xl font-bold text-foreground">Feedback</h1>
          <p className="text-sm text-muted-foreground mt-1">Review learner feedback and chat reports across all modules.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border" data-tour="feedback-tabs">
          <button
            onClick={() => setTab("content")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === "content"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Content Feedback
            {flagged.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 text-[10px] font-medium">
                {flagged.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("chat")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              tab === "chat"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat Reports
            {chatReports.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-600 text-[10px] font-medium">
                {chatReports.length}
              </span>
            )}
          </button>
        </div>

        {tab === "content" && (
          <div className="space-y-8">
            {/* Module Rating Overview */}
            <section className="space-y-3" data-tour="feedback-module-ratings">
              <h2 className="text-lg font-semibold text-foreground">Module Ratings</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {generated.map(mod => {
                  const stats = moduleStats.get(mod.module_key);
                  if (!stats) return null;
                  return (
                    <motion.div
                      key={mod.module_key}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-border rounded-xl p-4 space-y-2"
                    >
                      <h3 className="text-sm font-medium text-card-foreground truncate">{mod.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {stats.avgRating !== null && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {stats.avgRating}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3 text-primary" /> {stats.up}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsDown className="w-3 h-3 text-destructive" /> {stats.down}
                        </span>
                        {stats.flags > 0 && (
                          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                            <Flag className="w-2.5 h-2.5 mr-1" /> {stats.flags}
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            {/* Flagged Content */}
            <section className="space-y-3" data-tour="feedback-flagged">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  Flagged Content ({flagged.length})
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setFilterResolved(!filterResolved)}>
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  {filterResolved ? "Hide resolved" : "Show resolved"}
                </Button>
              </div>
              {flagged.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">No flagged content 🎉</div>
              ) : (
                <div className="space-y-2">
                  {flagged.map(f => {
                    const mod = generated.find(m => m.module_key === f.module_key);
                    const meta = feedbackTypeLabels[f.feedback_type] ?? { label: f.feedback_type, icon: "🏷️" };
                    return (
                      <div key={f.id} className={`bg-card border rounded-lg p-4 flex items-start gap-3 ${f.is_resolved ? "opacity-50" : "border-border"}`}>
                        <span className="text-lg">{meta.icon}</span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-foreground">{meta.label}</span>
                            <span className="text-[10px] text-muted-foreground">in {mod?.title ?? f.module_key}</span>
                            {f.section_id && <span className="text-[10px] text-muted-foreground">§ {f.section_id}</span>}
                          </div>
                          {f.comment && <p className="text-xs text-muted-foreground">{f.comment}</p>}
                          <span className="text-[10px] text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</span>
                        </div>
                        {!f.is_resolved && (
                          <Button variant="ghost" size="sm" onClick={() => handleResolve(f.id)} className="shrink-0">
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Resolve
                          </Button>
                        )}
                        {f.is_resolved && (
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30 shrink-0">Resolved</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "chat" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Chat Reports ({chatReports.length})
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setFilterResolved(!filterResolved)}>
                <Filter className="w-3.5 h-3.5 mr-1" />
                {filterResolved ? "Hide resolved" : "Show resolved"}
              </Button>
            </div>
            {isLoadingPackFeedback ? (
              <div className="text-center py-10 text-muted-foreground text-sm">Loading…</div>
            ) : chatReports.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No chat reports 🎉</div>
            ) : (
              <div className="space-y-2">
                {chatReports.map(f => {
                  const meta = CHAT_FEEDBACK_REASON_LABELS[f.reason] ?? { label: f.reason, icon: "🏷️" };
                  return (
                    <div key={f.id} className={`bg-card border rounded-lg p-4 flex items-start gap-3 ${f.is_resolved ? "opacity-50" : "border-border"}`}>
                      <span className="text-lg">{meta.icon}</span>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-foreground">{meta.label}</span>
                          {f.module_id && (
                            <Badge variant="outline" className="text-[10px]">
                              {f.module_id === "__mission_control__" ? "Mission Control" : f.module_id}
                            </Badge>
                          )}
                          {f.create_task && (
                            <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-500/30">
                              Task requested
                            </Badge>
                          )}
                        </div>
                        {/* Message preview */}
                        <p className="text-[11px] text-muted-foreground bg-muted rounded px-2 py-1 line-clamp-2">
                          {f.message_content}
                        </p>
                        {f.comment && <p className="text-xs text-muted-foreground italic">"{f.comment}"</p>}
                        <span className="text-[10px] text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</span>
                      </div>
                      {!f.is_resolved && (
                        <Button variant="ghost" size="sm" onClick={() => handleResolveChatFeedback(f.id)} className="shrink-0">
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Resolve
                        </Button>
                      )}
                      {f.is_resolved && (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30 shrink-0">Resolved</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
