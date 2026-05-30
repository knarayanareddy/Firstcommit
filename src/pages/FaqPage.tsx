import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useFaqEntries, FaqEntry } from "@/hooks/useFaqEntries";
import { useRole } from "@/hooks/useRole";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { BookmarkButton } from "@/components/BookmarkButton";
import { SaveAsFaqDialog } from "@/components/SaveAsFaqDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { HelpCircle, Search, Plus, Edit2, Archive, ExternalLink, Lightbulb } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

export default function FaqPage() {
  const { packId } = useParams();
  const navigate = useNavigate();
  const { entries, entriesLoading, archiveFaqEntry } = useFaqEntries();
  const { hasPackPermission } = useRole();
  const isAuthor = hasPackPermission("author");

  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<FaqEntry | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => e.tags?.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const matchesSearch =
        !search ||
        e.question.toLowerCase().includes(search.toLowerCase()) ||
        e.answer_markdown.toLowerCase().includes(search.toLowerCase());
      const matchesTag = !tagFilter || e.tags?.includes(tagFilter);
      return matchesSearch && matchesTag;
    });
  }, [entries, search, tagFilter]);

  const sourceLabel = (s: FaqEntry["source"]) =>
    s === "chat" ? "🤖 From chat" : s === "discussion" ? "💬 From discussion" : "✍️ Manual";

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between" data-tour="faq-header">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <HelpCircle className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">FAQ</h1>
              <Badge variant="secondary" className="text-xs">{entries.length} entries</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Answers to the most common questions — sourced from chat, discussions, and authors.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {isAuthor && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => navigate(`/packs/${packId}/faq-suggestions`)}
                >
                  <Lightbulb className="w-3.5 h-3.5" /> Suggestions
                </Button>
                <Button
                  data-tour="faq-add-button"
                  size="sm"
                  className="gradient-primary border-0 shadow gap-1.5 text-xs"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5" /> Add FAQ
                </Button>
              </>
            )}
          </div>
        </motion.div>

        {/* Search + Tag filters */}
        <div className="space-y-3">
          <div className="relative" data-tour="faq-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search questions and answers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          {allTags.length > 0 && (
            <div className="flex gap-2 flex-wrap" data-tour="faq-tag-filter">
              <button
                onClick={() => setTagFilter(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!tagFilter ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}
              >
                All
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTagFilter(t === tagFilter ? null : t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${tagFilter === t ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Entries */}
        {entriesLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading FAQ…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <HelpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">
              {search || tagFilter ? "No results match your filters." : "No FAQ entries yet. Questions from chat and discussions will appear here."}
            </p>
            {isAuthor && !search && !tagFilter && (
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add the first FAQ
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                data-tour={i === 0 ? "faq-entry" : undefined}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-foreground leading-snug">{entry.question}</h3>
                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <BookmarkButton
                      type="faq"
                      referenceKey={`faq:${entry.id}`}
                      label={entry.question}
                      previewText={entry.answer_markdown.slice(0, 120)}
                    />
                    {isAuthor && (
                      <>
                        <button
                          onClick={() => setEditEntry(entry)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            await archiveFaqEntry.mutateAsync(entry.id);
                            toast.success("FAQ archived.");
                          }}
                          className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          title="Archive"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground leading-relaxed">
                  <MarkdownRenderer>{entry.answer_markdown}</MarkdownRenderer>
                </div>

                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground/60 font-mono">{sourceLabel(entry.source)}</span>
                  {entry.tags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {entry.tags.map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {entry.related_module_key && (
                    <button
                      onClick={() => navigate(`/packs/${packId}/modules/${entry.related_module_key}`)}
                      className="ml-auto text-[10px] text-primary/70 hover:text-primary flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-2.5 h-2.5" /> Related module
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <SaveAsFaqDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        source="manual"
      />

      {/* Edit dialog (reuse with prefilled values) */}
      {editEntry && (
        <SaveAsFaqDialog
          open={!!editEntry}
          onClose={() => setEditEntry(null)}
          initialQuestion={editEntry.question}
          initialAnswer={editEntry.answer_markdown}
          source={editEntry.source}
        />
      )}
    </DashboardLayout>
  );
}
