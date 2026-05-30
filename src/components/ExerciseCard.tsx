import { useState, useRef, useEffect } from "react";
import { Exercise, ExerciseSubmission } from "@/hooks/useExercises";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, BookOpen, Settings, Bug, Compass, Terminal, MessageSquare,
  Clock, Lightbulb, Loader2, CheckCircle2, XCircle, AlertTriangle, Send,
  RotateCcw,
} from "lucide-react";
import { BookmarkButton } from "@/components/BookmarkButton";

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  code_find: { icon: Search, label: "Code Find", color: "bg-primary/10 text-primary" },
  code_explain: { icon: BookOpen, label: "Code Explain", color: "bg-accent/20 text-accent-foreground" },
  config_task: { icon: Settings, label: "Config Task", color: "bg-muted text-muted-foreground" },
  debug_challenge: { icon: Bug, label: "Debug Challenge", color: "bg-destructive/10 text-destructive" },
  explore_and_answer: { icon: Compass, label: "Explore & Answer", color: "bg-primary/10 text-primary" },
  terminal_task: { icon: Terminal, label: "Terminal Task", color: "bg-muted text-muted-foreground" },
  free_response: { icon: MessageSquare, label: "Free Response", color: "bg-accent/20 text-accent-foreground" },
};

const DIFF_COLORS: Record<string, string> = {
  beginner: "bg-primary/10 text-primary border-primary/20",
  intermediate: "bg-accent/10 text-accent-foreground border-accent/20",
  advanced: "bg-destructive/10 text-destructive border-destructive/20",
};

interface ExerciseCardProps {
  exercise: Exercise;
  submission?: ExerciseSubmission;
  onSubmit: (content: string, submissionType: string, hintsUsed: number, timeSpent: number) => void;
  onVerify: () => void;
  isSubmitting: boolean;
  isVerifying: boolean;
}

export function ExerciseCard({ exercise, submission, onSubmit, onVerify, isSubmitting, isVerifying }: ExerciseCardProps) {
  const [answer, setAnswer] = useState(submission?.content || "");
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const startTimeRef = useRef(Date.now());
  const hints = (exercise.hints || []) as string[];
  const typeConf = TYPE_CONFIG[exercise.exercise_type] || TYPE_CONFIG.free_response;
  const TypeIcon = typeConf.icon;

  const feedback = submission?.ai_feedback as ExerciseSubmission["ai_feedback"];
  const hasSubmitted = !!submission;
  const isVerified = submission?.status === "verified";
  const needsRevision = submission?.status === "needs_revision";

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [exercise.exercise_key]);

  const getSubmissionType = (): string => {
    switch (exercise.exercise_type) {
      case "code_find": return "file_path";
      case "terminal_task": return "terminal_output";
      case "code_explain":
      case "config_task":
      case "debug_challenge":
      case "free_response": return "text";
      case "explore_and_answer": return "text";
      default: return "text";
    }
  };

  const handleSubmit = () => {
    if (!answer.trim()) return;
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
    onSubmit(answer.trim(), getSubmissionType(), hintsRevealed, timeSpent);
  };

  const handleRevise = () => {
    setAnswer(submission?.content || "");
    startTimeRef.current = Date.now();
  };

  return (
    <div className={`border rounded-xl p-6 transition-colors ${
      isVerified ? "border-primary/40 bg-primary/5" :
      needsRevision ? "border-accent/40 bg-accent/5" :
      "border-border bg-card"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeConf.color}`}>
            <TypeIcon className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-foreground">{exercise.title}</h4>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <BookmarkButton
            type="exercise"
            referenceKey={`${exercise.module_key}:${exercise.exercise_key}`}
            label={exercise.title}
            subtitle={`Exercise · ${exercise.exercise_type}`}
            previewText={exercise.description?.slice(0, 100)}
          />
          <Badge variant="outline" className={`text-[10px] ${DIFF_COLORS[exercise.difficulty] || ""}`}>
            {exercise.difficulty}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" /> ~{exercise.estimated_minutes} min
          </span>
          {isVerified && <CheckCircle2 className="w-4 h-4 text-primary" />}
          {needsRevision && <AlertTriangle className="w-4 h-4 text-accent-foreground" />}
        </div>
      </div>

      {/* Description */}
      <div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-sm">
        <MarkdownRenderer>{exercise.description}</MarkdownRenderer>
      </div>

      {/* Hints */}
      {hints.length > 0 && (
        <div className="mb-4 space-y-2">
          {hints.map((hint, i) => (
            <div key={i}>
              {i < hintsRevealed ? (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border border-border/50 text-sm">
                  <Lightbulb className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{hint}</span>
                </motion.div>
              ) : i === hintsRevealed ? (
                <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-7"
                  onClick={() => setHintsRevealed((h) => h + 1)}>
                  <Lightbulb className="w-3 h-3" /> Hint {i + 1} of {hints.length}: Reveal
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      {!feedback && (
        <div className="space-y-3">
          {exercise.exercise_type === "code_find" ? (
            <Input
              placeholder="Enter file path (e.g. src/auth/middleware.ts)"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="font-mono text-sm"
            />
          ) : (
            <Textarea
              placeholder={
                exercise.exercise_type === "terminal_task"
                  ? "Paste terminal output here..."
                  : exercise.exercise_type === "config_task"
                  ? "Paste configuration here..."
                  : "Write your answer here..."
              }
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={exercise.exercise_type === "terminal_task" || exercise.exercise_type === "config_task" ? 8 : 5}
              className={exercise.exercise_type === "terminal_task" ? "font-mono text-xs" : "text-sm"}
            />
          )}
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={!answer.trim() || isSubmitting} className="gap-2">
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
              ) : (
                <><Send className="w-4 h-4" /> {["code_explain", "free_response", "debug_challenge"].includes(exercise.exercise_type) ? "Submit for AI Review" : "Submit Answer"}</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Submitted, waiting for verification */}
      {hasSubmitted && !feedback && !isVerifying && submission?.status === "submitted" && (
        <div className="mt-4">
          <Button onClick={onVerify} className="gap-2" variant="outline">
            <Lightbulb className="w-4 h-4" /> Get AI Feedback
          </Button>
        </div>
      )}

      {isVerifying && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-4 rounded-lg bg-muted/50 border border-border flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">🤖 Reviewing your answer...</span>
        </motion.div>
      )}

      {/* AI Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-foreground">🤖 AI Feedback</span>
              {feedback.status === "correct" && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Correct ({feedback.score}/100)
                </Badge>
              )}
              {feedback.status === "partially_correct" && (
                <Badge className="bg-accent/10 text-accent-foreground border-accent/20 text-xs gap-1">
                  <AlertTriangle className="w-3 h-3" /> Mostly Correct ({feedback.score}/100)
                </Badge>
              )}
              {feedback.status === "incorrect" && (
                <Badge variant="destructive" className="text-xs gap-1">
                  <XCircle className="w-3 h-3" /> Incorrect ({feedback.score}/100)
                </Badge>
              )}
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground">
              <MarkdownRenderer>{feedback.feedback_markdown}</MarkdownRenderer>
            </div>
            {feedback.suggestions && feedback.suggestions.length > 0 && (
              <ul className="mt-2 space-y-1">
                {feedback.suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Lightbulb className="w-3 h-3 text-primary mt-0.5 shrink-0" /> {s}
                  </li>
                ))}
              </ul>
            )}
            {feedback.status !== "correct" && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleRevise}>
                  <RotateCcw className="w-3 h-3" /> Revise & Resubmit
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
