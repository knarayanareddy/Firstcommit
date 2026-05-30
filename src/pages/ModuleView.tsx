import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { modules as staticModules } from "@/data/onboarding-data";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionViewer } from "@/components/SectionViewer";
import { QuizRunner, QuizQuestionResult } from "@/components/QuizRunner";
import { useQuizAttempts } from "@/hooks/useQuizAttempts";
import { TrackBadge } from "@/components/TrackBadge";
import { ProtectedAction } from "@/components/ProtectedAction";
import { CitationBadge } from "@/components/CitationBadge";
import { NotesPanel } from "@/components/NotesPanel";
import { AIErrorDisplay } from "@/components/AIErrorDisplay";
import { ArrowLeft, Filter, BookOpen, BrainCircuit, Lightbulb, Star, Lock, Sparkles, ChevronDown, ChevronUp, RotateCcw, Loader2, Pencil, History, FileText, Wand2, Eye, EyeOff, AlertTriangle, Info, GitBranch, FolderCode, Dumbbell, MessageCircle, Save, Bot, RefreshCw } from "lucide-react";
import { SectionFeedback } from "@/components/SectionFeedback";
import { ModuleRating } from "@/components/ModuleRating";
import { useModuleDependencies } from "@/hooks/useModuleDependencies";
import { useGeneratedModules as useGenModulesForTitleMap } from "@/hooks/useGeneratedModules";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProgress } from "@/hooks/useProgress";
import { useNotes } from "@/hooks/useNotes";
import { useLearnerState } from "@/hooks/useLearnerState";
import { useRole } from "@/hooks/useRole";
import { useAudiencePrefs } from "@/hooks/useAudiencePrefs";
import { usePackTracks } from "@/hooks/usePackTracks";
import { useTour } from "@/hooks/useTour";
import { ModuleChatPanel } from "@/components/ModuleChatPanel";
import { useGeneratedModules, GeneratedModuleRow, GeneratedModuleData, GeneratedSection, ChangeLogEntry } from "@/hooks/useGeneratedModules";
import { useGeneratedQuiz } from "@/hooks/useGeneratedQuiz";
import { useSimplifySection, SimplifiedSection } from "@/hooks/useSimplifySection";
import { usePack } from "@/hooks/usePack";
import { AIError } from "@/lib/ai-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { toast } from "sonner";
import { ContradictionCallout } from "@/components/ContradictionCallout";
import { GenerationStats, buildModuleStats } from "@/components/GenerationStats";
import { getEffectiveLimits } from "@/lib/limits";
import { useGenerationPrefs } from "@/hooks/useGenerationPrefs";
import { validateAIOutput } from "@/lib/schema-validator";
import { validateCitations } from "@/lib/citation-validator";
import { KeyFilesSection } from "@/components/KeyFilesSection";
import { AskAnExpertWidget } from "@/components/AskAnExpertWidget";
import { CodeExplorer } from "@/components/CodeExplorer";
import { ExerciseCard } from "@/components/ExerciseCard";
import { useExercises } from "@/hooks/useExercises";
import { BookmarkButton } from "@/components/BookmarkButton";
import { useBookmarks } from "@/hooks/useBookmarks";
import { DiscussionList } from "@/components/DiscussionList";
import { ThreadDetail } from "@/components/ThreadDetail";
import type { DiscussionThread } from "@/hooks/useDiscussions";
import { EditableSection } from "@/components/EditableSection";
import { useContentFreshness } from "@/hooks/useContentFreshness";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useContextualHints } from "@/hooks/useContextualHints";
import { ContextualHintCard } from "@/components/ContextualHintCard";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function GeneratedSectionViewer({ section, index, isRead, onMarkRead, savedNote, onSaveNote, onDeleteNote, moduleKey, trackKey }: {
  section: GeneratedSection;
  index: number;
  isRead: boolean;
  onMarkRead?: () => void;
  savedNote?: string;
  onSaveNote?: (content: string) => void;
  onDeleteNote?: () => void;
  moduleKey?: string;
  trackKey?: string | null;
}) {
  const { simplifySection, getCachedSimplification } = useSimplifySection();
  const [showSimplified, setShowSimplified] = useState(false);
  const [simplified, setSimplified] = useState<SimplifiedSection | undefined>(
    moduleKey ? getCachedSimplification(moduleKey, section.section_id) : undefined
  );
  const [simplifyError, setSimplifyError] = useState<AIError | null>(null);

  const handleSimplify = () => {
    if (simplified) {
      setShowSimplified(!showSimplified);
      return;
    }
    if (!moduleKey) return;
    setSimplifyError(null);
    simplifySection.mutate(
      {
        moduleKey,
        sectionId: section.section_id,
        originalMarkdown: section.markdown,
        trackKey,
      },
      {
        onSuccess: (result) => {
          setSimplified(result);
          setShowSimplified(true);
        },
        onError: (e) => {
          if (e instanceof AIError) {
            setSimplifyError(e);
          } else {
            toast.error(e.message);
          }
        },
      }
    );
  };

  const isSimplifying = simplifySection.isPending;
  const displayMarkdown = showSimplified && simplified ? simplified.simplified_markdown : section.markdown;
  const displayCitations = showSimplified && simplified ? simplified.citations : section.citations;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className={`border rounded-xl p-6 transition-all duration-300 ${
        isRead ? "bg-card/50 border-primary/20" : "bg-card border-border hover:border-primary/30"
      }`}
      id={section.section_id}
      data-tour="module-section"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">§{index + 1}</span>
          <h3 className="font-semibold text-card-foreground">{section.heading}</h3>
          {section.markdown && /```mermaid/.test(section.markdown) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Contains diagram</TooltipContent>
            </Tooltip>
          )}
          {showSimplified && (
            <Badge variant="outline" className="text-[10px] bg-accent/50 text-accent-foreground border-accent">
              <Wand2 className="w-2.5 h-2.5 mr-0.5" /> Simplified
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <BookmarkButton
            type="module_section"
            referenceKey={`${moduleKey}:${section.section_id}`}
            label={section.heading}
            subtitle={`Module: ${moduleKey}`}
            previewText={section.markdown?.slice(0, 100)}
            data-tour="bookmark-button"
          />
          {moduleKey && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSimplify}
                  disabled={isSimplifying}
                  className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full transition-all ${
                    showSimplified
                      ? "bg-accent/20 text-accent-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent/10 hover:text-accent-foreground"
                  }`}
                >
                  {isSimplifying ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : showSimplified ? (
                    <Eye className="w-3 h-3" />
                  ) : (
                    <Wand2 className="w-3 h-3" />
                  )}
                  {isSimplifying ? "Simplifying..." : showSimplified ? "Original" : "Simplify"}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-xs">
                {showSimplified
                  ? "Switch back to the original version"
                  : "Get a simplified version adapted to your audience profile"}
              </TooltipContent>
            </Tooltip>
          )}
          {onMarkRead && (
            <button
              onClick={onMarkRead}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                isRead ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
              }`}
              data-tour="mark-read"
            >
              <BookOpen className="w-3.5 h-3.5" />
              {isRead ? "Read" : "Mark as read"}
            </button>
          )}
        </div>
      </div>

      {section.learning_objectives && section.learning_objectives.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {section.learning_objectives.map((obj, i) => (
            <span key={i} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">
              🎯 {obj}
            </span>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={showSimplified ? "simplified" : "original"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground leading-relaxed [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2 [&>pre]:my-2"
        >
          <MarkdownRenderer>{displayMarkdown}</MarkdownRenderer>
        </motion.div>
      </AnimatePresence>

      {/* Simplify error */}
      {simplifyError && (
        <div className="mt-3">
          <AIErrorDisplay error={simplifyError} compact onRetry={handleSimplify} />
        </div>
      )}

      {displayCitations && displayCitations.length > 0 && (() => {
        const citationValidation = validateCitations(displayCitations, []);
        const citationMap = new Map(citationValidation.citations.map(c => [c.spanId, c]));
        return (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border/50" data-tour="citation-badge">
            {displayCitations.map((c) => {
              const v = citationMap.get(c.span_id);
              return (
                <CitationBadge
                  key={c.span_id}
                  spanId={c.span_id}
                  path={c.path}
                  chunkId={c.chunk_id}
                  verified={v ? v.valid : undefined}
                  verificationWarning={v?.warnings?.[0]}
                />
              );
            })}
          </div>
        );
      })()}

      {onSaveNote && onDeleteNote && (
        <NotesPanel
          sectionId={section.section_id}
          notePrompts={section.note_prompts}
          savedNote={savedNote || ""}
          onSave={onSaveNote}
          onDelete={onDeleteNote}
          data-tour="notes-button"
        />
      )}

      {moduleKey && <SectionFeedback moduleKey={moduleKey} sectionId={section.section_id} />}
    </motion.div>
  );
}

function StaticTrackFilter({ activeTrack, setActiveTrack }: { activeTrack: string; setActiveTrack: (t: string) => void }) {
  const { tracks: packTracks } = usePackTracks();
  if (packTracks.length === 0) return null;
  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
      <Filter className="w-4 h-4 text-muted-foreground" />
      <button
        onClick={() => setActiveTrack("all")}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          activeTrack === "all" ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent hover:border-border"
        }`}
      >
        All Tracks
      </button>
      {packTracks.map((t) => (
        <button key={t.track_key} onClick={() => setActiveTrack(t.track_key)} className={`transition-opacity ${activeTrack !== "all" && activeTrack !== t.track_key ? "opacity-40" : ""}`}>
          <TrackBadge track={t.track_key} title={t.title} />
        </button>
      ))}
    </div>
  );
}

