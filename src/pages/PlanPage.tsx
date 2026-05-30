import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AIErrorDisplay } from "@/components/AIErrorDisplay";
import { HelpTooltip } from "@/components/HelpTooltip";
import { useModulePlan, ModulePlanData, DetectedSignal, ModulePlanEntry, PlanTrack } from "@/hooks/useModulePlan";
import { useGeneratedModules } from "@/hooks/useGeneratedModules";
import { useTemplates, TemplateRow } from "@/hooks/useTemplates";
import { usePackTracks, PackTrack } from "@/hooks/usePackTracks";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { useCascadeGeneration, CascadeModuleStatus, CascadeSupportStatus } from "@/hooks/useCascadeGeneration";
import { useGenerationPrefs } from "@/hooks/useGenerationPrefs";
import { AIError } from "@/lib/ai-errors";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Sparkles, CheckCircle2, AlertTriangle, Clock, BookOpen, Zap,
  ArrowRight, XCircle, RotateCcw, GripVertical, X, Plus, Pencil, Layout, Save, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { useModuleDependencies } from "@/hooks/useModuleDependencies";
import { DependencyGraph } from "@/components/DependencyGraph";
import { wouldCreateCycle, buildDependencyGraph } from "@/lib/dependency-graph";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ─── colour maps ─── */
const confidenceColors: Record<string, string> = {
  high: "bg-green-500/15 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-red-500/15 text-red-400 border-red-500/30",
};
const difficultyColors: Record<string, string> = {
  beginner: "bg-green-500/15 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/15 text-red-400 border-red-500/30",
};

