import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useManualGlossary } from "@/hooks/useManualGlossary";
import { ManualGlossaryTerm } from "@/hooks/useManualGlossary";
import { toast } from "sonner";
import { BookText, Loader2 } from "lucide-react";

interface SaveAsGlossaryDialogProps {
  open: boolean;
  onClose: () => void;
  initialTerm?: string;
  initialDefinition?: string;
  initialContext?: string;
  source?: ManualGlossaryTerm["source"];
}

export function SaveAsGlossaryDialog({
  open,
  onClose,
  initialTerm = "",
  initialDefinition = "",
  initialContext = "",
  source = "manual",
}: SaveAsGlossaryDialogProps) {
  const { createTerm } = useManualGlossary();
  const [term, setTerm] = useState(initialTerm);
  const [definition, setDefinition] = useState(initialDefinition);
  const [context, setContext] = useState(initialContext);

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setTerm(initialTerm);
      setDefinition(initialDefinition);
      setContext(initialContext);
      onClose();
    }
  };

  const handleSave = async () => {
    if (!term.trim() || !definition.trim()) {
      toast.error("Term and definition are required.");
      return;
    }
    try {
      await createTerm.mutateAsync({
        term: term.trim(),
        definition: definition.trim(),
        context: context.trim() || undefined,
        source,
      });
      toast.success("Term added to glossary!");
      handleOpenChange(false);
    } catch {
      toast.error("Failed to save glossary term.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-primary/20 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookText className="w-5 h-5 text-primary" />
            Save as Glossary Term
          </DialogTitle>
          <DialogDescription>
            Adds a manually curated term visible to all pack members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Term</label>
            <Input
              placeholder="e.g. ActionRunner"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="bg-muted/30 border-border/50 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Definition</label>
            <Textarea
              placeholder="Clear, concise definition…"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              className="min-h-[90px] bg-muted/30 border-border/50 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Usage context <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="Code example or context where this term appears…"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="min-h-[70px] bg-muted/30 border-border/50 resize-none font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={createTerm.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={createTerm.isPending}
            className="gradient-primary border-0 shadow-md"
          >
            {createTerm.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            ) : "Save Term"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
