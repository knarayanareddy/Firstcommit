import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { modules as staticModules } from "@/data/onboarding-data";
import { ModuleCard } from "@/components/ModuleCard";
import { ProgressChart } from "@/components/ProgressChart";
import { StatsStrip } from "@/components/StatsStrip";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Rocket, Play, Package, Sparkles, ChevronRight, CheckCircle2, Database, Map, BookOpen, FileText, ArrowRight, Pin, Bookmark, Lock, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useBookmarks } from "@/hooks/useBookmarks";
import { motion } from "framer-motion";
import { useProgress } from "@/hooks/useProgress";
import { useLearnerState } from "@/hooks/useLearnerState";
import { usePackFromUrl, usePack } from "@/hooks/usePack";
import { IngestionStatus } from "@/components/IngestionStatus";
import { useGeneratedModules, GeneratedModuleRow } from "@/hooks/useGeneratedModules";
import { useSources } from "@/hooks/useSources";
import { useModulePlan } from "@/hooks/useModulePlan";
import { useRole } from "@/hooks/useRole";
import { useModuleDependencies } from "@/hooks/useModuleDependencies";
import { TrackBadge } from "@/components/TrackBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SourcesUpdatedBanner } from "@/components/SourcesUpdatedBanner";
import { ExportProgressButton } from "@/components/ExportProgressButton";
import { SuggestedNextAction } from "@/components/SuggestedNextAction";
import { CohortWidget } from "@/components/CohortWidget";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLearnerOnboardingCheck } from "@/hooks/useLearnerOnboardingCheck";
import { LearnerOnboardingWizard } from "@/components/LearnerOnboardingWizard";
import { useDemoPack } from "@/hooks/useDemoPack";
import { GraduationModal } from "@/components/GraduationModal";
import { useEffect } from "react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 } as const,
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 20 } },
};

const difficultyColor: Record<string, string> = {
  beginner: "text-green-500 bg-green-500/10",
  intermediate: "text-yellow-500 bg-yellow-500/10",
  advanced: "text-red-500 bg-red-500/10",
};

