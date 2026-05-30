import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useBookmarks, BookmarkType, Bookmark as BM } from "@/hooks/useBookmarks";
import { useNavigate } from "react-router-dom";
import { usePack } from "@/hooks/usePack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bookmark, BookOpen, BookText, Route, MessageSquareMore, Trash2,
  Code2, MessageCircle, Dumbbell, FileText, Pin, PinOff, FolderPlus,
  Search, ArrowUpDown, Folder, Tag, X, ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP_TOOLTIPS } from "@/data/help-tooltips";

const TYPE_META: Record<string, { label: string; icon: typeof BookOpen; color: string }> = {
  module_section: { label: "Section", icon: BookOpen, color: "text-primary" },
  glossary_term: { label: "Glossary", icon: BookText, color: "text-accent-foreground" },
  path_step: { label: "Path Step", icon: Route, color: "text-accent-foreground" },
  ask_lead_question: { label: "Ask Lead", icon: MessageSquareMore, color: "text-accent-foreground" },
  exercise: { label: "Exercise", icon: Dumbbell, color: "text-primary" },
  code_snippet: { label: "Code", icon: Code2, color: "text-muted-foreground" },
  chat_message: { label: "Chat", icon: MessageCircle, color: "text-accent-foreground" },
  custom: { label: "Custom", icon: FileText, color: "text-muted-foreground" },
};

type SortMode = "recent" | "alpha" | "type" | "module";

