import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useFaqSuggestions } from "@/hooks/useFaqSuggestions";
import { useFaqEntries } from "@/hooks/useFaqEntries";
import { SaveAsFaqDialog } from "@/components/SaveAsFaqDialog";
import { SaveAsGlossaryDialog } from "@/components/SaveAsGlossaryDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, ChevronDown, ChevronUp, CheckCheck, X, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";

export default function FaqSuggestionsPage() {
  const { packId } = useParams();
  const navigate = useNavigate();
  const { suggestions, suggestionsLoading, dismissSuggestion, markConverted } = useFaqSuggestions();
  const { createFaqEntry } = useFaqEntries();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [faqDialog, setFaqDialog] = useState<{ open: boolean; suggestion?: typeof suggestions[0] }>({ open: false });
  const [glossaryDialog, setGlossaryDialog] = useState<{ open: boolean; suggestion?: typeof suggestions[0] }>({ open: false });

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between" data-tour="suggestions-header">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Lightbulb className="w-6 h-6 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">FAQ Suggestions</h1>
                {suggestions.length > 0 && (
                  <Badge className="gradient-primary border-0 text-xs">{suggestions.length} open</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Repeated questions detected from chat and discussions. Convert them into durable FAQ entries or glossary terms.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate(`/packs/${packId}/faq`)}>
              <HelpCircle className="w-3.5 h-3.5 mr-1.5" /> View FAQ
            </Button>
          </div>
        </motion.div>

        {/* Suggestion list */}
        {suggestionsLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading suggestions…</div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Lightbulb className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">No repeated questions detected yet.</p>
            <p className="text-xs text-muted-foreground/60">
              As users ask similar questions in chat or discussions, they'll cluster here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: i * 0.03 }}
                data-tour={i === 0 ? "suggestion-card" : undefined}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                {/* Main row */}
                <div className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.canonical_question}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Asked <span className="font-semibold text-foreground">{s.count}×</span> · Last seen {new Date(s.last_seen_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      data-tour={i === 0 ? "convert-faq-button" : undefined}
                      size="sm"
                      className="h-7 text-xs gradient-primary border-0 gap-1"
                      onClick={() => setFaqDialog({ open: true, suggestion: s })}
                    >
                      <CheckCheck className="w-3 h-3" /> Convert to FAQ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setGlossaryDialog({ open: true, suggestion: s })}
                    >
                      Save as Glossary
                    </Button>
                    <button
                      onClick={async () => {
                        await dismissSuggestion.mutateAsync(s.id);
                        toast.success("Suggestion dismissed.");
                      }}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                    >
                      {expandedId === s.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Examples panel */}
                <AnimatePresence>
                  {expandedId === s.id && s.example_questions.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border/50 bg-muted/20 px-4 py-3"
                    >
                      <p className="text-xs font-medium text-muted-foreground mb-2">Example questions from users:</p>
                      <ul className="space-y-1">
                        {s.example_questions.slice(0, 5).map((q, qi) => (
                          <li key={qi} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-primary/50 mt-0.5">›</span> {q}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Convert to FAQ dialog */}
      <SaveAsFaqDialog
        open={faqDialog.open}
        onClose={() => setFaqDialog({ open: false })}
        initialQuestion={faqDialog.suggestion?.canonical_question ?? ""}
        source="chat"
        onConverted={async (faqId) => {
          if (faqDialog.suggestion) {
            await markConverted.mutateAsync({ id: faqDialog.suggestion.id, faqId });
          }
        }}
      />

      {/* Save as Glossary dialog */}
      <SaveAsGlossaryDialog
        open={glossaryDialog.open}
        onClose={() => setGlossaryDialog({ open: false })}
        initialTerm={glossaryDialog.suggestion?.canonical_question ?? ""}
        source="chat"
      />
    </DashboardLayout>
  );
}
