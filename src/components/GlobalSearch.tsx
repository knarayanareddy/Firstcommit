import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, BookOpen, BookText, StickyNote, MessageSquare, Code, Clock, ArrowRight, Bookmark } from "lucide-react";
import { useGlobalSearch, SearchFilter } from "@/hooks/useGlobalSearch";
import { useBookmarks } from "@/hooks/useBookmarks";
import { usePack } from "@/hooks/usePack";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const FILTER_OPTIONS: { key: SearchFilter; label: string; icon: React.ElementType }[] = [
  { key: "modules", label: "Modules", icon: BookOpen },
  { key: "glossary", label: "Glossary", icon: BookText },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "chatHistory", label: "Chat", icon: MessageSquare },
  { key: "sourceChunks", label: "Code", icon: Code },
];

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const { query, setQuery, filters, setFilters, results, isLoading, totalResults, getRecentSearches, saveRecentSearch, clearRecentSearches } = useGlobalSearch();
  const { currentPackId } = usePack();
  const { isBookmarked } = useBookmarks();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(-1);
    } else {
      setQuery("");
    }
  }, [open, getRecentSearches, setQuery]);

  // Build flat result list for keyboard nav
  const allResults = buildFlatResults(results);

  const handleNavigate = useCallback(
    (result: FlatResult) => {
      saveRecentSearch(query);
      onOpenChange(false);
      const prefix = `/packs/${currentPackId}`;
      switch (result.type) {
        case "module":
          navigate(result.sectionId ? `${prefix}/modules/${result.moduleKey}#${result.sectionId}` : `${prefix}/modules/${result.moduleKey}`);
          break;
        case "glossary":
          navigate(`${prefix}/glossary`);
          break;
        case "note":
          navigate(`${prefix}/modules/${result.moduleId}`);
          break;
        case "chat":
          navigate(`${prefix}/modules/${result.moduleId}`);
          break;
        case "source":
          navigate(`${prefix}/sources`);
          break;
      }
    },
    [navigate, currentPackId, onOpenChange, saveRecentSearch, query]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && selectedIndex >= 0 && allResults[selectedIndex]) {
      e.preventDefault();
      handleNavigate(allResults[selectedIndex]);
    }
  };

  const toggleFilter = (f: SearchFilter) => {
    setFilters((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const showEmpty = query.length >= 2 && !isLoading && totalResults === 0;
  const showRecent = query.length < 2 && recentSearches.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden max-h-[80vh]">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(-1); }}
            onKeyDown={handleKeyDown}
            placeholder="Search across all content…"
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto">
          {FILTER_OPTIONS.map((f) => {
            const active = filters.length === 0 || filters.includes(f.key);
            const count = results[f.key]?.length || 0;
            return (
              <button
                key={f.key}
                onClick={() => toggleFilter(f.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-muted text-muted-foreground border border-transparent"
                }`}
              >
                <f.icon className="w-3 h-3" />
                {f.label}
                {query.length >= 2 && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-0.5">{count}</Badge>}
              </button>
            );
          })}
        </div>

        {/* Results area */}
        <div className="overflow-y-auto max-h-[55vh] px-4 py-3 space-y-4">
          {/* Recent searches */}
          {showRecent && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Searches</span>
                <button onClick={() => { clearRecentSearches(); setRecentSearches([]); }} className="text-xs text-muted-foreground hover:text-foreground">
                  Clear
                </button>
              </div>
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  {s}
                </button>
              ))}
            </div>
          )}

          {isLoading && query.length >= 2 && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {showEmpty && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No results for "<span className="font-medium text-foreground">{query}</span>". Try different keywords.
            </div>
          )}

          {/* Module results */}
          {results.modules.length > 0 && (filters.length === 0 || filters.includes("modules")) && (
            <ResultSection
              title="Modules"
              icon={BookOpen}
              count={results.modules.length}
              items={results.modules.map((r, i) => ({
                key: `mod-${i}`,
                primary: `${r.moduleTitle}${r.sectionHeading ? ` › ${r.sectionHeading}` : ""}`,
                snippet: r.snippet,
                selected: allResults[selectedIndex]?.id === `mod-${i}`,
                bookmarked: r.sectionId ? isBookmarked("module_section", `${r.moduleKey}:${r.sectionId}`) : false,
                onClick: () =>
                  handleNavigate({ type: "module", id: `mod-${i}`, moduleKey: r.moduleKey, sectionId: r.sectionId }),
              }))}
              query={query}
            />
          )}

          {/* Glossary results */}
          {results.glossary.length > 0 && (filters.length === 0 || filters.includes("glossary")) && (
            <ResultSection
              title="Glossary"
              icon={BookText}
              count={results.glossary.length}
              items={results.glossary.map((r, i) => ({
                key: `gls-${i}`,
                primary: r.term,
                snippet: r.snippet,
                selected: allResults[selectedIndex]?.id === `gls-${i}`,
                bookmarked: isBookmarked("glossary_term", `term:${r.term}`),
                onClick: () => handleNavigate({ type: "glossary", id: `gls-${i}` }),
              }))}
              query={query}
            />
          )}

          {/* Notes results */}
          {results.notes.length > 0 && (filters.length === 0 || filters.includes("notes")) && (
            <ResultSection
              title="Your Notes"
              icon={StickyNote}
              count={results.notes.length}
              items={results.notes.map((r, i) => ({
                key: `note-${i}`,
                primary: `Note in ${r.moduleId} › ${r.sectionId}`,
                snippet: r.snippet,
                selected: allResults[selectedIndex]?.id === `note-${i}`,
                onClick: () => handleNavigate({ type: "note", id: `note-${i}`, moduleId: r.moduleId }),
              }))}
              query={query}
            />
          )}

          {/* Chat results */}
          {results.chatHistory.length > 0 && (filters.length === 0 || filters.includes("chatHistory")) && (
            <ResultSection
              title="Chat History"
              icon={MessageSquare}
              count={results.chatHistory.length}
              items={results.chatHistory.map((r, i) => ({
                key: `chat-${i}`,
                primary: `${r.role === "assistant" ? "AI" : "You"} in ${r.moduleId}`,
                snippet: r.snippet,
                selected: allResults[selectedIndex]?.id === `chat-${i}`,
                onClick: () => handleNavigate({ type: "chat", id: `chat-${i}`, moduleId: r.moduleId }),
              }))}
              query={query}
            />
          )}

          {/* Source chunk results */}
          {results.sourceChunks.length > 0 && (filters.length === 0 || filters.includes("sourceChunks")) && (
            <ResultSection
              title="Source Code"
              icon={Code}
              count={results.sourceChunks.length}
              items={results.sourceChunks.map((r, i) => ({
                key: `src-${i}`,
                primary: r.path,
                snippet: r.snippet,
                selected: allResults[selectedIndex]?.id === `src-${i}`,
                onClick: () => handleNavigate({ type: "source", id: `src-${i}` }),
              }))}
              query={query}
            />
          )}

          {/* Total count */}
          {totalResults > 0 && (
            <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
              Showing {totalResults} result{totalResults !== 1 ? "s" : ""} for "{query}"
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Helpers ---------- */

interface FlatResult {
  type: "module" | "glossary" | "note" | "chat" | "source";
  id: string;
  moduleKey?: string;
  sectionId?: string | null;
  moduleId?: string;
}

function buildFlatResults(results: any): FlatResult[] {
  const flat: FlatResult[] = [];
  results.modules?.forEach((_: any, i: number) => flat.push({ type: "module", id: `mod-${i}`, moduleKey: _.moduleKey, sectionId: _.sectionId }));
  results.glossary?.forEach((_: any, i: number) => flat.push({ type: "glossary", id: `gls-${i}` }));
  results.notes?.forEach((_: any, i: number) => flat.push({ type: "note", id: `note-${i}`, moduleId: _.moduleId }));
  results.chatHistory?.forEach((_: any, i: number) => flat.push({ type: "chat", id: `chat-${i}`, moduleId: _.moduleId }));
  results.sourceChunks?.forEach((_: any, i: number) => flat.push({ type: "source", id: `src-${i}` }));
  return flat;
}

function highlightSnippet(text: string, query: string): React.ReactNode {
  if (!text || !query) return text;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const regex = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    words.some((w) => part.toLowerCase() === w) ? (
      <mark key={i} className="bg-primary/20 text-primary rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

interface ResultSectionProps {
  title: string;
  icon: React.ElementType;
  count: number;
  items: Array<{
    key: string;
    primary: string;
    snippet: string;
    selected: boolean;
    bookmarked?: boolean;
    onClick: () => void;
  }>;
  query: string;
}

function ResultSection({ title, icon: Icon, count, items, query }: ResultSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{count}</Badge>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={item.onClick}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors group ${
              item.selected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted border border-transparent"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                {item.bookmarked && <Bookmark className="w-3 h-3 text-primary fill-primary shrink-0" />}
                {highlightSnippet(item.primary, query)}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{highlightSnippet(item.snippet, query)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
