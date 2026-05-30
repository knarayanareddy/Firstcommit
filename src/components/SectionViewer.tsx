import { Section } from "@/data/onboarding-data";
import { TrackBadge } from "./TrackBadge";
import { NotesPanel } from "./NotesPanel";
import { StickyNote, CheckCircle2, Target, MessageCircle, ThumbsUp } from "lucide-react";
import { motion } from "framer-motion";
import { useDiscussions } from "@/hooks/useDiscussions";
import { useContentFeedback } from "@/hooks/useContentFeedback";

interface SectionViewerProps {
  section: Section;
  index: number;
  isRead: boolean;
  moduleKey?: string;
  onMarkRead?: () => void;
  savedNote?: string;
  onSaveNote?: (content: string) => void;
  onDeleteNote?: () => void;
}

export function SectionViewer({ section, index, isRead, moduleKey, onMarkRead, savedNote = "", onSaveNote, onDeleteNote }: SectionViewerProps) {
  // Fetch discussions for this section
  const { threads } = useDiscussions({ moduleKey, sectionId: section.id });
  
  // Fetch feedback for this module (and filter for section)
  const { packFeedback } = useContentFeedback(moduleKey);
  
  // Count thumbs_up for this section
  const helpfulCount = packFeedback.filter(
    f => f.section_id === section.id && f.feedback_type === "thumbs_up"
  ).length;
  
  const discussionCount = threads.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      id={section.id}
      className={`border rounded-xl p-6 transition-all duration-300 ${
        isRead
          ? "bg-card/50 border-primary/20"
          : "bg-card border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
            §{index + 1}
          </span>
          <h3 className="font-semibold text-card-foreground">{section.title}</h3>
        </div>
        {onMarkRead && (
          <button
            onClick={onMarkRead}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
              isRead
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isRead ? "Read" : "Mark as read"}
          </button>
        )}
      </div>

      {/* Learning objectives */}
      {section.learning_objectives && section.learning_objectives.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {section.learning_objectives.map((obj, i) => (
            <span key={i} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">
              <Target className="w-3 h-3" />
              {obj}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {section.tracks.map((t) => (
          <TrackBadge key={t} track={t} />
        ))}
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>

      {section.notes && (
        <div className="mt-4 flex items-start gap-2 bg-accent/10 border border-accent/20 rounded-lg p-3">
          <StickyNote className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-accent font-medium">{section.notes}</p>
        </div>
      )}

      {/* Social indicators */}
      {(discussionCount > 0 || helpfulCount > 0) && (
        <div className="mt-4 pt-3 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
          {discussionCount > 0 && (
            <span className="flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              {discussionCount} {discussionCount === 1 ? "discussion" : "discussions"}
            </span>
          )}
          {helpfulCount > 0 && (
            <span className="flex items-center gap-1.5">
              <ThumbsUp className="w-3.5 h-3.5" />
              {helpfulCount} found helpful
            </span>
          )}
        </div>
      )}

      {/* Notes panel */}
      {onSaveNote && onDeleteNote && (
        <NotesPanel
          sectionId={section.id}
          notePrompts={section.note_prompts}
          savedNote={savedNote}
          onSave={onSaveNote}
          onDelete={onDeleteNote}
        />
      )}
    </motion.div>
  );
}
