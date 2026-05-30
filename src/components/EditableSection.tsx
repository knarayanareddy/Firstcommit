import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Eye, Edit3, Trash2 } from "lucide-react";
import type { GeneratedSection } from "@/hooks/useGeneratedModules";

interface EditableSectionProps {
  section: GeneratedSection;
  index: number;
  onUpdate: (updatedSection: GeneratedSection) => void;
  onDelete: () => void;
}

export function EditableSection({ section, index, onUpdate, onDelete }: EditableSectionProps) {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && !isPreview) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(100, textareaRef.current.scrollHeight)}px`;
    }
  }, [section.markdown, isPreview]);

  return (
    <div className="border border-border rounded-xl p-6 bg-card transition-all duration-300 relative group group/section">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 mr-4">
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded shrink-0">
            §{index + 1}
          </span>
          <input
            type="text"
            value={section.heading}
            onChange={(e) => onUpdate({ ...section, heading: e.target.value })}
            className="font-semibold text-card-foreground bg-transparent border-none outline-none w-full focus:ring-1 focus:ring-primary/50 rounded px-1 -ml-1 transition-all"
            placeholder="Section Heading"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setIsPreview(!isPreview)}
          >
            {isPreview ? <><Edit3 className="w-3.5 h-3.5 mr-1" /> Edit</> : <><Eye className="w-3.5 h-3.5 mr-1" /> Preview</>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover/section:opacity-100 transition-opacity"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {isPreview ? (
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground leading-relaxed [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2">
          <MarkdownRenderer>{section.markdown || "*No content*"}</MarkdownRenderer>
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={section.markdown}
          onChange={(e) => onUpdate({ ...section, markdown: e.target.value })}
          className="font-mono text-sm leading-relaxed resize-none focus-visible:ring-1 min-h-[100px]"
          placeholder="Markdown content..."
        />
      )}
    </div>
  );
}