export default function BookmarksPage() {
  const {
    bookmarks, isLoading, removeBookmark, bulkRemove, collections,
    createCollection, deleteCollection, renameCollection,
    moveToCollection, togglePin, allTags,
  } = useBookmarks();
  const { currentPackId } = usePack();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<BookmarkType | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newCollName, setNewCollName] = useState("");
  const [showNewColl, setShowNewColl] = useState(false);

  const filtered = useMemo(() => {
    let items = bookmarks;
    if (filter !== "all") items = items.filter((b) => b.bookmark_type === filter);
    if (tagFilter) items = items.filter((b) => (b.tags ?? []).includes(tagFilter));
    if (collectionFilter) items = items.filter((b) => b.collection_id === collectionFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (b) =>
          (b.label ?? "").toLowerCase().includes(q) ||
          (b.subtitle ?? "").toLowerCase().includes(q) ||
          (b.preview_text ?? "").toLowerCase().includes(q) ||
          b.reference_key.toLowerCase().includes(q)
      );
    }
    // Sort
    switch (sortMode) {
      case "alpha":
        items = [...items].sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
        break;
      case "type":
        items = [...items].sort((a, b) => a.bookmark_type.localeCompare(b.bookmark_type));
        break;
      case "module":
        items = [...items].sort((a, b) => a.reference_key.localeCompare(b.reference_key));
        break;
      default:
        break; // already sorted by created_at desc
    }
    return items;
  }, [bookmarks, filter, tagFilter, collectionFilter, searchQuery, sortMode]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bookmarks) counts[b.bookmark_type] = (counts[b.bookmark_type] ?? 0) + 1;
    return counts;
  }, [bookmarks]);

  const collBookmarkCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bookmarks) {
      if (b.collection_id) counts[b.collection_id] = (counts[b.collection_id] ?? 0) + 1;
    }
    return counts;
  }, [bookmarks]);

  const handleNavigate = (b: BM) => {
    const prefix = `/packs/${currentPackId}`;
    switch (b.bookmark_type) {
      case "module_section": {
        const [moduleKey] = b.reference_key.split(":");
        navigate(`${prefix}/modules/${moduleKey}`);
        break;
      }
      case "glossary_term":
        navigate(`${prefix}/glossary`);
        break;
      case "path_step":
        navigate(`${prefix}/paths`);
        break;
      case "ask_lead_question":
        navigate(`${prefix}/ask-lead`);
        break;
      case "exercise": {
        const [modKey] = b.reference_key.split(":");
        navigate(`${prefix}/modules/${modKey}`);
        break;
      }
      case "code_snippet":
      case "chat_message":
      case "custom":
        break;
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkRemove = () => {
    if (selected.size === 0) return;
    bulkRemove.mutate([...selected], { onSuccess: () => setSelected(new Set()) });
  };

  const handleBulkMove = (collId: string | null) => {
    if (selected.size === 0) return;
    moveToCollection.mutate(
      { bookmarkIds: [...selected], collectionId: collId },
      { onSuccess: () => setSelected(new Set()) }
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between" data-tour="bookmarks-header">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bookmark className="w-6 h-6 text-primary" /> Saved Items
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {bookmarks.length} bookmarked items
            </p>
          </div>
        </div>

        {/* Search + Sort */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search saved items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() =>
              setSortMode((m) =>
                m === "recent" ? "alpha" : m === "alpha" ? "type" : m === "type" ? "module" : "recent"
              )
            }
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortMode === "recent" ? "Recent" : sortMode === "alpha" ? "A-Z" : sortMode === "type" ? "By Type" : "By Module"}
          </Button>
        </div>

        {/* Type Filters */}
        <div className="flex gap-2 flex-wrap">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            All ({bookmarks.length})
          </Button>
          {Object.entries(TYPE_META).map(([type, meta]) =>
            (typeCounts[type] ?? 0) > 0 ? (
              <Button
                key={type}
                variant={filter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(type as BookmarkType)}
              >
                {meta.label} ({typeCounts[type] ?? 0})
              </Button>
            ) : null
          )}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={tagFilter === tag ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              >
                {tag}
              </Badge>
            ))}
            {tagFilter && (
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setTagFilter(null)}>
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Collections sidebar */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5" /> Collections
              <HelpTooltip content={HELP_TOOLTIPS.bookmarks.collections} />
            </h3>
            <button
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                !collectionFilter ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
              }`}
              onClick={() => setCollectionFilter(null)}
            >
              All Items
            </button>
            {collections.map((c) => (
              <div key={c.id} className="group flex items-center gap-1">
                <button
                  className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    collectionFilter === c.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                  }`}
                  onClick={() => setCollectionFilter(collectionFilter === c.id ? null : c.id)}
                >
                  {c.icon} {c.name}{" "}
                  <span className="text-muted-foreground">({collBookmarkCounts[c.id] ?? 0})</span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground"
                  onClick={() => deleteCollection.mutate(c.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {showNewColl ? (
              <div className="flex gap-1">
                <Input
                  className="h-8 text-xs"
                  placeholder="Collection name..."
                  value={newCollName}
                  onChange={(e) => setNewCollName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCollName.trim()) {
                      createCollection.mutate({ name: newCollName.trim() });
                      setNewCollName("");
                      setShowNewColl(false);
                    }
                  }}
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setShowNewColl(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-1.5 text-xs text-muted-foreground"
                onClick={() => setShowNewColl(true)}
              >
                <FolderPlus className="w-3 h-3" /> Create Collection
              </Button>
            )}
          </div>

          {/* Main list */}
          <div className="lg:col-span-3 space-y-2">
            {/* Bulk actions */}
            {selected.size > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted border border-border text-xs">
                <span className="text-muted-foreground">{selected.size} selected</span>
                <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={handleBulkRemove}>
                  <Trash2 className="w-3 h-3" /> Remove
                </Button>
                {collections.map((c) => (
                  <Button
                    key={c.id}
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs gap-1"
                    onClick={() => handleBulkMove(c.id)}
                  >
                    → {c.icon} {c.name}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery || filter !== "all" || tagFilter
                  ? "No matching bookmarks."
                  : "No bookmarks yet. Save items from modules, glossary, paths, exercises, and more."}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((b, i) => {
                  const meta = TYPE_META[b.bookmark_type] ?? TYPE_META.custom;
                  const Icon = meta.icon;
                  const coll = collections.find((c) => c.id === b.collection_id);
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      data-tour={i === 0 ? "bookmark-item" : undefined}
                      className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selected.has(b.id)}
                          onCheckedChange={() => toggleSelect(b.id)}
                          className="mt-1"
                        />
                        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${meta.color}`} />
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleNavigate(b)}
                        >
                          <p className="text-sm font-medium text-card-foreground truncate">
                            {b.label ?? b.reference_key}
                          </p>
                          {b.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">{b.subtitle}</p>
                          )}
                          {b.preview_text && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {b.preview_text}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {meta.label}
                            </Badge>
                            {coll && (
                              <span className="text-[10px] text-muted-foreground">
                                {coll.icon} {coll.name}
                              </span>
                            )}
                            {(b.tags ?? []).map((t) => (
                              <Badge key={t} variant="secondary" className="text-[10px]">
                                {t}
                              </Badge>
                            ))}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(b.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 w-7 p-0 ${b.is_pinned ? "text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin.mutate(b.id);
                            }}
                            title={b.is_pinned ? "Unpin" : "Pin to dashboard"}
                          >
                            {b.is_pinned ? <Pin className="w-3.5 h-3.5 fill-primary" /> : <Pin className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBookmark.mutate(b.id, { onSuccess: () => toast.success("Removed") });
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
