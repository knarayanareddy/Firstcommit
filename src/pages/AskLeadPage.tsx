import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { askLeadQuestions } from "@/data/ask-lead-data";
import { TrackBadge } from "@/components/TrackBadge";
import { CitationBadge } from "@/components/CitationBadge";
import { AIErrorDisplay } from "@/components/AIErrorDisplay";
import { useGeneratedAskLead, GeneratedAskLeadQuestion } from "@/hooks/useGeneratedAskLead";
import { useAskLeadProgress } from "@/hooks/useAskLeadProgress";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { usePackTracks } from "@/hooks/usePackTracks";
import { AIError } from "@/lib/ai-errors";
import { MessageSquareMore, CheckCircle2, Circle, Sparkles, RotateCcw, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BookmarkButton } from "@/components/BookmarkButton";
import { toast } from "sonner";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "team", label: "🏠 Team" },
  { key: "technical", label: "⚙️ Technical" },
  { key: "process", label: "📋 Process" },
  { key: "culture", label: "🤝 Culture" },
] as const;

export default function AskLeadPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [genError, setGenError] = useState<AIError | null>(null);

  const { askLead, askLeadLoading, generateAskLead } = useGeneratedAskLead();
  const { askedQuestions, toggleQuestion } = useAskLeadProgress();
  const { hasPackPermission } = useRole();
  const { user } = useAuth();
  const { tracks: packTracks } = usePackTracks();

  const isGenerated = !!askLead?.questions_data?.length;
  const generatedQuestions: GeneratedAskLeadQuestion[] = askLead?.questions_data || [];

  const filteredGenerated = useMemo(() => {
    if (!isGenerated) return [];
    return generatedQuestions.filter((q) => {
      const matchTrack = trackFilter === "all" || !q.track_key || q.track_key === trackFilter;
      return matchTrack;
    });
  }, [generatedQuestions, trackFilter, isGenerated]);

  const filteredStatic = useMemo(() => {
    if (isGenerated) return [];
    return askLeadQuestions.filter((q) => {
      const matchCat = categoryFilter === "all" || q.category === categoryFilter;
      const matchTrack = trackFilter === "all" || !q.track_key || q.track_key === trackFilter;
      return matchCat && matchTrack;
    });
  }, [categoryFilter, trackFilter, isGenerated]);

  const totalQuestions = isGenerated ? generatedQuestions.length : askLeadQuestions.length;

  const handleGenerate = () => {
    setGenError(null);
    generateAskLead.mutate(undefined, {
      onSuccess: () => toast.success("Questions generated!"),
      onError: (e) => {
        if (e instanceof AIError) setGenError(e);
        else toast.error(e.message);
      },
    });
  };

  // Derive track list from pack tracks or from data
  const trackButtons = packTracks.length > 0
    ? packTracks.map((t) => ({ key: t.track_key, title: t.title }))
    : [];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between mb-2" data-tour="ask-lead-header">
            <div className="flex items-center gap-3">
              <MessageSquareMore className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Ask Your Lead</h1>
              {isGenerated && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Generated
                </span>
              )}
            </div>
            {hasPackPermission("author") && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerate}
                disabled={generateAskLead.isPending}
                className="gap-2 text-xs"
              >
                {generateAskLead.isPending ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                ) : (
                  <><RotateCcw className="w-3 h-3" /> {isGenerated ? "Regenerate" : "Generate"}</>
                )}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            High-signal questions to ask your team lead during your first 1:1s. Check them off as you go.
            {isGenerated && askLead && (
              <span className="ml-2 text-xs text-muted-foreground/70">
                Generated {new Date(askLead.created_at).toLocaleDateString()}
              </span>
            )}
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6" data-tour="ask-lead-category-filter">
          {!isGenerated && (
            <div className="flex items-center gap-2 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategoryFilter(c.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    categoryFilter === c.key ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          {trackButtons.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setTrackFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  trackFilter === "all" ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"
                }`}
              >
                All Tracks
              </button>
              {trackButtons.map((t) => (
                <button key={t.key} onClick={() => setTrackFilter(t.key)} className={`transition-opacity ${trackFilter !== "all" && trackFilter !== t.key ? "opacity-40" : ""}`}>
                  <TrackBadge track={t.key} title={t.title} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground mb-4" data-tour="ask-lead-progress">
          {askedQuestions.size}/{totalQuestions} questions asked
        </div>

        {genError && (
          <div className="mb-6">
            <AIErrorDisplay error={genError} onRetry={handleGenerate} />
          </div>
        )}

        {askLeadLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading questions...</div>
        ) : isGenerated ? (
          <div className="space-y-3">
            {filteredGenerated.map((q, i) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                data-tour={i === 0 ? "ask-lead-question" : undefined}
                className={`bg-card border rounded-xl p-5 transition-all ${askedQuestions.has(q.id) ? "border-primary/20 bg-card/50" : "border-border"}`}
              >
                <div className="flex items-start gap-3">
                  <button onClick={() => { if (user) toggleQuestion.mutate(q.id); }} className="mt-0.5 shrink-0">
                    {askedQuestions.has(q.id) ? (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${askedQuestions.has(q.id) ? "text-muted-foreground" : "text-card-foreground"}`}>
                        {q.question}
                      </p>
                      <BookmarkButton
                        type="ask_lead_question"
                        referenceKey={q.id}
                        label={q.question}
                        previewText={q.why_it_matters?.slice(0, 100)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{q.why_it_matters}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {q.track_key && <TrackBadge track={q.track_key} />}
                      {q.citations && q.citations.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {q.citations.map((c) => (
                            <CitationBadge key={c.span_id} spanId={c.span_id} path={c.path} chunkId={c.chunk_id} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {filteredGenerated.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No questions match your filters.</div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStatic.map((q, i) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                data-tour={i === 0 ? "ask-lead-question" : undefined}
                className={`bg-card border rounded-xl p-5 transition-all ${askedQuestions.has(q.id) ? "border-primary/20 bg-card/50" : "border-border"}`}
              >
                <div className="flex items-start gap-3">
                  <button onClick={() => { if (user) toggleQuestion.mutate(q.id); }} className="mt-0.5 shrink-0">
                    {askedQuestions.has(q.id) ? (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                    )}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${askedQuestions.has(q.id) ? "text-muted-foreground" : "text-card-foreground"}`}>
                      {q.question}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{q.why_it_matters}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{q.category}</span>
                      {q.track_key && <TrackBadge track={q.track_key} />}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {filteredStatic.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No questions match your filters.</div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
