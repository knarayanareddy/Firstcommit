import { useState } from "react";
import { ThumbsUp, ThumbsDown, Flag, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useContentFeedback, FeedbackType } from "@/hooks/useContentFeedback";
import { toast } from "sonner";

const FLAG_OPTIONS: { type: FeedbackType; label: string; icon: string }[] = [
  { type: "confusing", label: "Confusing", icon: "🤔" },
  { type: "outdated", label: "Outdated", icon: "📅" },
  { type: "incorrect", label: "Incorrect", icon: "❌" },
  { type: "missing_context", label: "Missing context", icon: "🔍" },
];

interface SectionFeedbackProps {
  moduleKey: string;
  sectionId?: string;
}

export function SectionFeedback({ moduleKey, sectionId }: SectionFeedbackProps) {
  const { submitFeedback, removeFeedback, getMyFeedbackForSection } = useContentFeedback(moduleKey);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);

  const myFeedback = getMyFeedbackForSection(moduleKey, sectionId);
  const hasThumbsUp = myFeedback.some(f => f.feedback_type === "thumbs_up");
  const hasThumbsDown = myFeedback.some(f => f.feedback_type === "thumbs_down");
  const activeFlags = myFeedback.filter(f => !["thumbs_up", "thumbs_down"].includes(f.feedback_type));

  const handleThumb = async (type: "thumbs_up" | "thumbs_down") => {
    const isActive = type === "thumbs_up" ? hasThumbsUp : hasThumbsDown;
    if (isActive) {
      removeFeedback.mutate({ moduleKey, sectionId, feedbackType: type });
    } else {
      // Remove opposite thumb
      const opposite = type === "thumbs_up" ? "thumbs_down" : "thumbs_up";
      if (myFeedback.some(f => f.feedback_type === opposite)) {
        removeFeedback.mutate({ moduleKey, sectionId, feedbackType: opposite });
      }
      submitFeedback.mutate({ moduleKey, sectionId, feedbackType: type });
    }
  };

  const handleFlag = (type: FeedbackType) => {
    const isActive = activeFlags.some(f => f.feedback_type === type);
    if (isActive) {
      removeFeedback.mutate({ moduleKey, sectionId, feedbackType: type });
    } else {
      submitFeedback.mutate(
        { moduleKey, sectionId, feedbackType: type, comment: comment || undefined },
        { onSuccess: () => toast.success("Feedback submitted") }
      );
    }
    setFlagOpen(false);
  };

  return (
    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
      <span className="text-[10px] text-muted-foreground mr-1">Helpful?</span>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 p-0 ${hasThumbsUp ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
        onClick={() => handleThumb("thumbs_up")}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 p-0 ${hasThumbsDown ? "text-destructive bg-destructive/10" : "text-muted-foreground"}`}
        onClick={() => handleThumb("thumbs_down")}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </Button>

      <Popover open={flagOpen} onOpenChange={setFlagOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 w-7 p-0 ${activeFlags.length > 0 ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground"}`}
          >
            <Flag className="w-3.5 h-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <p className="text-xs font-medium text-foreground mb-2">Report issue</p>
          {FLAG_OPTIONS.map(opt => {
            const isActive = activeFlags.some(f => f.feedback_type === opt.type);
            return (
              <button
                key={opt.type}
                onClick={() => handleFlag(opt.type)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${isActive ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      {activeFlags.length > 0 && (
        <span className="text-[10px] text-amber-500 font-medium">
          {activeFlags.length} flag{activeFlags.length > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
