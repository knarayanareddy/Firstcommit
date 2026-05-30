import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { modules as staticModules } from "@/data/onboarding-data";
import { ModuleCard } from "@/components/ModuleCard";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DependencyGraph } from "@/components/DependencyGraph";
import { motion } from "framer-motion";
import { useProgress } from "@/hooks/useProgress";
import { useGeneratedModules, GeneratedModuleRow } from "@/hooks/useGeneratedModules";
import { useModuleDependencies, PrerequisiteCheck } from "@/hooks/useModuleDependencies";
import { usePackTracks } from "@/hooks/usePackTracks";
import { usePack } from "@/hooks/usePack";
import { buildDependencyGraph, getAllModuleDepths } from "@/lib/dependency-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ChevronRight, CheckCircle2, Sparkles, BookOpen, Filter, Lock, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrackBadge } from "@/components/TrackBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function GeneratedModuleCard({ mod, index, progress, onClick, prereqCheck, moduleTitleMap, effectivePackId }: {
  mod: GeneratedModuleRow;
  index: number;
  progress: number;
  onClick: () => void;
  prereqCheck: PrerequisiteCheck;
  moduleTitleMap: Record<string, string>;
  effectivePackId: string | null;
}) {
  const navigate = useNavigate();
  const isComplete = progress === 100;
  const isHardLocked = prereqCheck.hasHardBlock;
  const hasSoftWarning = prereqCheck.hasSoftWarning && !prereqCheck.hasHardBlock;

  const handleClick = () => {
    if (isHardLocked) return; // don't navigate
    onClick();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      onClick={handleClick}
      className={`group relative border rounded-xl p-6 transition-all duration-300 ${
        isHardLocked
          ? "bg-muted/50 border-border opacity-70 cursor-not-allowed"
          : "bg-card border-border cursor-pointer hover:border-primary/40 hover:glow-border"
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl overflow-hidden bg-muted">
        <div className="h-full gradient-primary transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex items-start justify-between mb-4 mt-2">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isHardLocked ? "bg-muted" : "bg-primary/10"}`}>
            {isHardLocked ? <Lock className="w-5 h-5 text-muted-foreground" /> : <BookOpen className="w-5 h-5 text-primary" />}
          </div>
          <div>
            <h3 className={`font-semibold transition-colors ${isHardLocked ? "text-muted-foreground" : "text-card-foreground group-hover:text-primary"}`}>
              {mod.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{mod.estimated_minutes || 15} min</span>
              <span>•</span>
              <span>{(mod.module_data as any)?.sections?.length || 0} sections</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isHardLocked && prereqCheck.allMet && prereqCheck.unmet.length === 0 && prereqCheck.hardUnmet.length === 0 && prereqCheck.softUnmet.length === 0 && (
            // Has prereqs but all met - don't show badge if no prereqs at all
            null
          )}
          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
            Generated
          </Badge>
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          ) : isHardLocked ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help"><Lock className="w-5 h-5 text-muted-foreground shrink-0" /></div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[250px]">
                  <p className="text-xs font-medium">Locked. You must complete "{prereqCheck.hardUnmet[0]?.title || prereqCheck.hardUnmet[0]?.moduleKey}" first.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          )}
        </div>
      </div>

      {/* Hard lock message */}
      {isHardLocked && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
            <Lock className="w-3.5 h-3.5" /> Prerequisites required
          </div>
          {prereqCheck.hardUnmet.map((u) => (
            <div key={u.moduleKey} className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>Complete "{u.title || u.moduleKey}" ({u.currentProgress}% / {u.requiredProgress}%)</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/packs/${effectivePackId}/modules/${u.moduleKey}`);
                }}
              >
                Go →
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Soft warning */}
      {hasSoftWarning && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-accent-foreground mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" /> Recommended first
          </div>
          {prereqCheck.softUnmet.map((u) => (
            <div key={u.moduleKey} className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>"{u.title || u.moduleKey}" ({u.currentProgress}%)</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/packs/${effectivePackId}/modules/${u.moduleKey}`);
                }}
              >
                Go →
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {mod.description || "AI-generated module"}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {mod.track_key && <TrackBadge track={mod.track_key as any} />}
      </div>
    </motion.div>
  );
}

