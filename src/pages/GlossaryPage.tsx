import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { glossaryTerms } from "@/data/glossary-data";
import { TrackBadge } from "@/components/TrackBadge";
import { CitationBadge } from "@/components/CitationBadge";
import { AIErrorDisplay } from "@/components/AIErrorDisplay";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { useGeneratedGlossary, GlossaryTerm } from "@/hooks/useGeneratedGlossary";
import { useManualGlossary } from "@/hooks/useManualGlossary";
import { useRole } from "@/hooks/useRole";
import { usePackTracks } from "@/hooks/usePackTracks";
import { AIError } from "@/lib/ai-errors";
import { Search, BookText, Sparkles, RotateCcw, Loader2, Code, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BookmarkButton } from "@/components/BookmarkButton";
import { SaveAsGlossaryDialog } from "@/components/SaveAsGlossaryDialog";
import { toast } from "sonner";

const DENSITY_OPTIONS = [
  { key: "low", label: "Low", desc: "Essential terms only" },
  { key: "standard", label: "Standard", desc: "Common terms" },
  { key: "high", label: "High", desc: "Comprehensive" },
] as const;

export default function GlossaryPage() {
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [density, setDensity] = useState<string>("standard");
  const [genError, setGenError] = useState<AIError | null>(null);
  const [addTermOpen, setAddTermOpen] = useState(false);

  const { glossary: generatedGlossary, glossaryLoading, generateGlossary } = useGeneratedGlossary();
  const { manualTerms, manualTermsLoading, deleteTerm } = useManualGlossary();
  const { hasPackPermission } = useRole();
  const { tracks: packTracks } = usePackTracks();

  const isGenerated = !!generatedGlossary?.glossary_data?.length;
  const generatedTerms: GlossaryTerm[] = generatedGlossary?.glossary_data || [];

  const filteredGenerated = useMemo(() => {
    if (!isGenerated) return [];
    return generatedTerms
      .filter((t) => {
        const matchesSearch =
          !search ||
          t.term.toLowerCase().includes(search.toLowerCase()) ||
          t.definition.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
      })
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [generatedTerms, search, isGenerated]);

  const filteredStatic = useMemo(() => {
    if (isGenerated) return [];
    return glossaryTerms
      .filter((t) => {
        const matchesSearch =
          !search ||
          t.term.toLowerCase().includes(search.toLowerCase()) ||
          t.definition.toLowerCase().includes(search.toLowerCase());
        const matchesTrack = trackFilter === "all" || t.tracks.includes(trackFilter as any);
        return matchesSearch && matchesTrack;
      })
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [search, trackFilter, isGenerated]);

  const filteredManual = useMemo(() => {
    return manualTerms
      .filter((t) => {
        return !search ||
          t.term.toLowerCase().includes(search.toLowerCase()) ||
          t.definition.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [search, manualTerms]);

  const handleGenerate = () => {
    setGenError(null);
    generateGlossary.mutate(
      { density },
      {
        onSuccess: () => toast.success("Glossary generated!"),
        onError: (e) => {
          if (e instanceof AIError) setGenError(e);
          else toast.error(e.message);
        },
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <BookText className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Glossary</h1>
              {isGenerated && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Generated
                </span>
              )}
            </div>
            {hasPackPermission("author") && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddTermOpen(true)}
                  className="gap-1.5 text-xs h-8"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Term
                </Button>
                <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
                <div className="flex items-center bg-muted rounded-lg border border-border p-0.5">
                  {DENSITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setDensity(opt.key)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        density === opt.key
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title={opt.desc}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={generateGlossary.isPending}
                  className="gap-2 text-xs"
                >
                  {generateGlossary.isPending ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                  ) : (
                    <><RotateCcw className="w-3 h-3" /> {isGenerated ? "Regenerate" : "Generate"}</>
                  )}
                </Button>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Key terms and definitions used across the codebase and team.
            {isGenerated && generatedGlossary && (
              <span className="ml-2 text-xs text-muted-foreground/70">
                Generated {new Date(generatedGlossary.created_at).toLocaleDateString()} · {generatedGlossary.glossary_density || "standard"} density
              </span>
            )}
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6" data-tour="glossary-search">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search terms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          {!isGenerated && packTracks.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap" data-tour="glossary-track-filter">
              <button
                onClick={() => setTrackFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  trackFilter === "all" ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"
                }`}
              >
                All
              </button>
              {packTracks.map((t) => (
                <button key={t.track_key} onClick={() => setTrackFilter(t.track_key)} className={`transition-opacity ${trackFilter !== "all" && trackFilter !== t.track_key ? "opacity-40" : ""}`}>
                  <TrackBadge track={t.track_key} title={t.title} />
                </button>
              ))}
            </div>
          )}
        </div>

        {genError && (
          <div className="mb-6">
            <AIErrorDisplay error={genError} onRetry={handleGenerate} />
          </div>
        )}

        {glossaryLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading glossary...</div>
        ) : isGenerated ? (
          <div className="space-y-3" data-tour="glossary-term">
            {filteredGenerated.map((term, i) => (
              <motion.div
                key={term.term}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-card-foreground font-mono text-sm">{term.term}</h3>
                    <BookmarkButton
                      type="glossary_term"
                      referenceKey={`term:${term.term}`}
                      label={term.term}
                      previewText={term.definition?.slice(0, 100)}
                    />
                    {term.context && term.context.includes("```") && (
                      <Code className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{term.definition}</p>
                  {term.context && (
                    <div className="text-xs text-muted-foreground/70 mt-2 italic">
                      {term.context.includes("```") ? (
                        <MarkdownRenderer className="prose-xs">{term.context}</MarkdownRenderer>
                      ) : (
                        <p>{term.context}</p>
                      )}
                    </div>
                  )}
                  {term.citations && term.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/50">
                      {term.citations.map((c) => (
                        <CitationBadge key={c.span_id} spanId={c.span_id} path={c.path} chunkId={c.chunk_id} />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {filteredGenerated.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No terms match your search.</div>
            )}
          </div>
        ) : (
          <div className="space-y-3" data-tour="glossary-term">
            {filteredStatic.map((term, i) => (
              <motion.div
                key={term.term}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-card-foreground font-mono text-sm">{term.term}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{term.definition}</p>
                    <p className="text-xs text-muted-foreground/70 mt-2 italic">{term.context}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {term.tracks.map((t) => (
                      <TrackBadge key={t} track={t} />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
            {filteredStatic.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No terms match your search.</div>
            )}
          </div>
        )}

        {/* ── Manual Terms Section ── */}
        {(filteredManual.length > 0 || (search === "" && hasPackPermission("author"))) && (
          <div className="mt-12">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <BookText className="w-5 h-5 text-primary" /> Team Definitions
            </h2>
            <div className="space-y-3">
              <AnimatePresence>
                {filteredManual.map((term, i) => (
                  <motion.div
                    key={term.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-card border border-primary/20 rounded-xl p-5 hover:border-primary/40 transition-colors group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {hasPackPermission("author") && (
                        <button
                          onClick={() => deleteTerm.mutate(term.id)}
                          className="p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                          title="Delete term"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 pr-8">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-card-foreground font-mono text-sm">{term.term}</h3>
                        <BookmarkButton
                          type="glossary_term"
                          referenceKey={`manual_term:${term.id}`}
                          label={term.term}
                          previewText={term.definition?.slice(0, 100)}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{term.definition}</p>
                      {term.context && (
                        <div className="text-xs text-muted-foreground/70 mt-2 italic">
                          {term.context.includes("```") ? (
                            <MarkdownRenderer className="prose-xs">{term.context}</MarkdownRenderer>
                          ) : (
                            <p>{term.context}</p>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-3">
                        <span className="text-[10px] font-mono text-muted-foreground/60">added manually</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredManual.length === 0 && search === "" && hasPackPermission("author") && (
                <div className="text-center py-6 border border-dashed border-border rounded-xl">
                  <p className="text-sm text-muted-foreground mb-3">No manual terms added yet.</p>
                  <Button size="sm" variant="outline" onClick={() => setAddTermOpen(true)} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Term
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      <SaveAsGlossaryDialog
        open={addTermOpen}
        onClose={() => setAddTermOpen(false)}
        source="manual"
      />
    </DashboardLayout>
  );
}
