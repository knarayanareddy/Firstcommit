import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFaqEntries, FaqEntry } from "@/hooks/useFaqEntries";
import { toast } from "sonner";
import { HelpCircle, Tag, X, Loader2 } from "lucide-react";

interface SaveAsFaqDialogProps {
  open: boolean;
  onClose: () => void;
  initialQuestion?: string;
  initialAnswer?: string;
  source: FaqEntry["source"];
  suggestionId?: string;
  onConverted?: (faqId: string) => void;
}

export function SaveAsFaqDialog({
  open,
  onClose,
  initialQuestion = "",
  initialAnswer = "",
  source,
  onConverted,
}: SaveAsFaqDialogProps) {
  const { createFaqEntry } = useFaqEntries();
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState(initialAnswer);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<FaqEntry["status"]>("published");

  // Reset when re-opened
  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setQuestion(initialQuestion);
      setAnswer(initialAnswer);
      setTags([]);
      setTagInput("");
      setStatus("published");
      onClose();
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const handleSave = async (s: FaqEntry["status"]) => {
    if (!question.trim() || !answer.trim()) {
      toast.error("Question and answer are required.");
      return;
    }
    try {
      const entry = await createFaqEntry.mutateAsync({
        question: question.trim(),
        answer_markdown: answer.trim(),
        source,
        tags,
        status: s,
      });
      toast.success(s === "published" ? "FAQ published!" : "Saved as draft.");
      onConverted?.(entry.id);
      handleOpenChange(false);
    } catch {
      toast.error("Failed to save FAQ. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[580px] border-primary/20 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            Save as FAQ
          </DialogTitle>
          <DialogDescription>
            This will appear in the FAQ page for all pack members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Question</label>
            <Textarea
              placeholder="What question does this answer?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[60px] bg-muted/30 border-border/50 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Answer</label>
            <Textarea
              placeholder="Markdown supported…"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="min-h-[140px] bg-muted/30 border-border/50 resize-none font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Tag className="w-3 h-3" /> Tags (optional)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                className="bg-muted/30 border-border/50 text-sm"
              />
              <Button variant="outline" size="sm" onClick={addTag} className="shrink-0">Add</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 text-xs">
                    {t}
                    <button onClick={() => removeTag(t)} className="hover:text-destructive transition-colors">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={createFaqEntry.isPending}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={createFaqEntry.isPending}>
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSave("published")}
            disabled={createFaqEntry.isPending}
            className="gradient-primary border-0 shadow-md"
          >
            {createFaqEntry.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            ) : "Publish FAQ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