export default function Modules() {
  const navigate = useNavigate();
  const { packId } = useParams();
  const { getModuleProgress } = useProgress();
  const { modules: generatedModules, modulesLoading } = useGeneratedModules();
  const { currentPack, currentPackId } = usePack();
  const { tracks: packTracks } = usePackTracks();
  const { dependencies, toDependencyEdges, checkPrerequisitesMet } = useModuleDependencies();
  const effectivePackId = packId || currentPackId;
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [graphOpen, setGraphOpen] = useState(false);

  const hasGenerated = generatedModules.length > 0;
  const hasDeps = dependencies.length > 0;

  // Build title map for prerequisite display
  const moduleTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    generatedModules.forEach((m) => { map[m.module_key] = m.title; });
    staticModules.forEach((m) => { map[m.id] = m.title; });
    return map;
  }, [generatedModules]);

  // Sort generated modules by dependency depth
  const sortedGenerated = useMemo(() => {
    if (dependencies.length === 0) return generatedModules;
    const edges = toDependencyEdges();
    const graph = buildDependencyGraph(
      generatedModules.map((m) => m.module_key),
      edges
    );
    const depths = getAllModuleDepths(graph);
    return [...generatedModules].sort((a, b) => {
      const da = depths[a.module_key] || 0;
      const db = depths[b.module_key] || 0;
      return da - db;
    });
  }, [generatedModules, dependencies, toDependencyEdges]);

  const filteredGenerated = useMemo(() => {
    if (trackFilter === "all") return sortedGenerated;
    return sortedGenerated.filter((m) => m.track_key === trackFilter);
  }, [sortedGenerated, trackFilter]);

  const graphModules = useMemo(() =>
    generatedModules.map((m) => ({ moduleKey: m.module_key, title: m.title })),
    [generatedModules]
  );

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">All Modules</h1>
          <p className="text-muted-foreground text-sm">Browse and complete onboarding modules at your own pace.</p>
        </motion.div>

        {/* Dependency Graph (collapsible) */}
        {hasGenerated && hasDeps && (
          <Collapsible open={graphOpen} onOpenChange={setGraphOpen} className="mb-6">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2">
              {graphOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Module Dependency Map
            </CollapsibleTrigger>
            <CollapsibleContent>
              <DependencyGraph modules={graphModules} />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Track Filter */}
        {hasGenerated && packTracks.length > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <button
              onClick={() => setTrackFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                trackFilter === "all" ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"
              }`}
            >
              All Tracks
            </button>
            {packTracks.map((t) => (
              <button key={t.track_key} onClick={() => setTrackFilter(t.track_key)} className={`transition-opacity ${trackFilter !== "all" && trackFilter !== t.track_key ? "opacity-40" : ""}`}>
                <TrackBadge track={t.track_key} title={t.title} />
              </button>
            ))}
          </div>
        )}

        {/* Generated modules */}
        {hasGenerated && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Generated Modules</h2>
              <Badge variant="outline" className="text-[10px]">{filteredGenerated.length}</Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredGenerated.map((mod, i) => (
                <GeneratedModuleCard
                  key={mod.id}
                  mod={mod}
                  index={i}
                  progress={getModuleProgress(mod.module_key)}
                  prereqCheck={checkPrerequisitesMet(mod.module_key, moduleTitleMap)}
                  moduleTitleMap={moduleTitleMap}
                  effectivePackId={effectivePackId}
                  onClick={() => navigate(`/packs/${effectivePackId}/modules/${mod.module_key}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Static modules */}
        <div>
          {hasGenerated && (
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Default Modules</h2>
              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Static</Badge>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {staticModules.map((mod, i) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                index={i}
                progress={getModuleProgress(mod.id)}
                onClick={() => navigate(`/packs/${effectivePackId}/modules/${mod.id}`)}
              />
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