/* ─── small sub-components (unchanged from before) ─── */
function SignalCard({ signal }: { signal: DetectedSignal }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <code className="text-xs font-mono text-primary">{signal.signal_key}</code>
          <Badge variant="outline" className={`text-[10px] ${confidenceColors[signal.confidence] || ""}`}>{signal.confidence}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{signal.explanation}</p>
        {signal.citations?.length > 0 && (
          <div className="flex gap-1 mt-2">
            {signal.citations.map((c) => (
              <span key={c.span_id} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c.span_id}</span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrackCard({ track }: { track: PlanTrack }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{track.track_key}</Badge>
          <span className="font-medium text-sm text-foreground">{track.title}</span>
        </div>
        <p className="text-sm text-muted-foreground">{track.description}</p>
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  if (status === "generating") return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-destructive" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

function CascadeProgress({ moduleStatuses, supportStatus }: {
  moduleStatuses: CascadeModuleStatus[];
  supportStatus: CascadeSupportStatus;
}) {
  const completedModules = moduleStatuses.filter(m => m.moduleStatus === "completed").length;
  const totalModules = moduleStatuses.length;
  const pct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Module Generation</span>
            <span className="text-sm text-muted-foreground">{completedModules}/{totalModules} modules</span>
          </div>
          <Progress value={pct} className="h-2" />
          <div className="space-y-2">
            {moduleStatuses.map(m => (
              <div key={m.moduleKey} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <StatusIcon status={m.moduleStatus} />
                  <span className="text-foreground">{m.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground capitalize">
                    {m.moduleStatus === "completed" ? "Generated (draft)" : m.moduleStatus}
                  </span>
                  {m.moduleStatus === "completed" && (
                    <span className="flex items-center gap-1 text-xs">
                      {m.quizStatus === "completed" ? (
                        <Badge variant="outline" className="text-[10px] bg-green-500/15 text-green-400 border-green-500/30">Quiz ✓</Badge>
                      ) : m.quizStatus === "generating" ? (
                        <Badge variant="outline" className="text-[10px] bg-primary/15 text-primary border-primary/30">
                          <Loader2 className="w-2 h-2 animate-spin mr-0.5" /> Quiz
                        </Badge>
                      ) : m.quizStatus === "failed" ? (
                        <Badge variant="outline" className="text-[10px] bg-destructive/15 text-destructive border-destructive/30">Quiz ✗</Badge>
                      ) : null}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-2">
          <span className="text-sm font-medium text-foreground">Supporting Content</span>
          {[
            { label: "Glossary", status: supportStatus.glossary, extra: supportStatus.glossaryTermCount ? `(${supportStatus.glossaryTermCount} terms)` : "" },
            { label: "Onboarding Paths", status: supportStatus.paths },
            { label: "Ask-Your-Lead Questions", status: supportStatus.askLead },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <StatusIcon status={item.status} />
                <span className="text-foreground">{item.label} {item.extra || ""}</span>
              </div>
              <span className="text-xs text-muted-foreground capitalize">{item.status === "completed" ? "Generated" : item.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Editable inline field helpers ─── */
function InlineTitle({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => { setEditing(false); if (draft.trim()) onChange(draft.trim()); else setDraft(value); };

  if (disabled || !editing) {
    return (
      <button
        className="font-medium text-sm text-foreground text-left group/title flex items-center gap-1 hover:underline decoration-dashed underline-offset-4 disabled:hover:no-underline"
        onClick={() => !disabled && setEditing(true)}
        disabled={disabled}
      >
        {value}
        {!disabled && <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />}
      </button>
    );
  }
  return (
    <Input
      ref={ref}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
      className="h-7 text-sm font-medium"
    />
  );
}

function InlineDescription({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => { setEditing(false); onChange(draft.trim()); };

  if (disabled || !editing) {
    return (
      <button
        className="text-sm text-muted-foreground text-left w-full group/desc flex items-start gap-1 hover:underline decoration-dashed underline-offset-4 disabled:hover:no-underline"
        onClick={() => !disabled && setEditing(true)}
        disabled={disabled}
      >
        <span className="flex-1">{value || "Add description..."}</span>
        {!disabled && <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/desc:opacity-100 transition-opacity mt-0.5 flex-shrink-0" />}
      </button>
    );
  }
  return (
    <Textarea
      ref={ref}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      className="min-h-[60px] text-sm"
    />
  );
}

function InlineMinutes({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => { setEditing(false); const n = parseInt(draft); if (!isNaN(n) && n > 0) onChange(n); else setDraft(String(value)); };

  if (disabled || !editing) {
    return (
      <button
        className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border hover:border-primary/40 transition-colors disabled:hover:border-border"
        onClick={() => !disabled && setEditing(true)}
        disabled={disabled}
      >
        <Clock className="w-2.5 h-2.5" />{value}m
      </button>
    );
  }
  return (
    <Input
      ref={ref}
      type="number"
      min={1}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(value)); setEditing(false); } }}
      className="h-6 w-16 text-xs"
    />
  );
}

/* ─── Sortable module card ─── */
interface EditableCardProps {
  mod: ModulePlanEntry;
  index: number;
  generated: boolean;
  disabled: boolean;
  tracks: PackTrack[];
  templates: TemplateRow[];
  allModules: ModulePlanEntry[];
  dependencies: { module_key: string; requires_module_key: string; requirement_type: string; id: string }[];
  onUpdate: (key: string, patch: Partial<ModulePlanEntry>) => void;
  onRemove: (key: string) => void;
  onAddDep: (moduleKey: string, reqKey: string, type: string) => void;
  onRemoveDep: (depId: string) => void;
}

function SortableModuleCard(props: EditableCardProps) {
  const { mod, index, generated, disabled, tracks, templates, allModules, dependencies, onUpdate, onRemove, onAddDep, onRemoveDep } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mod.module_key });
  const [confirmRemove, setConfirmRemove] = useState(false);

  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.6 : 1 };
  const templateMatch = templates.find(t => t.id === mod.template_id);

  return (
    <>
      <div ref={setNodeRef} style={style} {...attributes}>
        <Card className={`bg-card/50 border-border/50 transition-shadow ${isDragging ? "shadow-lg ring-2 ring-primary/30" : ""}`} data-tour="module-card-edit">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              {/* Drag handle */}
              {!disabled && (
                <button
                  {...listeners}
                  className="mt-1 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-grab active:cursor-grabbing transition-colors"
                  tabIndex={-1}
                >
                  <GripVertical className="w-4 h-4" />
                </button>
              )}

              <div className="flex-1 min-w-0 space-y-2">
                {/* Row 1: index + title + badges + remove */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground w-5 flex-shrink-0">{index + 1}.</span>
                    <InlineTitle value={mod.title} onChange={v => onUpdate(mod.module_key, { title: v })} disabled={disabled} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {generated && (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px] bg-green-500/15 text-green-400 border-green-500/30">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Generated
                        </Badge>
                        <HelpTooltip 
                          title="Why was this proposed?" 
                          content={mod.rationale || "Proposed based on detected codebase patterns. No explicit rationale provided by the AI."}
                        />
                      </div>
                    )}
                    {/* Difficulty select */}
                    {disabled ? (
                      <Badge variant="outline" className={`text-[10px] ${difficultyColors[mod.difficulty] || ""}`}>{mod.difficulty}</Badge>
                    ) : (
                      <Select value={mod.difficulty} onValueChange={v => onUpdate(mod.module_key, { difficulty: v as ModulePlanEntry["difficulty"] })}>
                        <SelectTrigger className="h-6 w-[110px] text-[10px] border-dashed">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">🌱 Beginner</SelectItem>
                          <SelectItem value="intermediate">🌿 Intermediate</SelectItem>
                          <SelectItem value="advanced">🌳 Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <InlineMinutes value={mod.estimated_minutes} onChange={v => onUpdate(mod.module_key, { estimated_minutes: v })} disabled={disabled} />
                    {!disabled && (
                      <button
                        onClick={() => setConfirmRemove(true)}
                        className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: description */}
                <InlineDescription value={mod.description} onChange={v => onUpdate(mod.module_key, { description: v })} disabled={disabled} />

                {/* Row 3: tracks, templates, citations */}

                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {/* Track select */}
                  {disabled ? (
                    mod.track_key && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{mod.track_key}</Badge>
                  ) : (
                    <Select value={mod.track_key || "__none__"} onValueChange={v => onUpdate(mod.module_key, { track_key: v === "__none__" ? null : v })}>
                      <SelectTrigger className="h-6 w-[130px] text-[10px] border-dashed">
                        <SelectValue placeholder="No track" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No track</SelectItem>
                        {tracks.map(t => <SelectItem key={t.track_key} value={t.track_key}>{t.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Template select */}
                  {disabled ? (
                    templateMatch && (
                      <Badge variant="outline" className="text-[10px] bg-accent text-accent-foreground border-border">
                        <Layout className="w-2.5 h-2.5 mr-0.5" />{templateMatch.title}
                      </Badge>
                    )
                  ) : (
                    <Select value={mod.template_id || "__none__"} onValueChange={v => onUpdate(mod.module_key, { template_id: v === "__none__" ? null : v })}>
                      <SelectTrigger className="h-6 w-[140px] text-[10px] border-dashed">
                        <Layout className="w-2.5 h-2.5 mr-0.5" />
                        <SelectValue placeholder="No template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No template</SelectItem>
                        {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}

                  {mod.citations?.map(c => (
                    <span key={c.span_id} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c.span_id}</span>
                  ))}
                </div>

                {/* Row 5: Prerequisites */}
                <div className="flex items-center gap-2 flex-wrap" data-tour="prerequisites">
                  <Link2 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-medium">Prereqs:</span>
                  {dependencies
                    .filter(d => d.module_key === mod.module_key)
                    .map(dep => {
                      const prereqMod = allModules.find(m => m.module_key === dep.requires_module_key);
                      return (
                        <span key={dep.id} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                          dep.requirement_type === "hard"
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-accent/50 text-accent-foreground border-border"
                        }`}>
                          {prereqMod?.title || dep.requires_module_key}
                          <span className="text-[8px] opacity-60">({dep.requirement_type})</span>
                          {!disabled && (
                            <button onClick={() => onRemoveDep(dep.id)} className="ml-0.5 hover:text-destructive">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  {!disabled && (
                    <Select
                      value=""
                      onValueChange={v => {
                        if (v) onAddDep(mod.module_key, v, "soft");
                      }}
                    >
                      <SelectTrigger className="h-5 w-[120px] text-[10px] border-dashed">
                        <Plus className="w-2.5 h-2.5 mr-0.5" />
                        <span>Add prereq</span>
                      </SelectTrigger>
                      <SelectContent>
                        {allModules
                          .filter(m => m.module_key !== mod.module_key)
                          .filter(m => !dependencies.some(d => d.module_key === mod.module_key && d.requires_module_key === m.module_key))
                          .map(m => (
                            <SelectItem key={m.module_key} value={m.module_key}>{m.title}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Remove confirmation */}
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove module?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{mod.title}&rdquo; from the plan? You can undo this within 5 seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmRemove(false); onRemove(mod.module_key); }}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─── Add Module form ─── */
function AddModuleForm({ tracks, onAdd, disabled }: { tracks: PackTrack[]; onAdd: (mod: ModulePlanEntry) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<ModulePlanEntry["difficulty"]>("beginner");
  const [minutes, setMinutes] = useState("15");
  const [trackKey, setTrackKey] = useState("__none__");

  const reset = () => { setTitle(""); setDescription(""); setDifficulty("beginner"); setMinutes("15"); setTrackKey("__none__"); };

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) { toast.error("Title and description are required"); return; }
    onAdd({
      module_key: `mod-custom-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      estimated_minutes: parseInt(minutes) || 15,
      difficulty,
      rationale: "Manually added by author",
      citations: [],
      track_key: trackKey === "__none__" ? null : trackKey,
      audience: null,
      depth: null,
    });
    reset();
    setOpen(false);
    toast.success("Module added to plan");
  };

  if (disabled) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full border-dashed gap-2">
          <Plus className="w-4 h-4" /> Add Module
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <Card className="border-dashed border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Title *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Module title" className="h-8 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Description *</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this module cover?" className="min-h-[60px] text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Difficulty</label>
                <Select value={difficulty} onValueChange={v => setDifficulty(v as ModulePlanEntry["difficulty"])}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Est. Minutes</label>
                <Input type="number" min={1} value={minutes} onChange={e => setMinutes(e.target.value)} className="h-8 text-sm" />
              </div>
              {tracks.length > 0 && (
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Track</label>
                  <Select value={trackKey} onValueChange={setTrackKey}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No track</SelectItem>
                      {tracks.map(t => <SelectItem key={t.track_key} value={t.track_key}>{t.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { reset(); setOpen(false); }}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit}><Plus className="w-3 h-3 mr-1" /> Add</Button>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */
export default function PlanPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentPack, currentPackId } = usePack();
  const { hasPackPermission } = useRole();
  const { packLimits } = useGenerationPrefs();
  const [searchParams, setSearchParams] = useSearchParams();
  const { plan, planLoading, generatePlan, savePlan, updatePlan, approvePlan } = useModulePlan();
  const { modules: generatedModules } = useGeneratedModules();
  const { templates } = useTemplates();
  const { tracks } = usePackTracks();
  const cascade = useCascadeGeneration();
  const { dependencies, addDependency, removeDependency } = useModuleDependencies();

  const [livePlan, setLivePlan] = useState<ModulePlanData | null>(null);
  const [planError, setPlanError] = useState<AIError | null>(null);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const undoRef = useRef<{ mod: ModulePlanEntry; idx: number; timer: ReturnType<typeof setTimeout> } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Handle actionable deep links from Help Center
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "start_generation") {
      // Small delay to ensure everything is loaded
      const timer = setTimeout(() => {
        generatePlan.mutate();
        // Clear the param
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("action");
        setSearchParams(newParams, { replace: true });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams, generatePlan]);

  // Sync DB plan into local state on first load
  useEffect(() => {
    if (plan?.plan_data && !livePlan) {
      setLivePlan(plan.plan_data as unknown as ModulePlanData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // Permission guard moved after all hooks (React rules of hooks)

  const displayPlan = livePlan;
  const isApproved = plan?.status === "approved" || plan?.status === "generating" || plan?.status === "completed";
  const editDisabled = isApproved;
  const generatedKeys = new Set(generatedModules.map((m) => m.module_key));

  // Dirty check: compare serialized plan data
  const savedPlanJson = plan?.plan_data ? JSON.stringify(plan.plan_data) : null;
  const livePlanJson = livePlan ? JSON.stringify(livePlan) : null;
  const isDirty = !!livePlan && livePlanJson !== savedPlanJson;

  /* ─── handlers ─── */
  const updateModule = useCallback((key: string, patch: Partial<ModulePlanEntry>) => {
    setLivePlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        module_plan: prev.module_plan.map(m => m.module_key === key ? { ...m, ...patch } : m),
      };
    });
  }, []);

  const removeModule = useCallback((key: string) => {
    setLivePlan(prev => {
      if (!prev) return prev;
      const idx = prev.module_plan.findIndex(m => m.module_key === key);
      if (idx === -1) return prev;
      const removed = prev.module_plan[idx];
      const next = { ...prev, module_plan: prev.module_plan.filter(m => m.module_key !== key) };

      // Clear previous undo
      if (undoRef.current) clearTimeout(undoRef.current.timer);

      const timer = setTimeout(() => { undoRef.current = null; }, 5000);
      undoRef.current = { mod: removed, idx, timer };

      toast("Module removed", {
        action: {
          label: "Undo",
          onClick: () => {
            if (!undoRef.current) return;
            const { mod: restored, idx: restoredIdx } = undoRef.current;
            clearTimeout(undoRef.current.timer);
            undoRef.current = null;
            setLivePlan(p => {
              if (!p) return p;
              const arr = [...p.module_plan];
              arr.splice(restoredIdx, 0, restored);
              return { ...p, module_plan: arr };
            });
          },
        },
        duration: 5000,
      });

      return next;
    });
  }, []);

  const addModule = useCallback((mod: ModulePlanEntry) => {
    setLivePlan(prev => {
      if (!prev) return prev;
      return { ...prev, module_plan: [...prev.module_plan, mod] };
    });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLivePlan(prev => {
      if (!prev) return prev;
      const oldIdx = prev.module_plan.findIndex(m => m.module_key === active.id);
      const newIdx = prev.module_plan.findIndex(m => m.module_key === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return { ...prev, module_plan: arrayMove(prev.module_plan, oldIdx, newIdx) };
    });
  }, []);

  if (!hasPackPermission("author")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">You need author access to view module plans.</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleGenerate = async () => {
    setPlanError(null);
    try {
      const result = await generatePlan.mutateAsync();
      setLivePlan(result);
      toast.success("Module plan generated!");
    } catch (e: any) {
      if (e instanceof AIError) setPlanError(e);
      else toast.error(e.message || "Failed to generate plan");
    }
  };

  const handleRegenerate = () => {
    if (isDirty) { setRegenDialogOpen(true); return; }
    handleGenerate();
  };

  const handleSave = async () => {
    if (!livePlan) return;
    try {
      if (plan?.id) {
        await updatePlan.mutateAsync({ planId: plan.id, planData: livePlan });
      } else {
        await savePlan.mutateAsync(livePlan);
      }
      toast.success("Plan saved as draft");
    } catch (e: any) {
      toast.error(e.message || "Failed to save plan");
    }
  };

  const handleApprove = async () => {
    if (!livePlan) return;
    try {
      // Save first, then approve
      if (plan?.id) {
        await updatePlan.mutateAsync({ planId: plan.id, planData: livePlan });
        await approvePlan.mutateAsync(plan.id);
      } else {
        const saved = await savePlan.mutateAsync(livePlan);
        if (saved?.id) await approvePlan.mutateAsync(saved.id);
      }

      // Save proposed tracks to pack_tracks
      if (livePlan.tracks?.length && currentPackId) {
        const existingKeys = new Set(tracks.map(t => t.track_key));
        const newTracks = livePlan.tracks.filter(t => !existingKeys.has(t.track_key));
        if (newTracks.length > 0) {
          const { error } = await supabase
            .from("pack_tracks")
            .upsert(
              newTracks.map(t => ({
                pack_id: currentPackId,
                track_key: t.track_key,
                title: t.title,
                description: t.description || null,
              })),
              { onConflict: "pack_id,track_key" }
            );
          if (error) console.error("Failed to save tracks:", error);
          else queryClient.invalidateQueries({ queryKey: ["pack_tracks", currentPackId] });
        }
      }

      toast.success("Plan approved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to approve plan");
    }
  };

  const handleGenerateAll = async () => {
    if (!displayPlan?.module_plan) return;
    await cascade.runCascade(displayPlan.module_plan, generatedKeys);
    toast.success("Cascade generation complete! Head to Review to publish.");
  };

  const cascadeDone = !cascade.running && cascade.moduleStatuses.length > 0 &&
    cascade.moduleStatuses.every(m => m.moduleStatus === "completed" || m.moduleStatus === "failed");

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Module Plan</h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-generated onboarding plan for <strong>{currentPack?.title || "this pack"}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {displayPlan && isDirty && (
              <Button onClick={handleSave} disabled={savePlan.isPending || updatePlan.isPending} variant="outline" size="sm">
                {(savePlan.isPending || updatePlan.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save Draft
              </Button>
            )}
            {displayPlan && !isApproved && (
              <Button onClick={handleApprove} disabled={approvePlan.isPending} variant="outline" size="sm" data-tour="approve-plan">
                {approvePlan.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Approve Plan
              </Button>
            )}
            {isApproved && !cascade.running && (
              <Button onClick={handleGenerateAll} variant="outline" size="sm">
                <ArrowRight className="w-4 h-4 mr-1" />
                Generate All Content
              </Button>
            )}
            {displayPlan && (
              <Button onClick={handleRegenerate} disabled={generatePlan.isPending || cascade.running} size="sm" variant="outline">
                {generatePlan.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                Regenerate
              </Button>
            )}
            {!displayPlan && (
              <Button onClick={handleGenerate} disabled={generatePlan.isPending} size="sm">
                {generatePlan.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Generate Plan
              </Button>
            )}
          </div>
        </div>

        {/* Cascade progress */}
        {(cascade.running || cascade.moduleStatuses.length > 0) && (
          <CascadeProgress moduleStatuses={cascade.moduleStatuses} supportStatus={cascade.supportStatus} />
        )}

        {/* Go to review after cascade */}
        {cascadeDone && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Content generation complete!</p>
                <p className="text-xs text-muted-foreground">Review and publish your content to make it available to learners.</p>
              </div>
              <Button onClick={() => navigate(`/packs/${currentPackId}/review`)} className="gap-2">
                Review & Publish <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Status */}
        {plan && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={
              plan.status === "approved" ? "bg-green-500/15 text-green-400 border-green-500/30" :
              plan.status === "draft" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" :
              plan.status === "completed" ? "bg-primary/15 text-primary border-primary/30" :
              "bg-muted text-muted-foreground border-border"
            }>
              {plan.status}
            </Badge>
            <span className="text-xs text-muted-foreground">Created {new Date(plan.created_at).toLocaleDateString()}</span>
            {isDirty && <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Unsaved changes</Badge>}
          </div>
        )}

        {/* Loading */}
        {generatePlan.isPending && (
          <Card className="border-primary/20">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Analyzing evidence spans and planning modules...</p>
              <p className="text-xs text-muted-foreground/60 mt-1">This may take 15-30 seconds</p>
            </CardContent>
          </Card>
        )}

        {/* Plan error */}
        {planError && !generatePlan.isPending && <AIErrorDisplay error={planError} onRetry={handleGenerate} />}

        {/* Empty state */}
        {!displayPlan && !generatePlan.isPending && !planLoading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No module plan yet</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Generate an AI-powered plan that analyzes your pack's sources and proposes a structured set of onboarding modules.
              </p>
              <Button onClick={handleGenerate} disabled={generatePlan.isPending} data-tour="generate-plan">
                <Sparkles className="w-4 h-4 mr-2" /> Generate Module Plan
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Plan Results */}
        {displayPlan && !generatePlan.isPending && (
          <>
            {displayPlan.warnings?.length > 0 && (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-yellow-400">Warnings</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {displayPlan.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}

            {displayPlan.detected_signals?.length > 0 && (
              <div data-tour="detected-signals">
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" /> Detected Signals
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayPlan.detected_signals.map((s) => <SignalCard key={s.signal_key} signal={s} />)}
                </div>
              </div>
            )}

            {displayPlan.tracks?.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Proposed Tracks</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayPlan.tracks.map((t) => <TrackCard key={t.track_key} track={t} />)}
                </div>
              </div>
            )}

            {displayPlan.module_plan?.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" /> Module Plan ({displayPlan.module_plan.length} modules)
                </h2>
                <div data-tour="module-plan-list">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={displayPlan.module_plan.map(m => m.module_key)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {displayPlan.module_plan.map((mod, i) => (
                        <SortableModuleCard
                          key={mod.module_key}
                          mod={mod}
                          index={i}
                          generated={generatedKeys.has(mod.module_key)}
                          disabled={editDisabled}
                          tracks={tracks}
                          templates={templates}
                          allModules={displayPlan.module_plan}
                          dependencies={dependencies.map(d => ({
                            module_key: d.module_key,
                            requires_module_key: d.requires_module_key,
                            requirement_type: d.requirement_type,
                            id: d.id,
                          }))}
                          onUpdate={updateModule}
                          onRemove={removeModule}
                          onAddDep={(moduleKey, reqKey, type) => {
                            // Check for circular dependency
                            const edges = dependencies.map(d => ({
                              moduleKey: d.module_key,
                              requiresModuleKey: d.requires_module_key,
                              requirementType: d.requirement_type as "hard" | "soft",
                              minCompletionPercentage: d.min_completion_percentage,
                              minQuizScore: d.min_quiz_score,
                            }));
                            const graph = buildDependencyGraph(
                              displayPlan.module_plan.map(m => m.module_key),
                              edges
                            );
                            if (wouldCreateCycle(graph, moduleKey, reqKey)) {
                              toast.error("Cannot add: this would create a circular dependency");
                              return;
                            }
                            addDependency.mutate(
                              { moduleKey, requiresModuleKey: reqKey, requirementType: type },
                              { onSuccess: () => toast.success("Prerequisite added") }
                            );
                          }}
                          onRemoveDep={(depId) => {
                            removeDependency.mutate(depId, {
                              onSuccess: () => toast.success("Prerequisite removed"),
                            });
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                </div>
                <div className="mt-4">
                  <AddModuleForm tracks={tracks} onAdd={addModule} disabled={editDisabled} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Regenerate warning dialog */}
      <AlertDialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits to the plan. Regenerating will replace the current plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setRegenDialogOpen(false);
                await handleSave();
                handleGenerate();
              }}
            >
              Save &amp; Regenerate
            </Button>
            <AlertDialogAction onClick={() => { setRegenDialogOpen(false); handleGenerate(); }}>
              Discard &amp; Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