function AudienceMismatchBanner({ moduleAudience, moduleDepth }: { moduleAudience?: string | null; moduleDepth?: string | null }) {
  const { audience, depth } = useAudiencePrefs();
  if (!moduleAudience && !moduleDepth) return null;
  const audienceMismatch = moduleAudience && moduleAudience !== audience;
  const depthMismatch = moduleDepth && moduleDepth !== depth;
  if (!audienceMismatch && !depthMismatch) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="mb-4 bg-accent/10 border border-accent/20 rounded-xl p-4 flex items-start gap-3"
    >
      <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="text-foreground font-medium">Content may not match your preferences</p>
        <p className="text-muted-foreground text-xs mt-1">
          This module was generated for{" "}
          {moduleAudience && <span className="font-medium">{moduleAudience}</span>}
          {moduleAudience && moduleDepth && " / "}
          {moduleDepth && <span className="font-medium">{moduleDepth}</span>}
          {" "}audience. Your preference is{" "}
          <span className="font-medium">{audience}</span> / <span className="font-medium">{depth}</span>.
          Use the <Wand2 className="w-3 h-3 inline" /> Simplify button on each section to adapt it.
        </p>
      </div>
    </motion.div>
  );
}

/** Wrapper that adds per-question attempt tracking to QuizRunner */
function QuizRunnerWithTracking({ moduleKey, sectionTitles, ...props }: {
  moduleKey: string;
  sectionTitles: { id: string; heading: string }[];
} & Omit<React.ComponentProps<typeof QuizRunner>, 'onQuestionAnswered' | 'onQuestionFeedback' | 'moduleKey' | 'sectionTitles'>) {
  const { getMaxAttemptNumber, saveAttempt, saveQuestionFeedback } = useQuizAttempts(moduleKey);
  const attemptNum = useRef(getMaxAttemptNumber() + 1);

  const handleQuestionAnswered = (result: QuizQuestionResult) => {
    saveAttempt.mutate({
      module_key: moduleKey,
      question_id: result.questionId,
      selected_choice_id: result.selectedId,
      is_correct: result.isCorrect,
      time_spent_seconds: result.timeSpentSeconds,
      attempt_number: attemptNum.current,
    });
  };

  const handleQuestionFeedback = (questionId: string, feedbackType: string) => {
    saveQuestionFeedback.mutate({ question_id: questionId, feedback_type: feedbackType });
  };

  return (
    <QuizRunner
      {...props}
      moduleKey={moduleKey}
      sectionTitles={sectionTitles}
      onQuestionAnswered={handleQuestionAnswered}
      onQuestionFeedback={handleQuestionFeedback}
      attemptNumber={attemptNum.current}
    />
  );
}