function PinnedBookmarksWidget() {
  const { pinnedBookmarks } = useBookmarks();
  const navigate = useNavigate();
  const { currentPackId } = usePack();
  if (pinnedBookmarks.length === 0) return null;
  const prefix = `/packs/${currentPackId}`;

  const handleNav = (b: typeof pinnedBookmarks[0]) => {
    switch (b.bookmark_type) {
      case "module_section":
      case "exercise": {
        const [modKey] = b.reference_key.split(":");
        navigate(`${prefix}/modules/${modKey}`);
        break;
      }
      case "glossary_term": navigate(`${prefix}/glossary`); break;
      case "path_step": navigate(`${prefix}/paths`); break;
      case "ask_lead_question": navigate(`${prefix}/ask-lead`); break;
      default: break;
    }
  };

  return (
    <div className="mb-6">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Pin className="w-3.5 h-3.5 text-primary" /> Pinned References
          </h3>
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate(`${prefix}/bookmarks`)}
          >
            Manage Pins →
          </button>
        </div>
        <div className="space-y-1.5">
          {pinnedBookmarks.map((b) => (
            <button
              key={b.id}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted transition-colors"
              onClick={() => handleNav(b)}
            >
              <Bookmark className="w-3 h-3 text-primary shrink-0 fill-primary" />
              <span className="truncate">{b.label ?? b.reference_key}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0 ml-auto" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GeneratedModuleCard({ mod, index, progress, onClick, prereqCheck }: {
  mod: GeneratedModuleRow;
  index: number;
  progress: number;
  onClick: () => void;
  prereqCheck?: ReturnType<typeof useModuleDependencies>["checkPrerequisitesMet"] extends (k: string) => infer R ? R : any;
}) {
  const isComplete = progress === 100;
  const isHardLocked = prereqCheck?.hasHardBlock;

  const handleClick = () => {
    if (isHardLocked) return;
    onClick();
  };

  return (
    <motion.div variants={item} className={`group relative overflow-hidden transition-all duration-300 ${
      isHardLocked ? "cursor-not-allowed opacity-80" : "cursor-pointer"
    }`} onClick={handleClick}>
      <div className={`bg-card border rounded-xl p-5 transition-all relative overflow-hidden ${
        isHardLocked ? "bg-muted/30 border-border" : "border-border hover:border-primary/30"
      }`}>
        <div className="absolute top-0 left-0 h-1 bg-muted w-full">
          <div className="h-full gradient-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-start justify-between mt-1">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isHardLocked ? "bg-muted" : "bg-primary/10"
            }`}>
              {isHardLocked ? <Lock className="w-5 h-5 text-muted-foreground" /> : <Sparkles className="w-5 h-5 text-primary" />}
            </div>
            <div>
              <h3 className={`font-semibold transition-colors text-sm ${
                isHardLocked ? "text-muted-foreground" : "text-card-foreground group-hover:text-primary"
              }`}>{mod.title}</h3>
              {mod.difficulty && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${difficultyColor[mod.difficulty] || ""}`}>{mod.difficulty}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{progress}%</span>
            {isComplete ? (
              <CheckCircle2 className="w-4 h-4 text-primary" />
            ) : isHardLocked ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help"><Lock className="w-4 h-4 text-muted-foreground shrink-0" /></div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[250px]">
                    <p className="text-xs font-medium">Locked. You must complete "{prereqCheck.hardUnmet[0]?.title || prereqCheck.hardUnmet[0]?.moduleKey}" first.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
          </div>
        </div>
        {mod.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{mod.description}</p>}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {mod.estimated_minutes && <span className="text-[10px] text-muted-foreground">~{mod.estimated_minutes} min</span>}
          {mod.track_key && <TrackBadge track={mod.track_key as any} />}
          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary/70 border-primary/20">
            <Sparkles className="w-2 h-2 mr-0.5" /> AI Generated
          </Badge>
        </div>
      </div>
    </motion.div>
  );
}

function AuthorStepper({ sourceCount, planCount, draftCount, publishedCount, packId }: {
  sourceCount: number; planCount: number; draftCount: number; publishedCount: number; packId: string;
}) {
  const navigate = useNavigate();
  const steps = [
    { label: "Sources", done: sourceCount > 0, link: `/packs/${packId}/sources` },
    { label: "Plan", done: planCount > 0, link: `/packs/${packId}/plan` },
    { label: "Generate", done: draftCount > 0 || publishedCount > 0, link: `/packs/${packId}/plan` },
    { label: "Publish", done: publishedCount > 0, link: `/packs/${packId}/review` },
  ];
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1">
          <button
            onClick={() => navigate(s.link)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              s.done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s.done ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-muted-foreground/40 inline-block" />}
            {s.label}
          </button>
          {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
        </div>
      ))}
    </div>
  );
}

