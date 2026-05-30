import { useState } from "react";
import { Flag, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatFeedback, CHAT_FEEDBACK_REASON_LABELS, type ChatFeedbackReason } from "@/hooks/useChatFeedback";
import { toast } from "sonner";

interface ChatReportDialogProps {
  open: boolean;
  onClose: () => void;
  messageContent: string;
  moduleId?: string;
  traceId?: string;
  context?: {
    pathname: string;
    pack_id: string | null;
    transcript: string;
  };
}

const REASONS = Object.entries(CHAT_FEEDBACK_REASON_LABELS) as [
  ChatFeedbackReason,
  { label: string; icon: string }
][];

export function ChatReportDialog({ open, onClose, messageContent, moduleId, traceId, context }: ChatReportDialogProps) {
  const { submitChatFeedback } = useChatFeedback();
  const [reason, setReason] = useState<ChatFeedbackReason>("incorrect");
  const [comment, setComment] = useState("");
  const [createTask, setCreateTask] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitChatFeedback.mutateAsync({
        messageContent,
        reason,
        comment: context 
          ? `${comment.trim()}\n\n--- CHAT CONTEXT ---\nPath: ${context.pathname}\nPack: ${context.pack_id}\n\nTranscript:\n${context.transcript}`
          : comment.trim() || undefined,
        createTask,
        moduleId,
        traceId,
      });
      toast.success("Feedback submitted — thank you!");
      setComment("");
      setReason("incorrect");
      onClose();
    } catch {
      toast.error("Failed to submit feedback. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[340px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Flag className="w-4 h-4 text-amber-500" />
            Report incorrect answer
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Reason</label>
            <Select value={reason} onValueChange={(v) => setReason(v as ChatFeedbackReason)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map(([value, { label, icon }]) => (
                  <SelectItem key={value} value={value} className="text-xs">
                    {icon} {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Comment */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Comment <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What was wrong or misleading?"
              className="h-20 text-xs resize-none"
            />
          </div>

          {/* Create task checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={createTask}
              onChange={(e) => setCreateTask(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              Create a task for my lead to review this answer
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs"
              disabled={submitChatFeedback.isPending}
            >
              {submitChatFeedback.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Flag className="w-3 h-3 mr-1" />
              )}
              Submit report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