/** Exercises Tab */
function ExercisesTab({ moduleKey, moduleTitle, moduleDescription }: { moduleKey: string; moduleTitle: string; moduleDescription: string }) {
  const { exercises, exercisesLoading, mySubmissions, submitExercise, verifyExercise, generateExercises, deleteExercise } = useExercises(moduleKey);
  const { hasPackPermission } = useRole();
  const [verifyingKey, setVerifyingKey] = useState<string | null>(null);

  const submissionMap = new Map(mySubmissions.map((s) => [s.exercise_key, s]));
  const completedCount = mySubmissions.filter((s) => s.status === "verified").length;

  const handleSubmit = (exerciseKey: string, content: string, submissionType: string, hintsUsed: number, timeSpent: number) => {
    submitExercise.mutate({ exerciseKey, content, submissionType, hintsUsed, timeSpentSeconds: timeSpent });
  };

  const handleVerify = async (exercise: any) => {
    const sub = submissionMap.get(exercise.exercise_key);
    if (!sub) return;
    setVerifyingKey(exercise.exercise_key);
    try {
      await verifyExercise.mutateAsync({
        exerciseKey: exercise.exercise_key,
        exerciseDescription: exercise.description,
        exerciseType: exercise.exercise_type,
        verification: exercise.verification || {},
        submission: sub.content,
      });
    } finally {
      setVerifyingKey(null);
    }
  };

  const handleGenerate = () => {
    generateExercises.mutate({ moduleTitle, moduleDescription });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-muted-foreground">
            Exercises: {completedCount}/{exercises.length} completed
          </span>
          {exercises.length > 0 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden w-32 mt-1">
              <div className="h-full bg-primary transition-all" style={{ width: `${exercises.length > 0 ? (completedCount / exercises.length) * 100 : 0}%` }} />
            </div>
          )}
        </div>
        {hasPackPermission("author") && (
          <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={handleGenerate} disabled={generateExercises.isPending}>
            {generateExercises.isPending ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-3 h-3" /> {exercises.length > 0 ? "Regenerate" : "Generate"} Exercises</>
            )}
          </Button>
        )}
      </div>

      {exercisesLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading exercises...</div>
      ) : exercises.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-2 text-foreground">No exercises yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Hands-on exercises help apply what you've learned.</p>
          {hasPackPermission("author") && (
            <Button size="sm" className="gap-2" onClick={handleGenerate} disabled={generateExercises.isPending}>
              <Sparkles className="w-3 h-3" /> Generate Exercises
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {exercises.map((ex) => (
            <ExerciseCard
              key={ex.exercise_key}
              exercise={ex}
              submission={submissionMap.get(ex.exercise_key)}
              onSubmit={(content, type, hints, time) => handleSubmit(ex.exercise_key, content, type, hints, time)}
              onVerify={() => handleVerify(ex)}
              isSubmitting={submitExercise.isPending}
              isVerifying={verifyingKey === ex.exercise_key}
            />
          ))}
        </div>
      )}
    </div>
  );
}


