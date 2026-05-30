import { useState, useRef } from "react";
import { Bookmark, FolderPlus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBookmarks, BookmarkType } from "@/hooks/useBookmarks";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

interface BookmarkButtonProps {
  type: BookmarkType;
  referenceKey: string;
  label?: string;
  subtitle?: string;
  previewText?: string;
  size?: "sm" | "icon";
}

export function BookmarkButton({ type, referenceKey, label, subtitle, previewText, size = "icon" }: BookmarkButtonProps) {
  const { toggleBookmark, isBookmarked, collections, createCollection, moveToCollection, getBookmark } = useBookmarks();
  const saved = isBookmarked(type, referenceKey);
  const [showMenu, setShowMenu] = useState(false);
  const [newCollName, setNewCollName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleBookmark.mutate({ type, referenceKey, label, subtitle, previewText });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(true);
  };

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => setShowMenu(true), 500);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleMoveToCollection = (collId: string) => {
    const bm = getBookmark(type, referenceKey);
    if (!bm) {
      // Save first, then move
      toggleBookmark.mutate(
        { type, referenceKey, label, subtitle, previewText, collectionId: collId },
      );
    } else {
      moveToCollection.mutate({ bookmarkIds: [bm.id], collectionId: collId });
    }
    setShowMenu(false);
  };

  const handleCreateAndMove = () => {
    if (!newCollName.trim()) return;
    createCollection.mutate(
      { name: newCollName.trim() },
      {
        onSuccess: (coll) => {
          handleMoveToCollection(coll.id);
          setNewCollName("");
        },
      }
    );
  };

  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShowMenu(false); }}>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 p-0 transition-colors ${saved ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        title={saved ? "Remove bookmark" : "Bookmark"}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={saved ? "saved" : "unsaved"}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <Bookmark className={`w-3.5 h-3.5 ${saved ? "fill-primary" : ""}`} />
          </motion.div>
        </AnimatePresence>
      </Button>

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 w-52 bg-popover border border-border rounded-lg shadow-lg py-1 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Save to collection
          </p>
          <button
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground"
            onClick={() => {
              const bm = getBookmark(type, referenceKey);
              if (bm) moveToCollection.mutate({ bookmarkIds: [bm.id], collectionId: null });
              setShowMenu(false);
            }}
          >
            Uncategorized
          </button>
          {collections.map((c) => (
            <button
              key={c.id}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground"
              onClick={() => handleMoveToCollection(c.id)}
            >
              {c.icon} {c.name}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1 px-2 pb-1">
            <div className="flex items-center gap-1">
              <Input
                className="h-6 text-xs"
                placeholder="New collection..."
                value={newCollName}
                onChange={(e) => setNewCollName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateAndMove(); }}
              />
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleCreateAndMove} disabled={!newCollName.trim()}>
                <FolderPlus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