function SetupEmptyState({ packId }: { packId: string }) {
  const navigate = useNavigate();
  const { hasPackPermission } = useRole();
  const isAuthor = hasPackPermission("author");
  const { loadDemo } = useDemoPack();
  
  const { data: sourceCount = 0 } = useQuery({
    queryKey: ["source_count", packId],
    queryFn: async () => {
      const { count } = await supabase.from("pack_sources").select("id", { count: "exact", head: true }).eq("pack_id", packId);
      return count || 0;
    },
    enabled: !!packId,
  });

  const { data: planCount = 0 } = useQuery({
    queryKey: ["plan_count", packId],
    queryFn: async () => {
      const { count } = await supabase.from("module_plans").select("id", { count: "exact", head: true }).eq("pack_id", packId).eq("status", "approved");
      return count || 0;
    },
    enabled: !!packId,
  });

  const { data: draftModuleCount = 0 } = useQuery({
    queryKey: ["draft_module_count", packId],
    queryFn: async () => {
      const { count } = await supabase.from("generated_modules").select("id", { count: "exact", head: true }).eq("pack_id", packId).eq("status", "draft");
      return count || 0;
    },
    enabled: !!packId,
  });

  const { data: publishedModuleCount = 0 } = useQuery({
    queryKey: ["published_module_count", packId],
    queryFn: async () => {
      const { count } = await supabase.from("generated_modules").select("id", { count: "exact", head: true }).eq("pack_id", packId).eq("status", "published");
      return count || 0;
    },
    enabled: !!packId,
  });

  if (!isAuthor) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-8 text-center">
        <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Content Coming Soon</h3>
        <p className="text-muted-foreground text-sm">Your team is preparing onboarding content. Check back soon!</p>
      </motion.div>
    );
  }

  return (
    <div>
      <AuthorStepper sourceCount={sourceCount} planCount={planCount} draftCount={draftModuleCount} publishedCount={publishedModuleCount} packId={packId} />

      {sourceCount === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-primary/20 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">No sources connected yet</h3>
              <p className="text-sm text-muted-foreground">Connect your GitHub repos and documents to get started.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <Button onClick={() => navigate(`/packs/${packId}/sources`)} className="gradient-primary text-primary-foreground border-0 gap-2">
              Add Sources <ArrowRight className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              onClick={() => loadDemo.mutate()} 
              disabled={loadDemo.isPending}
              className="gap-2 border-primary/20 hover:bg-primary/5"
            >
              {loadDemo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              Load Demo Pack
            </Button>
          </div>
        </motion.div>
      ) : planCount === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-primary/20 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Map className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Sources synced! Generate a learning plan</h3>
              <p className="text-sm text-muted-foreground">Let AI analyze your codebase and propose onboarding modules.</p>
            </div>
          </div>
          <Button onClick={() => navigate(`/packs/${packId}/plan`)} className="gradient-primary text-primary-foreground border-0 gap-2 mt-2">
            Generate Plan <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      ) : draftModuleCount > 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-primary/20 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Content generated! Review and publish</h3>
              <p className="text-sm text-muted-foreground">{draftModuleCount} draft module(s) ready for review.</p>
            </div>
          </div>
          <Button onClick={() => navigate(`/packs/${packId}/review`)} className="gradient-primary text-primary-foreground border-0 gap-2 mt-2">
            Review & Publish <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      ) : publishedModuleCount === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-primary/20 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Plan approved! Generate content</h3>
              <p className="text-sm text-muted-foreground">Generate onboarding content from your approved plan.</p>
            </div>
          </div>
          <Button onClick={() => navigate(`/packs/${packId}/plan`)} className="gradient-primary text-primary-foreground border-0 gap-2 mt-2">
            Generate Content <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      ) : null}
    </div>
  );
}