export default function ModuleView() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPackId } = usePack();

  const staticMod = staticModules.find((m) => m.id === moduleId);

  const { fetchModule, fetchRevisionHistory, refineModule, saveManualEdit } = useGeneratedModules();
  const { data: generatedMod, isLoading: genLoading } = fetchModule(moduleId || "");
  const { data: revisionHistory } = fetchRevisionHistory(moduleId || "");

  const isGenerated = !!generatedMod;
  const moduleData = generatedMod?.module_data;

  const { quiz: generatedQuiz, quizLoading, generateQuiz } = useGeneratedQuiz(moduleId || "");

  const { getReadSectionsForModule, toggleSection, saveQuizScore, getModuleProgress } = useProgress();
  const { getNoteForSection, saveNote, deleteNote } = useNotes(moduleId || "");
  const { updateLastOpened } = useLearnerState();
  const { hasPackPermission } = useRole();
  const { packLimits } = useGenerationPrefs();
  const { checkPrerequisitesMet } = useModuleDependencies();
  const { modules: allGenModules } = useGenModulesForTitleMap();
  const effectiveLimits = getEffectiveLimits({ max_module_words: packLimits.maxModuleWords, max_quiz_questions: packLimits.maxQuizQuestions, max_key_takeaways: packLimits.maxKeyTakeaways });

  const [searchParams] = useSearchParams();
  const initEditMode = searchParams.get("edit") === "1";

  const [activeTrack, setActiveTrack] = useState<string>("all");
  const { freshness } = useContentFreshness();

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [editMode, setEditMode] = useState(initEditMode);
  const [editableModuleData, setEditableModuleData] = useState<GeneratedModuleData | null>(null);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [changeLogOpen, setChangeLogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [codeExplorerOpen, setCodeExplorerOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<DiscussionThread | null>(null);
  const [chatOpenRequest, setChatOpenRequest] = useState<{ requestId: string; prefill?: string } | null>(null);

  const { logHelpRequest } = useTelemetry(moduleId || "");

  useEffect(() => {
    if (moduleId) updateLastOpened.mutate({ moduleId });
  }, [moduleId]);

  // Sync edits when raw data loads
  useEffect(() => {
    if (moduleData && (!editMode || !editableModuleData)) {
      setEditableModuleData(JSON.parse(JSON.stringify(moduleData)));
    }
  }, [moduleData, editMode]);

  // Handle hash navigation (Section scrolling)
  useEffect(() => {
    const hash = location.hash;
    if (hash && hash.includes("section=")) {
      const sectionId = hash.split("section=")[1];
      if (sectionId) {
        // Wait a bit for the content to render
        const timer = setTimeout(() => {
          const element = document.getElementById(sectionId);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [location.hash, isGenerated, genLoading]);

  // Cmd+D bookmark shortcut — bookmark the current module's first section
  const { toggleBookmark: bmToggle } = useBookmarks();
  useEffect(() => {
    const handler = () => {
      if (!moduleId) return;
      const title = isGenerated ? generatedMod?.title : staticMod?.title;
      const firstSection = isGenerated
        ? moduleData?.sections?.[0]
        : staticMod?.sections?.[0];
      if (firstSection) {
        const sectionId = isGenerated ? (firstSection as any).section_id : (firstSection as any).id;
        bmToggle.mutate({
          type: "module_section",
          referenceKey: `${moduleId}:${sectionId}`,
          label: isGenerated ? (firstSection as any).heading : (firstSection as any).title,
          subtitle: title ?? moduleId,
        });
      }
    };
    window.addEventListener("bookmark-current", handler);
    return () => window.removeEventListener("bookmark-current", handler);
  }, [moduleId, isGenerated, generatedMod, staticMod, moduleData]);

  const { startTour, shouldShowTour } = useTour();

  // Trigger chat micro-tour after 20 seconds
  useEffect(() => {
    if (!moduleId) return;
    const timer = setTimeout(() => {
      // Trigger if we haven't completed it yet
      if (shouldShowTour("module-reading-chat")) {
        startTour("module-reading-chat");
      }
    }, 20000); // 20 seconds
    return () => clearTimeout(timer);
  }, [moduleId, startTour, shouldShowTour]);

  // Trigger notes micro-tour on text selection
  useEffect(() => {
    if (!moduleId) return;
    const handleSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 20) {
        if (shouldShowTour("module-reading-notes")) {
          // Small delay so it feels natural
          setTimeout(() => {
            startTour("module-reading-notes");
          }, 300);
        }
      }
    };
    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, [moduleId, startTour, shouldShowTour]);

  const readSections = getReadSectionsForModule(moduleId || "");

  const activeSection = useMemo(() => {
    const sections = isGenerated ? (moduleData?.sections || []) : (staticMod?.sections || []);
    return sections.find(s => !readSections.has(isGenerated ? (s as any).section_id : (s as any).id)) || sections[0];
  }, [isGenerated, moduleData, staticMod, readSections]);

  const hintHook = useContextualHints({
    packId: currentPackId || "",
    moduleId: moduleId || "",
    moduleTitle: isGenerated ? moduleData?.title || "" : staticMod?.title || "",
    sectionId: isGenerated ? (activeSection as any)?.section_id : (activeSection as any)?.id,
    sectionTitle: isGenerated ? (activeSection as any)?.heading : (activeSection as any)?.title,
    sectionContent: isGenerated ? (activeSection as any)?.markdown : (activeSection as any)?.content,
    isSectionRead: readSections.has(isGenerated ? (activeSection as any)?.section_id : (activeSection as any)?.id),
  });

  const totalSections = isGenerated
    ? (moduleData?.sections?.length || 0)
    : (staticMod?.sections?.length || 0);

  const filteredStaticSections = useMemo(() => {
    if (!staticMod) return [];
    if (activeTrack === "all") return staticMod.sections;
    return staticMod.sections.filter((s) => s.tracks.includes(activeTrack as any));
  }, [staticMod, activeTrack]);

  // Build title map for prerequisite display
  const moduleTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    allGenModules.forEach((m) => { map[m.module_key] = m.title; });
    staticModules.forEach((m) => { map[m.id] = m.title; });
    return map;
  }, [allGenModules]);

  const prereqCheck = checkPrerequisitesMet(moduleId || "", moduleTitleMap);

  if (!staticMod && !genLoading && !generatedMod) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Module not found.</div>
      </DashboardLayout>
    );
  }

  if (genLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading module...</div>
      </DashboardLayout>
    );
  }

  // Lock screen for hard-blocked modules
  if (prereqCheck.hasHardBlock && !hasPackPermission("author")) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">This module is locked</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Complete the following prerequisites to unlock this module.
          </p>
          <div className="space-y-3 text-left max-w-sm mx-auto mb-8">
            {prereqCheck.hardUnmet.map((u) => (
              <div key={u.moduleKey} className="border border-border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{u.title || u.moduleKey}</span>
                  {u.met ? (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">✓ Done</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">{u.currentProgress}% / {u.requiredProgress}%</Badge>
                  )}
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                  <div className="h-full gradient-primary" style={{ width: `${Math.min(100, (u.currentProgress / u.requiredProgress) * 100)}%` }} />
                </div>
                {u.requiredQuizScore > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Quiz score: {u.currentQuizScore ?? 0}% / {u.requiredQuizScore}% required
                  </p>
                )}
                {!u.met && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => navigate(`/packs/${currentPackId}/modules/${u.moduleKey}`)}
                  >
                    Go to {u.title || u.moduleKey} →
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={() => navigate(`/packs/${currentPackId}/modules`)}>
            ← Back to Modules
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const canInteract = hasPackPermission("learner");

  const handleToggleRead = (sectionId: string) => {
    if (!canInteract || !moduleId) return;
    toggleSection.mutate({ moduleId, sectionId });
  };

  const handleQuizComplete = (score: number) => {
    if (!canInteract || !moduleId) return;
    const quizLen = generatedQuiz?.quiz_data?.questions?.length || staticMod?.quiz?.length || 0;
    if (quizLen > 0) saveQuizScore.mutate({ moduleId, score, total: quizLen });
  };

  const handleGenerateQuiz = () => {
    if (!moduleId) return;
    generateQuiz.mutate(
      { moduleData: moduleData || undefined, trackKey: moduleData?.track_key },
      { onSuccess: () => toast.success("Quiz generated!"), onError: (e) => toast.error(e.message) }
    );
  };

  const handleRefine = () => {
    if (!moduleId || !editableModuleData || !generatedMod) return;
    refineModule.mutate(
      {
        moduleKey: moduleId,
        authorInstruction: refineInstruction,
        existingModuleData: editableModuleData,
        currentRevision: generatedMod.module_revision,
        trackKey: editableModuleData.track_key,
      },
      {
        onSuccess: (result) => {
          setRefineInstruction("");
          setChangeLog(result.changeLog);
          setChangeLogOpen(true);
          toast.success(`Module refined by AI (Rev ${result.row.module_revision})`);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleSaveManual = () => {
    if (!moduleId || !editableModuleData || !generatedMod) return;
    saveManualEdit.mutate(
      {
        moduleKey: moduleId,
        moduleData: editableModuleData,
        currentRevision: generatedMod.module_revision,
      },
      {
        onSuccess: (result) => {
          setEditMode(false);
          toast.success(`Module saved (Rev ${result.row.module_revision})`);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const title = isGenerated ? moduleData!.title : staticMod!.title;
  const description = isGenerated ? moduleData!.description : staticMod!.description;
  const difficulty = isGenerated ? moduleData!.difficulty : staticMod!.difficulty;
  const keyTakeaways = isGenerated ? (moduleData!.key_takeaways || []) : staticMod!.key_takeaways;
  const progress = getModuleProgress(moduleId || "");

  const difficultyColor: Record<string, string> = {
    beginner: "text-green-500 bg-green-500/10",
    intermediate: "text-yellow-500 bg-yellow-500/10",
    advanced: "text-red-500 bg-red-500/10",
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => navigate(`/packs/${currentPackId}`)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>

          {/* Soft prerequisite warning */}
          {prereqCheck.hasSoftWarning && !prereqCheck.hasHardBlock && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4 bg-accent/10 border border-accent/20 rounded-xl p-4 flex items-start gap-3"
            >
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="text-foreground font-medium">Recommended prerequisites</p>
                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                  {prereqCheck.softUnmet.map((u) => (
                    <p key={u.moduleKey}>
                      Complete "{u.title || u.moduleKey}" first ({u.currentProgress}% done).{" "}
                      <button
                        onClick={() => navigate(`/packs/${currentPackId}/modules/${u.moduleKey}`)}
                        className="text-primary hover:underline"
                      >
                        Go →
                      </button>
                    </p>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Stale Content Warning */}
          {freshness.some(f => f.module_key === moduleId && f.is_stale) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-6 bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="text-foreground font-semibold">Content Staleness Warning</p>
                <p className="text-muted-foreground mt-1">
                  The underlying source code truth for this module has changed since it was generated. Some sections may be outdated or incorrect.
                </p>
                {hasPackPermission("author") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-2 border-destructive/30 hover:bg-destructive/10"
                    onClick={() => {
                      setEditMode(true);
                      setRefineInstruction("The underlying source has changed. Please review the updated code and regenerate this module to ensure accuracy.");
                    }}
                  >
                    <RefreshCw className="w-4 h-4" /> Resolve Inconsistencies
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          <div className="flex items-start gap-4 mb-2" data-tour="module-header">
            {!isGenerated && staticMod && <span className="text-4xl">{staticMod.icon}</span>}
            {isGenerated && (
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                {difficulty && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${difficultyColor[difficulty] || ""}`}>
                    {difficulty}
                  </span>
                )}
                {isGenerated && (
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    <Sparkles className="w-2.5 h-2.5 mr-0.5" /> Generated
                  </Badge>
                )}
                {isGenerated && generatedMod && (
                  <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                    Rev. {generatedMod.module_revision}
                  </Badge>
                )}
                {!canInteract && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Read Only
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1">{description}</p>

              {/* Author actions for generated modules */}
              {isGenerated && hasPackPermission("author") && !editMode && (
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => setEditMode(true)}>
                    <Pencil className="w-3 h-3" /> Edit / Refine
                  </Button>
                  {(revisionHistory?.length || 0) > 1 && (
                    <Button size="sm" variant="ghost" className="gap-2 text-xs" onClick={() => setHistoryOpen(true)}>
                      <History className="w-3 h-3" /> {revisionHistory?.length} Revisions
                    </Button>
                  )}
                </div>
              )}

              {/* Explore Code button for generated modules with citations */}
              {isGenerated && moduleData?.evidence_index && moduleData.evidence_index.length > 0 && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 text-xs"
                    onClick={() => setCodeExplorerOpen(true)}
                  >
                    <FolderCode className="w-3.5 h-3.5" /> Explore Code
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Key Takeaways */}
          {keyTakeaways.length > 0 && (
            <div className="mt-4 bg-primary/5 border border-primary/15 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Key Takeaways</span>
              </div>
              <ul className="space-y-1">
                {keyTakeaways.map((t, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Files section */}
          {isGenerated && moduleData?.evidence_index && currentPackId && (
            <KeyFilesSection
              evidenceIndex={moduleData.evidence_index}
              packId={currentPackId}
            />
          )}

          {/* Ask an Expert Widget */}
          {isGenerated && currentPackId && (
            <AskAnExpertWidget packId={currentPackId} moduleTitle={title} onHelpRequested={logHelpRequest} />
          )}

          {/* Progress bar */}
          <div className="mt-4 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-muted-foreground">
                {readSections.size}/{totalSections} sections read
              </span>
              <span className="text-xs font-mono text-primary">{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full gradient-primary transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </motion.div>

        {/* Generated module content */}
        {isGenerated && moduleData ? (
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="bg-muted border border-border mb-6 overflow-x-auto w-full flex-wrap sm:flex-nowrap" data-tour="module-tabs">
              <TabsTrigger value="content" className="gap-2 data-[state=active]:bg-card min-h-[44px]">
                <BookOpen className="w-4 h-4" /> Content
              </TabsTrigger>
              <TabsTrigger value="quiz" className="gap-2 data-[state=active]:bg-card min-h-[44px]" disabled={!canInteract}>
                <BrainCircuit className="w-4 h-4" /> Quiz
                {!canInteract && <Lock className="w-3 h-3 ml-1" />}
              </TabsTrigger>
              {moduleData?.evidence_index && moduleData.evidence_index.length > 0 && (
                <TabsTrigger value="code" className="gap-2 data-[state=active]:bg-card min-h-[44px]">
                  <FolderCode className="w-4 h-4" /> Code
                </TabsTrigger>
              )}
              <TabsTrigger value="exercises" className="gap-2 data-[state=active]:bg-card min-h-[44px]" disabled={!canInteract}>
                <Dumbbell className="w-4 h-4" /> Exercises
                {!canInteract && <Lock className="w-3 h-3 ml-1" />}
              </TabsTrigger>
              <TabsTrigger value="discussions" className="gap-2 data-[state=active]:bg-card min-h-[44px]">
                <MessageCircle className="w-4 h-4" /> Discussions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content">
              {/* Audience mismatch banner */}
              <AudienceMismatchBanner moduleAudience={moduleData?.audience} moduleDepth={moduleData?.depth} />
              {/* Contradictions callout */}
              {generatedMod?.contradictions && generatedMod.contradictions.length > 0 && (
                <div className="space-y-3 mb-6">
                  {generatedMod.contradictions.map((c: any, i: number) => (
                    <ContradictionCallout key={i} contradiction={c} index={i} />
                  ))}
                </div>
              )}
              <div className="space-y-4">
                {editMode && editableModuleData ? (
                  // EDIT MODE VIEW
                  <div className="space-y-6">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 mb-8">
                      <div className="flex items-start gap-3">
                        <Bot className="w-5 h-5 text-primary mt-1 shrink-0" />
                        <div className="flex-1">
                          <label className="text-sm font-semibold text-foreground mb-1 block">AI Refinement</label>
                          <p className="text-xs text-muted-foreground mb-3">Ask the AI to rewrite sections, expand on topics, or change the tone. It will use your manual edits below as the starting point.</p>
                          <div className="flex gap-2">
                            <Textarea
                              value={refineInstruction}
                              onChange={(e) => setRefineInstruction(e.target.value)}
                              placeholder="e.g., Make section 2 simpler, add a conclusion..."
                              className="min-h-[40px] h-[40px] resize-y py-2 text-sm"
                            />
                            <Button
                              onClick={handleRefine}
                              disabled={!refineInstruction.trim() || refineModule.isPending}
                              className="gap-2 shrink-0 h-auto"
                            >
                              {refineModule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              Ask AI
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border py-3 flex items-center justify-between shadow-sm -mx-4 px-4 sm:mx-0 sm:px-0">
                      <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                          <Pencil className="w-4 h-4 text-primary" /> Edit Mode
                        </h3>
                        <p className="text-xs text-muted-foreground">Changes are stored locally until you save.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setEditMode(false);
                          setEditableModuleData(JSON.parse(JSON.stringify(moduleData))); // revert
                        }}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveManual} disabled={saveManualEdit.isPending} className="gap-2">
                          {saveManualEdit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Revision
                        </Button>
                      </div>
                    </div>

                    {editableModuleData.sections.map((section, i) => (
                      <EditableSection
                        key={section.section_id || i}
                        section={section}
                        index={i}
                        onUpdate={(updated) => {
                          const newSections = [...editableModuleData.sections];
                          newSections[i] = updated;
                          setEditableModuleData({ ...editableModuleData, sections: newSections });
                        }}
                        onDelete={() => {
                          const newSections = editableModuleData.sections.filter((_, idx) => idx !== i);
                          setEditableModuleData({ ...editableModuleData, sections: newSections });
                        }}
                      />
                    ))}
                    
                    <Button
                      variant="outline"
                      className="w-full py-6 border-dashed"
                      onClick={() => {
                        const newSections = [...editableModuleData.sections, {
                          section_id: crypto.randomUUID(),
                          heading: "New Section",
                          markdown: "",
                        }];
                        setEditableModuleData({ ...editableModuleData, sections: newSections });
                      }}
                    >
                      + Add Section
                    </Button>
                  </div>
                ) : (
                  // READ-ONLY VIEW
                  moduleData.sections.map((section, i) => (
                    <GeneratedSectionViewer
                      key={section.section_id}
                      section={section}
                      index={i}
                      isRead={readSections.has(section.section_id)}
                      onMarkRead={canInteract ? () => handleToggleRead(section.section_id) : undefined}
                      savedNote={getNoteForSection(section.section_id)}
                      onSaveNote={canInteract ? (content) => saveNote.mutate({ sectionId: section.section_id, content }) : undefined}
                      onDeleteNote={canInteract ? () => deleteNote.mutate({ sectionId: section.section_id }) : undefined}
                      moduleKey={moduleId}
                      trackKey={moduleData.track_key}
                    />
                  ))
                )}

                {/* Endcap */}
                {readSections.size === moduleData.sections.length && moduleData.endcap && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 bg-card border border-primary/20 rounded-xl p-6"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Module Complete — Reflection</h3>
                    </div>

                    {moduleData.endcap.reflection_prompts?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Reflect on what you learned:</p>
                        <ol className="space-y-2 list-decimal list-inside">
                          {moduleData.endcap.reflection_prompts.map((p, i) => (
                            <li key={i} className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">� {p}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div className="border-t border-border pt-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none mb-3">
                        <MarkdownRenderer>{moduleData.endcap.ready_for_quiz_markdown || "You're ready for the quiz!"}</MarkdownRenderer>
                      </div>
                      {moduleData.endcap.quiz_objectives?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {moduleData.endcap.quiz_objectives.map((obj, i) => (
                            <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">📝 {obj}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Module Rating */}
                {readSections.size === moduleData.sections.length && moduleId && (
                  <div className="mt-4">
                    <ModuleRating moduleKey={moduleId} />
                  </div>
                )}

                {/* Evidence Index */}
                {moduleData.evidence_index && moduleData.evidence_index.length > 0 && (
                  <div className="mt-6">
                    <button
                      onClick={() => setEvidenceOpen(!evidenceOpen)}
                      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {evidenceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Sources ({moduleData.evidence_index.length} topics)
                    </button>
                    {evidenceOpen && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 space-y-2">
                        {moduleData.evidence_index.map((entry, i) => (
                          <div key={i} className="bg-muted/50 rounded-lg p-3">
                            <span className="text-xs font-medium text-foreground">{entry.topic}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {entry.citations.map((c) => (
                                <CitationBadge key={c.span_id} spanId={c.span_id} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Generation Stats (author+ only) */}
                {isGenerated && hasPackPermission("author") && moduleData && (
                  <GenerationStats
                    stats={buildModuleStats(
                      moduleData,
                      generatedQuiz?.quiz_data?.questions?.length || 0,
                      effectiveLimits,
                    )}
                    validationResult={(() => {
                      const raw = generatedMod?.module_data;
                      if (!raw) return null;
                      // The schema validator expects the full envelope structure sent by the AI,
                      // not just the inner module_data. We construct a synthetic one here for validation.
                      const syntheticEnvelope = {
                        type: "generate_module",
                        request_id: "validation-check",
                        pack_id: currentPackId,
                        pack_version: 1,
                        generation_meta: { total_spans_used: 0, model_name: "unknown" },
                        module: raw
                      };
                      return validateAIOutput("generate_module", syntheticEnvelope);
                    })()}
                    className="mt-4"
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="quiz">
              <ProtectedAction requiredLevel="learner" fallback={
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">You need learner access or higher to take quizzes.</p>
                </div>
              }>
                <div className="bg-card border border-border rounded-xl p-8">
                  {hasPackPermission("author") && (
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                      <div className="text-xs text-muted-foreground">
                        {generatedQuiz ? (
                          <>Generated {new Date(generatedQuiz.created_at).toLocaleDateString()}</>
                        ) : (
                          <>No generated quiz yet</>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerateQuiz}
                        disabled={generateQuiz.isPending}
                        className="gap-2 text-xs"
                      >
                        {generateQuiz.isPending ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                        ) : (
                          <><RotateCcw className="w-3 h-3" /> {generatedQuiz ? "Regenerate Quiz" : "Generate Quiz"}</>
                        )}
                      </Button>
                    </div>
                  )}

                  {quizLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading quiz...</div>
                  ) : generatedQuiz?.quiz_data?.questions?.length ? (
                    <QuizRunnerWithTracking
                      generatedQuestions={generatedQuiz.quiz_data.questions}
                      onComplete={handleQuizComplete}
                      hasContradictions={!!generatedMod?.contradictions?.length}
                      moduleKey={moduleId || ""}
                      sectionTitles={moduleData?.sections?.map(s => ({ id: s.section_id, heading: s.heading })) || []}
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No quiz available for this module yet.</p>
                      {hasPackPermission("author") && (
                        <Button size="sm" className="mt-3 gap-2" onClick={handleGenerateQuiz} disabled={generateQuiz.isPending}>
                          <Sparkles className="w-3 h-3" /> Generate Quiz
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </ProtectedAction>
            </TabsContent>

            {/* Code Explorer Tab */}
            {moduleData?.evidence_index && moduleData.evidence_index.length > 0 && currentPackId && (
              <TabsContent value="code">
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <FolderCode className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-medium mb-2">Explore Source Code</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Browse the source files referenced in this module with syntax highlighting and annotations.
                  </p>
                  <Button onClick={() => setCodeExplorerOpen(true)} className="gap-2">
                    <FolderCode className="w-4 h-4" /> Open Code Explorer
                  </Button>
                </div>
              </TabsContent>
            )}

            {/* Exercises Tab */}
            <TabsContent value="exercises">
              <ProtectedAction requiredLevel="learner" fallback={
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">You need learner access or higher for exercises.</p>
                </div>
              }>
                <ExercisesTab moduleKey={moduleId || ""} moduleTitle={moduleData?.title || generatedMod?.title || ""} moduleDescription={moduleData?.description || generatedMod?.description || ""} />
              </ProtectedAction>
            </TabsContent>

            {/* Discussions Tab */}
            <TabsContent value="discussions">
              {selectedThread ? (
                <ThreadDetail thread={selectedThread} onBack={() => setSelectedThread(null)} />
              ) : (
                <DiscussionList
                  moduleKey={moduleId}
                  onSelectThread={setSelectedThread}
                />
              )}
            </TabsContent>
          </Tabs>
        ) : staticMod ? (
          /* Static module content */
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="bg-muted border border-border mb-6 overflow-x-auto w-full flex-wrap sm:flex-nowrap">
              <TabsTrigger value="content" className="gap-2 data-[state=active]:bg-card">
                <BookOpen className="w-4 h-4" /> Content
              </TabsTrigger>
              <TabsTrigger value="quiz" className="gap-2 data-[state=active]:bg-card" disabled={!canInteract}>
                <BrainCircuit className="w-4 h-4" /> Quiz ({staticMod.quiz.length})
                {!canInteract && <Lock className="w-3 h-3 ml-1" />}
              </TabsTrigger>
              <TabsTrigger value="discussions" className="gap-2 data-[state=active]:bg-card">
                <MessageCircle className="w-4 h-4" /> Discussions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content">
              <StaticTrackFilter activeTrack={activeTrack} setActiveTrack={setActiveTrack} />

              <div className="space-y-4">
                {filteredStaticSections.map((section, i) => (
                  <SectionViewer
                    key={section.id}
                    section={section}
                    index={i}
                    isRead={readSections.has(section.id)}
                    onMarkRead={canInteract ? () => handleToggleRead(section.id) : undefined}
                    savedNote={getNoteForSection(section.id)}
                    onSaveNote={canInteract ? (content) => saveNote.mutate({ sectionId: section.id, content }) : undefined}
                    onDeleteNote={canInteract ? () => deleteNote.mutate({ sectionId: section.id }) : undefined}
                  />
                ))}
                {filteredStaticSections.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">No sections for this track in this module.</div>
                )}
              </div>

              {readSections.size === staticMod.sections.length && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-card border border-primary/20 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Module Complete — Reflection</h3>
                  </div>
                  {staticMod.endcap.reflection_prompts.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Reflect on what you learned:</p>
                      <ul className="space-y-2">
                        {staticMod.endcap.reflection_prompts.map((p, i) => (
                          <li key={i} className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">� {p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="border-t border-border pt-4">
                    <p className="text-sm text-foreground font-medium mb-2">Ready for the quiz?</p>
                    <p className="text-xs text-muted-foreground">{staticMod.endcap.ready_for_quiz_markdown}</p>
                    {staticMod.endcap.quiz_objectives.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {staticMod.endcap.quiz_objectives.map((obj, i) => (
                          <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">📝 {obj}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </TabsContent>

            <TabsContent value="quiz">
              <ProtectedAction requiredLevel="learner" fallback={
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">You need learner access or higher to take quizzes.</p>
                </div>
              }>
                <div className="bg-card border border-border rounded-xl p-8">
                  <QuizRunner questions={staticMod.quiz} onComplete={handleQuizComplete} />
                </div>
              </ProtectedAction>
            </TabsContent>

            {/* Discussions Tab (static) */}
            <TabsContent value="discussions">
              {selectedThread ? (
                <ThreadDetail thread={selectedThread} onBack={() => setSelectedThread(null)} />
              ) : (
                <DiscussionList
                  moduleKey={moduleId}
                  onSelectThread={setSelectedThread}
                />
              )}
            </TabsContent>
          </Tabs>
        ) : null}

        {/* Chat panel */}
        <ProtectedAction requiredLevel="learner">
          <ModuleChatPanel
            moduleId={moduleId || ""}
            moduleContext={{
              title,
              description: description || "",
              keyTakeaways,
              sections: isGenerated
                ? (moduleData?.sections || []).map((s) => ({ title: s.heading, content: s.markdown }))
                : (staticMod?.sections || []).map((s) => ({ title: s.title, content: s.content })),
            }}
            openRequest={chatOpenRequest}
            onOpenChange={(open) => {
              if (open) hintHook.reportChatOpen();
              else hintHook.reportChatClose();
            }}
            onAssistantError={hintHook.reportError}
          />
        </ProtectedAction>

        {/* Contextual Hint */}
        <AnimatePresence>
          {hintHook.activeHint && (
            <ContextualHintCard
              hint={hintHook.activeHint}
              onDismiss={() => hintHook.dismissHint(hintHook.activeHint!.id, true)}
              onSnooze={() => hintHook.snoozeHint(hintHook.activeHint!.id, 10)}
              onAskRocket={() => {
                const requestId = crypto.randomUUID();
                setChatOpenRequest({ 
                  requestId, 
                  prefill: hintHook.buildAskRocketPrompt() 
                });
                hintHook.dismissHint(hintHook.activeHint!.id);
              }}
            />
          )}
        </AnimatePresence>



        {/* Change Log Dialog */}
        <Dialog open={changeLogOpen} onOpenChange={setChangeLogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> Refinement Change Log
              </DialogTitle>
              <DialogDescription>
                Summary of changes made during refinement.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {changeLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes documented.</p>
              ) : (
                changeLog.map((entry, i) => (
                  <div key={i} className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-sm font-medium text-foreground">{entry.change}</p>
                    <p className="text-xs text-muted-foreground">{entry.reason}</p>
                    {entry.citations && entry.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {entry.citations.map((c) => (
                          <CitationBadge key={c.span_id} spanId={c.span_id} path={c.path} chunkId={c.chunk_id} />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Revision History Dialog */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-4 h-4" /> Revision History
              </DialogTitle>
              <DialogDescription>
                All revisions of this module.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(revisionHistory || []).map((rev) => (
                <div
                  key={rev.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    rev.module_revision === generatedMod?.module_revision
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">Rev. {rev.module_revision}</Badge>
                      {rev.module_revision === generatedMod?.module_revision && (
                        <Badge className="text-[10px] bg-primary/15 text-primary border-0">Current</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{rev.title}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Code Explorer */}
        {isGenerated && moduleData && currentPackId && (
          <CodeExplorer
            packId={currentPackId}
            moduleTitle={title || "Module"}
            moduleData={moduleData}
            isOpen={codeExplorerOpen}
            onClose={() => setCodeExplorerOpen(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
