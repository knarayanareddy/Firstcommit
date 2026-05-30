import { useState, useEffect } from "react";
import { PenLine, Save, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NotesPanelProps {
  sectionId: string;
  notePrompts?: string[];
  savedNote: string;
  onSave: (content: string) => void;
  onDelete: () => void;
}

export function NotesPanel({ sectionId, notePrompts, savedNote, onSave, onDelete }: NotesPanelProps) {
  const [isOpen, setIsOpen] = useState(!!savedNote);
  const [content, setContent] = useState(savedNote);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setContent(savedNote);
    setIsDirty(false);
  }, [savedNote, sectionId]);

  const handleSave = () => {
    onSave(content);
    setIsDirty(false);
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <PenLine className="w-3.5 h-3.5" />
        {isOpen ? "Hide notes" : savedNote ? "View notes" : "Add notes"}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2">
              {notePrompts && notePrompts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {notePrompts.map((prompt, i) => (
                    <span
                      key={i}
                      className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-md cursor-pointer hover:bg-accent/20 transition-colors"
                      onClick={() => {
                        setContent((prev) => prev ? `${prev}\n\n${prompt}` : prompt);
                        setIsDirty(true);
                      }}
                    >
                      💡 {prompt}
                    </span>
                  ))}
                </div>
              )}
              <textarea
                value={content}
                onChange={(e) => { setContent(e.target.value); setIsDirty(true); }}
                placeholder="Write your notes here..."
                className="w-full min-h-[80px] text-sm bg-muted/50 border border-border rounded-lg p-3 text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={!isDirty}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
                >
                  <Save className="w-3 h-3" />
                  Save
                </button>
                {savedNote && (
                  <button
                    onClick={onDelete}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