const Index = () => {
  const { packId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getModuleProgress, totalSectionsRead, totalSections: staticTotalSections, completedModules: staticCompletedModules, progressData } = useProgress();
  const { lastOpenedModuleId } = useLearnerState();
  const { currentPack } = usePackFromUrl();
  const { modules: allGenModules, modulesLoading } = useGeneratedModules();
  const { hasPackPermission } = useRole();
  const isAuthor = hasPackPermission("author");
  const { hasCompletedOnboarding, isChecking: onboardingChecking } = useLearnerOnboardingCheck();
  const [showLearnerWizard, setShowLearnerWizard] = useState(false);
  const [showGraduation, setShowGraduation] = useState(false);
  const [hasGraduated, setHasGraduated] = useState(false);

  // Show wizard for non-author learners who haven't completed onboarding
  const shouldShowWizard = !isAuthor && !hasCompletedOnboarding && !onboardingChecking;

  // Learners see only published; authors see all
  const generatedModules = isAuthor ? allGenModules : allGenModules.filter(m => m.status === "published");
  const useGenerated = generatedModules.length > 0;
  const effectivePackId = packId || currentPack?.id || "";

  const genStats = useMemo(() => {
    if (!useGenerated) return null;
    const moduleProgresses = generatedModules.map((mod) => {
      const sectionCount = (mod.module_data?.sections?.length) || 0;
      const readCount = progressData.filter((p) => p.module_id === mod.module_key).length;
      const pct = sectionCount > 0 ? Math.round((readCount / sectionCount) * 100) : (readCount > 0 ? 50 : 0);
      return { mod, sectionCount, readCount, pct };
    });
    const totalSections = moduleProgresses.reduce((a, m) => a + m.sectionCount, 0);
    const totalRead = moduleProgresses.reduce((a, m) => a + m.readCount, 0);
    const completedModules = moduleProgresses.filter((m) => m.pct === 100).length;
    const avgProgress = moduleProgresses.length > 0
      ? Math.round(moduleProgresses.reduce((a, m) => a + m.pct, 0) / moduleProgresses.length) : 0;
    return { moduleProgresses, totalSections, totalRead, completedModules, avgProgress };
  }, [useGenerated, generatedModules, progressData]);

  const getGenModuleProgress = (moduleKey: string): number => {
    if (!genStats) return 0;
    return genStats.moduleProgresses.find((m) => m.mod.module_key === moduleKey)?.pct || 0;
  };

  const effectiveGetProgress = useGenerated ? getGenModuleProgress : getModuleProgress;
  const effectiveTotalSections = useGenerated ? (genStats?.totalSections || 0) : staticTotalSections;
  const effectiveTotalRead = useGenerated ? (genStats?.totalRead || 0) : totalSectionsRead;
  const effectiveCompleted = useGenerated ? (genStats?.completedModules || 0) : staticCompletedModules;
  const effectiveModuleCount = useGenerated ? generatedModules.length : staticModules.length;

  const avgProgress = useGenerated
    ? (genStats?.avgProgress || 0)
    : Math.round(staticModules.reduce((a, m) => a + getModuleProgress(m.id), 0) / staticModules.length);

  const chartData = useMemo(() => {
    if (useGenerated) {
      return generatedModules.map((mod) => ({
        module: mod.title.length > 14 ? mod.title.slice(0, 14) + "…" : mod.title,
        progress: getGenModuleProgress(mod.module_key),
        fullMark: 100,
      }));
    }
    return staticModules.map((mod) => ({
      module: mod.title.length > 14 ? mod.title.slice(0, 14) + "…" : mod.title,
      progress: getModuleProgress(mod.id),
      fullMark: 100,
    }));
  }, [useGenerated, generatedModules, genStats, progressData]);

  const { checkPrerequisitesMet } = useModuleDependencies();

  const resumeTarget = useMemo(() => {
    const isUnlocked = (key: string) => !checkPrerequisitesMet(key).hasHardBlock;

    if (useGenerated) {
      const last = lastOpenedModuleId ? generatedModules.find((m) => m.module_key === lastOpenedModuleId) : null;
      if (last && getGenModuleProgress(last.module_key) < 100 && isUnlocked(last.module_key))
        return { id: last.module_key, title: last.title, progress: getGenModuleProgress(last.module_key) };
      const next = generatedModules.find((m) => getGenModuleProgress(m.module_key) < 100 && isUnlocked(m.module_key));
      if (next) return { id: next.module_key, title: next.title, progress: getGenModuleProgress(next.module_key) };
      return null;
    }
    const lastModule = lastOpenedModuleId ? staticModules.find((m) => m.id === lastOpenedModuleId) : null;
    const nextIncomplete = staticModules.find((m) => getModuleProgress(m.id) < 100 && isUnlocked(m.id));
    const resumeModule = lastModule && getModuleProgress(lastModule.id) < 100 && isUnlocked(lastModule.id) ? lastModule : nextIncomplete;
    if (resumeModule) return { id: resumeModule.id, title: resumeModule.title, progress: getModuleProgress(resumeModule.id) };
    return null;
  }, [useGenerated, generatedModules, lastOpenedModuleId, genStats, progressData, checkPrerequisitesMet]);

  const hasContent = useGenerated || staticModules.length > 0;
  const showEmptyState = !useGenerated && !modulesLoading;

  useEffect(() => {
    if (effectiveModuleCount > 0 && effectiveCompleted === effectiveModuleCount && !hasGraduated) {
      setShowGraduation(true);
      setHasGraduated(true);
    }
  }, [effectiveCompleted, effectiveModuleCount, hasGraduated]);

  return (
    <>
      {(shouldShowWizard || showLearnerWizard) && (
        <LearnerOnboardingWizard
          onComplete={() => {
            setShowLearnerWizard(false);
            queryClient.invalidateQueries({ queryKey: ["learner_onboarding_check"] });
          }}
        />
      )}
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring" as const, stiffness: 200, damping: 18 }}
          className="mb-8"
          data-tour="dashboard-hero"
        >
          <div className="flex items-center gap-3 mb-2">
            <motion.div animate={{ rotate: [0, -10, 10, -5, 0] }} transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}>
              <Rocket className="w-7 h-7 text-primary" />
            </motion.div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Welcome to <span className="gradient-text">RocketBoard</span>
            </h1>
          </div>

          {currentPack && (
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Pack: <span className="font-medium text-foreground">{currentPack.title}</span>
              </span>
              {useGenerated && (
                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary/70 border-primary/20">
                  <Sparkles className="w-2 h-2 mr-0.5" /> AI-Generated Content
                </Badge>
              )}
            </div>
          )}

          <p className="text-muted-foreground max-w-xl">
            Your onboarding launchpad. Complete modules, take notes, pass quizzes, and get up to speed.
          </p>

          {resumeTarget && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              onClick={() => navigate(`/packs/${effectivePackId}/modules/${resumeTarget.id}`)}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg gradient-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity w-full sm:w-auto justify-center sm:justify-start"
              data-tour="continue-learning"
            >
              <Play className="w-4 h-4" />
              Continue: {resumeTarget.title} ({resumeTarget.progress}%)
            </motion.button>
          )}
          <div data-tour="suggested-action">
            <SuggestedNextAction />
          </div>
        </motion.div>

        {/* Sources updated banner */}
        <SourcesUpdatedBanner />
        {/* Pinned Bookmarks Widget */}
        <PinnedBookmarksWidget />
        {/* Ingestion Status */}
        <div className="mb-6">
          <IngestionStatus />
        </div>

        {/* Empty state for authors */}
        {showEmptyState && effectivePackId && (
          <div className="mb-8">
            <SetupEmptyState packId={effectivePackId} />
          </div>
        )}

        {/* Stats strip */}
        {(useGenerated || staticModules.length > 0) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-8" data-tour="stats-strip">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Stats</span>
              <ExportProgressButton />
            </div>
            <StatsStrip
              completedModules={effectiveCompleted}
              totalSectionsRead={effectiveTotalRead}
              totalSections={effectiveTotalSections}
              totalModules={effectiveModuleCount}
            />
          </motion.div>
        )}

        {/* Cohort Widget */}
        <div className="mb-8">
          <CohortWidget />
        </div>

        {/* Progress bar + chart row */}
        {(useGenerated || staticModules.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <div className="lg:col-span-2 flex flex-col justify-center">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, type: "spring" as const }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">Overall Progress</span>
                  <span className="text-sm font-mono text-primary">{avgProgress}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <motion.div className="h-full gradient-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${avgProgress}%` }} transition={{ duration: 1, delay: 0.5, ease: "easeOut" }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{effectiveCompleted} of {effectiveModuleCount} modules completed</p>
              </motion.div>
            </div>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, type: "spring" as const }}>
              <ProgressChart chartData={chartData} />
            </motion.div>
          </div>
        )}

        {/* Module grid */}
        {modulesLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">Loading modules...</div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5" data-tour="module-grid">
            {useGenerated
              ? generatedModules.map((mod, i) => (
                  <GeneratedModuleCard
                    key={mod.module_key}
                    mod={mod}
                    index={i}
                    progress={getGenModuleProgress(mod.module_key)}
                    prereqCheck={checkPrerequisitesMet(mod.module_key)}
                    onClick={() => navigate(`/packs/${effectivePackId}/modules/${mod.module_key}`)}
                  />
                ))
              : staticModules.map((mod, i) => (
                  <motion.div key={mod.id} variants={item}>
                    <ModuleCard
                      module={mod}
                      index={i}
                      progress={getModuleProgress(mod.id)}
                      onClick={() => navigate(`/packs/${effectivePackId}/modules/${mod.id}`)}
                    />
                  </motion.div>
                ))}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
      <GraduationModal 
        isOpen={showGraduation} 
        onClose={() => setShowGraduation(false)} 
        packTitle={currentPack?.title || "Onboarding Pack"}
        packId={effectivePackId}
      />
    </>
  );
};

export default Index;
