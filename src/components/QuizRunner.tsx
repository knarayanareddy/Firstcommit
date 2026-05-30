import { useState, useRef } from "react";
import { QuizQuestion } from "@/data/onboarding-data";
import { GeneratedQuizQuestion } from "@/hooks/useGeneratedQuiz";
import { CitationBadge } from "@/components/CitationBadge";
import { validateCitations } from "@/lib/citation-validator";
import { QuizQuestionFeedback } from "@/components/QuizQuestionFeedback";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Trophy, RotateCcw, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

// Unified question shape used internally
interface UnifiedQuestion {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  correctId: string;
  explanation: string;
  citations?: { span_id: string; path?: string; chunk_id?: string }[];
}

function normalizeStatic(q: QuizQuestion): UnifiedQuestion {
  return {
    id: q.id,
    prompt: q.question,
    options: q.options.map((text, i) => ({ id: String(i), text })),
    correctId: String(q.correctIndex),
    explanation: q.explanation,
  };
}

function normalizeGenerated(q: GeneratedQuizQuestion): UnifiedQuestion {
  return {
    id: q.id,
    prompt: q.prompt,
    options: q.choices.map((c) => ({ id: c.id, text: c.text })),
    correctId: q.correct_choice_id,
    explanation: q.explanation_markdown,
    citations: q.citations,
  };
}

