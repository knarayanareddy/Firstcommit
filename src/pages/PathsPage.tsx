import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { day1Path, week1Path, PathStep } from "@/data/paths-data";
import { TrackBadge } from "@/components/TrackBadge";
import { CitationBadge } from "@/components/CitationBadge";
import { AIErrorDisplay } from "@/components/AIErrorDisplay";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { SetupChecklist, extractShellCommands } from "@/components/SetupChecklist";
import { useGeneratedPaths, GeneratedPathStep } from "@/hooks/useGeneratedPaths";
import { usePathProgress } from "@/hooks/usePathProgress";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { usePackTracks } from "@/hooks/usePackTracks";
import { AIError } from "@/lib/ai-errors";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, Circle, Clock, Rocket, Calendar, Sparkles, RotateCcw, Loader2, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BookmarkButton } from "@/components/BookmarkButton";
import { toast } from "sonner";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP_TOOLTIPS } from "@/data/help-tooltips";

function PathCard({ step, index, checked, onToggle, citations, checkedSteps, onToggleCommand }: {
  step: PathStep | GeneratedPathStep;
  index: number;
  checked: boolean;
  onToggle: () => void;
  citations?: { span_id: string; path?: string; chunk_id?: string }[];
  checkedSteps: Set<string>;
  onToggleCommand: (commandKey: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  
  // Detect if any substep contains bash commands
  const allStepsText = step.steps.join("\n");
  const shellCommands = useMemo(() => extractShellCommands(allStepsText), [allStepsText]);
  const hasCommands = shellCommands.length > 0;
  
  // Also check for markdown code blocks in substeps
  const hasCodeBlocks = step.steps.some(s => s.includes("```"));
  const hasCallouts = step.steps.some(s => s.includes(":::"));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`bg-card border rounded-xl p-5 transition-all duration-300 ${checked ? "border-primary/30 bg-card/50" : "border-border"}`}
    >
      <div className="flex items-start gap-3">
        <button onClick={onToggle} className="mt-0.5 shrink-0">
          {checked ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
          )}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className={`font-semibold text-sm ${checked ? "text-muted-foreground line-through" : "text-card-foreground"}`}>
              {step.title}
            </h3>
            {step.track_key && <TrackBadge track={step.track_key as any} />}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {step.time_estimate_minutes}m
            </span>
            <BookmarkButton
              type="path_step"
              referenceKey={`${step.id || `step-${index}`}`}
              label={step.title}
              previewText={step.steps[0]?.slice(0, 100)}
            />
          </div>
          
          <ul className="space-y-1 mt-2">
            {step.steps.map((s, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                {hasCallouts || hasCodeBlocks ? (
                  <MarkdownRenderer className="[&_p]:inline">{s}</MarkdownRenderer>
                ) : (
                  <span className="flex items-start gap-2">
                    <span className="text-primary/50 mt-0.5">•</span>
                    {s}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {/* Interactive setup checklist for steps with commands */}
          {hasCommands && (
            <div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? "Hide" : "Show"} setup commands ({shellCommands.length})
              </button>
              {expanded && (
                <SetupChecklist
                  commands={shellCommands}
                  stepId={step.id}
                  checkedCommands={checkedSteps}
                  onToggleCommand={(cmdIdx) => onToggleCommand(`${step.id}-cmd-${cmdIdx}`)}
                />
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1">
            {step.success_criteria.map((c, i) => (
              <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                ✓ {c}
              </span>
            ))}
          </div>
          {citations && citations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/50">
              {citations.map((c) => (
                <CitationBadge key={c.span_id} spanId={c.span_id} path={c.path} chunkId={c.chunk_id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PathTabContent({ steps, pathType, isGenerated }: {
  steps: (PathStep | GeneratedPathStep)[];
  pathType: "day1" | "week1";
  isGenerated: boolean;
}) {
  const { user } = useAuth();
  const { checkedSteps, toggleStep } = usePathProgress(pathType);
  const [trackFilter, setTrackFilter] = useState<string | "all">("all");
  const { tracks: packTracks } = usePackTracks();
  // Local state for command-level checks (stored in path_progress as sub-step IDs)
  const [localCommandChecks, setLocalCommandChecks] = useState<Set<string>>(new Set());

  const tracks = useMemo(() => {
    if (packTracks.length > 0) return packTracks.map(t => t.track_key);
    const set = new Set<string>();
    steps.forEach((s) => { if (s.track_key) set.add(s.track_key as string); });
    return Array.from(set);
  }, [steps, packTracks]);

  const filtered = useMemo(() => {
    if (trackFilter === "all") return steps;
    return steps.filter((s) => s.track_key === trackFilter);
  }, [steps, trackFilter]);

  const handleToggleCommand = (commandKey: string) => {
    setLocalCommandChecks(prev => {
      const next = new Set(prev);
      if (next.has(commandKey)) next.delete(commandKey);
      else next.add(commandKey);
      return next;
    });
  };

  return (
    <div>
      {tracks.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <button
            onClick={() => setTrackFilter("all")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              trackFilter === "all" ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"
            }`}
          >
            All
          </button>
          {tracks.map((t) => {
            const pt = packTracks.find(p => p.track_key === t);
            return (
              <button
                key={t}
                onClick={() => setTrackFilter(t)}
                className={`transition-opacity ${trackFilter !== "all" && trackFilter !== t ? "opacity-40" : ""}`}
              >
                <TrackBadge track={t as any} title={pt?.title} />
              </button>
            );
          })}
        </div>
      )}
      <div className="space-y-3" data-tour="paths-step">
        {filtered.map((step, i) => (
          <PathCard
            key={step.id}
            step={step}
            index={i}
            checked={checkedSteps.has(step.id)}
            onToggle={() => { if (user) toggleStep.mutate(step.id); }}
            citations={isGenerated ? (step as GeneratedPathStep).citations : undefined}
            checkedSteps={localCommandChecks}
            onToggleCommand={handleToggleCommand}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No steps match this filter.</div>
        )}
      </div>
    </div>
  );
}

export default function PathsPage() {
  const { paths: generatedPaths, pathsLoading, generatePaths } = useGeneratedPaths();
  const { hasPackPermission } = useRole();
  const { user } = useAuth();
  const [genError, setGenError] = useState<AIError | null>(null);

  // DB-backed progress for percentage display
  const { checkedSteps: checkedDay1 } = usePathProgress("day1");
  const { checkedSteps: checkedWeek1 } = usePathProgress("week1");

  const isGenerated = !!generatedPaths?.paths_data?.day1?.length;

  const day1Steps = isGenerated ? generatedPaths!.paths_data.day1 : day1Path;
  const week1Steps = isGenerated ? generatedPaths!.paths_data.week1 : week1Path;

  const day1Progress = day1Steps.length > 0 ? Math.round((checkedDay1.size / day1Steps.length) * 100) : 0;
  const week1Progress = week1Steps.length > 0 ? Math.round((checkedWeek1.size / week1Steps.length) * 100) : 0;

  const handleGenerate = () => {
    setGenError(null);
    generatePaths.mutate(undefined, {
      onSuccess: () => toast.success("Paths generated!"),
      onError: (e) => {
        if (e instanceof AIError) setGenError(e);
        else toast.error(e.message);
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Rocket className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Onboarding Paths</h1>
              {isGenerated && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Generated
                </span>
              )}
            </div>
            {hasPackPermission("author") && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerate}
                disabled={generatePaths.isPending}
                className="gap-2 text-xs"
              >
                {generatePaths.isPending ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                ) : (
                  <><RotateCcw className="w-3 h-3" /> {isGenerated ? "Regenerate" : "Generate"}</>
                )}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Step-by-step checklists to get you productive on Day 1 and through Week 1.
            {isGenerated && generatedPaths && (
              <span className="ml-2 text-xs text-muted-foreground/70">
                Generated {new Date(generatedPaths.created_at).toLocaleDateString()}
              </span>
            )}
          </p>
        </motion.div>

        {genError && (
          <div className="mb-6">
            <AIErrorDisplay error={genError} onRetry={handleGenerate} />
          </div>
        )}

        {pathsLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading paths...</div>
        ) : (
          <Tabs defaultValue="day1" className="w-full">
            <TabsList className="bg-muted border border-border mb-6" data-tour="paths-tabs">
              <TabsTrigger value="day1" className="gap-2 data-[state=active]:bg-card">
                <Calendar className="w-4 h-4" />
                Day 1 ({day1Progress}%)
                <HelpTooltip content={HELP_TOOLTIPS.paths.day1Tab} />
              </TabsTrigger>
              <TabsTrigger value="week1" className="gap-2 data-[state=active]:bg-card">
                <Rocket className="w-4 h-4" />
                Week 1 ({week1Progress}%)
                <HelpTooltip content={HELP_TOOLTIPS.paths.week1Tab} />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="day1">
              <PathTabContent steps={day1Steps} pathType="day1" isGenerated={isGenerated} />
            </TabsContent>

            <TabsContent value="week1">
              <PathTabContent steps={week1Steps} pathType="week1" isGenerated={isGenerated} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
