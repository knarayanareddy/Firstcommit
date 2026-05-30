import { useState } from "react";
import { ThumbsUp, ThumbsDown, HelpCircle, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface QuizQuestionFeedbackProps {
  onFeedback: (type: string) => void;
  disabled?: boolean;
}

export function QuizQuestionFeedback({ onFeedback, disabled }: QuizQuestionFeedbackProps) {
  const [submitted, setSubmitted] = useState<string | null>(null);

  const submit = (type: string) => {
    if (submitted) return;
    setSubmitted(type);
    onFeedback(type);
  };

  if (submitted) {
    return (
      <p className="text-xs text-muted-foreground mt-2">
        ✓ Thanks for your feedback!
      </p>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-3">
      <span className="text-xs text-muted-foreground mr-1">Was this fair?</span>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => submit("fair")} disabled={disabled}>
        <ThumbsUp className="w-3 h-3" /> Fair
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => submit("unfair")} disabled={disabled}>
        <ThumbsDown className="w-3 h-3" /> Unfair
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => submit("confusing")} disabled={disabled}>
        <HelpCircle className="w-3 h-3" /> Confusing
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
            <MoreHorizontal className="w-3 h-3" /> More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => submit("too_easy")}>Too Easy</DropdownMenuItem>
          <DropdownMenuItem onClick={() => submit("too_hard")}>Too Hard</DropdownMenuItem>
          <DropdownMenuItem onClick={() => submit("ambiguous")}>Ambiguous Options</DropdownMenuItem>
          <DropdownMenuItem onClick={() => submit("incorrect_answer")}>Wrong Correct Answer</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