export interface QuizQuestionResult {
  questionId: string;
  prompt: string;
  selectedId: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

interface QuizRunnerProps {
  questions?: QuizQuestion[];
  generatedQuestions?: GeneratedQuizQuestion[];
  onComplete: (score: number) => void;
  onQuestionAnswered?: (result: QuizQuestionResult) => void;
  onQuestionFeedback?: (questionId: string, feedbackType: string) => void;
  hasContradictions?: boolean;
  moduleKey?: string;
  /** Section titles for "areas to review" mapping */
  sectionTitles?: { id: string; heading: string }[];
  attemptNumber?: number;
}

export function QuizRunner({
  questions,
  generatedQuestions,
  onComplete,
  onQuestionAnswered,
  onQuestionFeedback,
  hasContradictions,
  sectionTitles,
  attemptNumber = 1,
}: QuizRunnerProps) {
  const unified: UnifiedQuestion[] = generatedQuestions
    ? generatedQuestions.map(normalizeGenerated)
    : (questions || []).map(normalizeStatic);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [allCitations, setAllCitations] = useState<{ span_id: string; path?: string; chunk_id?: string }[]>([]);
  const [results, setResults] = useState<QuizQuestionResult[]>([]);
  const questionStartRef = useRef<number>(Date.now());

  if (!unified.length) {
    return <p className="text-muted-foreground text-center py-8">No quiz questions available.</p>;
  }

  const current = unified[currentIndex];

  const handleSelect = (optionId: string) => {
    if (showResult) return;
    const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000);
    const isCorrect = optionId === current.correctId;

    setSelectedId(optionId);
    setShowResult(true);
    if (isCorrect) setScore((s) => s + 1);

    const result: QuizQuestionResult = {
      questionId: current.id,
      prompt: current.prompt,
      selectedId: optionId,
      isCorrect,
      timeSpentSeconds: timeSpent,
    };
    setResults((prev) => [...prev, result]);
    onQuestionAnswered?.(result);

    if (current.citations) {
      setAllCitations((prev) => {
        const existing = new Set(prev.map((c) => c.span_id));
        const newOnes = current.citations!.filter((c) => !existing.has(c.span_id));
        return [...prev, ...newOnes];
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < unified.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedId(null);
      setShowResult(false);
      questionStartRef.current = Date.now();
    } else {
      setFinished(true);
      onComplete(score + (selectedId === current.correctId ? 0 : 0));
    }
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setSelectedId(null);
    setShowResult(false);
    setScore(0);
    setFinished(false);
    setAllCitations([]);
    setResults([]);
    questionStartRef.current = Date.now();
  };

  if (finished) {
    return <QuizResultsScreen results={results} unified={unified} score={score} allCitations={allCitations} sectionTitles={sectionTitles} onRetry={handleRetry} />;
  }

  return (
    <div>
      <QuizProgress currentIndex={currentIndex} total={unified.length} />
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <h3 className="text-lg font-semibold text-card-foreground mb-6">{current.prompt}</h3>
          {hasContradictions && <ContradictionWarning />}
          <QuizOptions current={current} selectedId={selectedId} showResult={showResult} onSelect={handleSelect} />
          {showResult && (
            <QuizExplanation
              current={current}
              onFeedback={onQuestionFeedback ? (type) => onQuestionFeedback(current.id, type) : undefined}
            />
          )}
          {showResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 flex justify-end">
              <Button onClick={handleNext} className="gap-2 gradient-primary text-primary-foreground border-0">
                {currentIndex < unified.length - 1 ? "Next Question" : "See Results"}
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* Sub-components */

function QuizProgress({ currentIndex, total }: { currentIndex: number; total: number }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <span className="text-xs font-mono text-muted-foreground">Question {currentIndex + 1} of {total}</span>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < currentIndex ? "bg-primary" : i === currentIndex ? "bg-primary animate-pulse-glow" : "bg-muted"}`} />
        ))}
      </div>
    </div>
  );
}

function ContradictionWarning() {
  return (
    <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300">
      <span>⚠️</span>
      <span>Note: Evidence sources conflict on this topic. See module for details.</span>
    </div>
  );
}

function QuizOptions({ current, selectedId, showResult, onSelect }: {
  current: UnifiedQuestion; selectedId: string | null; showResult: boolean; onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {current.options.map((option, i) => {
        const isCorrect = option.id === current.correctId;
        const isSelected = option.id === selectedId;
        let optionClass = "border border-border bg-card hover:border-primary/40 text-card-foreground";
        if (showResult) {
          if (isCorrect) optionClass = "border-primary bg-primary/10 text-primary";
          else if (isSelected && !isCorrect) optionClass = "border-destructive bg-destructive/10 text-destructive";
          else optionClass = "border-border bg-muted/30 text-muted-foreground opacity-50";
        }
        return (
          <button key={option.id} onClick={() => onSelect(option.id)} disabled={showResult}
            className={`w-full text-left p-4 rounded-lg transition-all flex items-center gap-3 ${optionClass}`}>
            <span className="w-7 h-7 rounded-full border border-current flex items-center justify-center text-xs font-mono shrink-0">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="text-sm">{option.text}</span>
            {showResult && isCorrect && <CheckCircle2 className="w-4 h-4 ml-auto shrink-0" />}
            {showResult && isSelected && !isCorrect && <XCircle className="w-4 h-4 ml-auto shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function QuizExplanation({ current, onFeedback }: { current: UnifiedQuestion; onFeedback?: (type: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
      <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground">
        <MarkdownRenderer>{current.explanation}</MarkdownRenderer>
      </div>
      {current.citations && current.citations.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/50">
          {(() => {
            const cv = validateCitations(current.citations || [], []);
            const cMap = new Map(cv.citations.map(c => [c.spanId, c]));
            return current.citations!.map((c) => {
              const v = cMap.get(c.span_id);
              return (
                <CitationBadge key={c.span_id} spanId={c.span_id} path={c.path} chunkId={c.chunk_id}
                  verified={v ? v.valid : undefined} verificationWarning={v?.warnings?.[0]} />
              );
            });
          })()}
        </div>
      )}
      {onFeedback && <QuizQuestionFeedback onFeedback={onFeedback} />}
    </motion.div>
  );
}

function QuizResultsScreen({ results, unified, score, allCitations, sectionTitles, onRetry }: {
  results: QuizQuestionResult[]; unified: UnifiedQuestion[]; score: number;
  allCitations: { span_id: string; path?: string; chunk_id?: string }[];
  sectionTitles?: { id: string; heading: string }[];
  onRetry: () => void;
}) {
  const percentage = Math.round((score / unified.length) * 100);
  const wrongResults = results.filter((r) => !r.isCorrect);

  // Simple section suggestion: match wrong question prompts to section headings by keyword overlap
  const suggestedSections = sectionTitles
    ? wrongResults.map((wr) => {
        const words = wr.prompt.toLowerCase().split(/\s+/);
        let bestMatch: typeof sectionTitles[0] | null = null;
        let bestScore = 0;
        sectionTitles.forEach((s) => {
          const headingWords = s.heading.toLowerCase().split(/\s+/);
          const overlap = words.filter((w) => w.length > 3 && headingWords.some((hw) => hw.includes(w))).length;
          if (overlap > bestScore) { bestScore = overlap; bestMatch = s; }
        });
        return bestMatch ? { questionPrompt: wr.prompt, section: bestMatch } : null;
      }).filter(Boolean) as { questionPrompt: string; section: { id: string; heading: string } }[]
    : [];

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full gradient-primary mx-auto flex items-center justify-center mb-6">
          <Trophy className="w-10 h-10 text-primary-foreground" />
        </div>
        <h3 className="text-2xl font-bold text-card-foreground mb-2">Quiz Complete!</h3>
        <p className="text-4xl font-bold gradient-text mb-2">{percentage}%</p>
        <p className="text-muted-foreground">You got {score} out of {unified.length} correct</p>
      </div>

      {/* Question breakdown */}
      <div className="space-y-2 mb-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Question Breakdown</p>
        {results.map((r, i) => (
          <div key={r.questionId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
            {r.isCorrect ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
            <span className="text-sm text-foreground flex-1 truncate">Q{i + 1}: {r.prompt.slice(0, 50)}{r.prompt.length > 50 ? "…" : ""}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" /> {r.timeSpentSeconds}s
              {r.timeSpentSeconds > 30 && <span className="text-accent-foreground ml-0.5">← slow</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Areas to review */}
      {suggestedSections.length > 0 && (
        <div className="mb-6 p-4 rounded-lg border border-border bg-card/50">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Areas to Review</p>
          <p className="text-sm text-muted-foreground mb-3">Based on your wrong answers, review these sections:</p>
          {suggestedSections.map((ss, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-foreground mb-1">
              <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
              {ss.section.heading}
            </div>
          ))}
        </div>
      )}

      {allCitations.length > 0 && (
        <div className="mb-6 text-left">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Sources Referenced</p>
          <div className="flex flex-wrap gap-1">
            {allCitations.map((c) => (
              <CitationBadge key={c.span_id} spanId={c.span_id} path={c.path} chunkId={c.chunk_id} />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RotateCcw className="w-4 h-4" /> Retry Quiz
        </Button>
      </div>
    </motion.div>
  );
}
