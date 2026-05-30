import { useMemo } from "react";
import { useModuleDependencies } from "@/hooks/useModuleDependencies";
import { useProgress } from "@/hooks/useProgress";
import { buildDependencyGraph, getAllModuleDepths } from "@/lib/dependency-graph";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { Lock, CheckCircle2, Circle, Play } from "lucide-react";

interface DependencyGraphProps {
  modules: { moduleKey: string; title: string }[];
  compact?: boolean;
}

export function DependencyGraph({ modules, compact = false }: DependencyGraphProps) {
  const { dependencies, toDependencyEdges, checkPrerequisitesMet } = useModuleDependencies();
  const { getModuleProgress } = useProgress();

  const mermaidCode = useMemo(() => {
    if (dependencies.length === 0) return null;

    const edges = toDependencyEdges();
    const graph = buildDependencyGraph(
      modules.map((m) => m.moduleKey),
      edges
    );
    const depths = getAllModuleDepths(graph);

    const titleMap: Record<string, string> = {};
    modules.forEach((m) => {
      // Sanitize title for mermaid - remove special chars
      titleMap[m.moduleKey] = m.title.replace(/[[\](){}|#&;]/g, "").substring(0, 30);
    });

    const lines: string[] = ["graph LR"];

    // Sort by depth for layout
    const sorted = [...modules].sort((a, b) => (depths[a.moduleKey] || 0) - (depths[b.moduleKey] || 0));

    for (const mod of sorted) {
      const progress = getModuleProgress(mod.moduleKey);
      const prereqCheck = checkPrerequisitesMet(mod.moduleKey);
      const isComplete = progress === 100;
      const isLocked = prereqCheck.hasHardBlock;
      const isAvailable = !isLocked && progress < 100;

      const label = titleMap[mod.moduleKey] || mod.moduleKey;
      if (isComplete) {
        lines.push(`  ${mod.moduleKey}["${label} ✓"]:::complete`);
      } else if (isLocked) {
        lines.push(`  ${mod.moduleKey}["🔒 ${label}"]:::locked`);
      } else if (progress > 0) {
        lines.push(`  ${mod.moduleKey}["${label} ${progress}%"]:::inprogress`);
      } else {
        lines.push(`  ${mod.moduleKey}["${label}"]:::available`);
      }
    }

    // Add edges
    for (const dep of edges) {
      const arrow = dep.requirementType === "hard" ? "==>" : "-->";
      lines.push(`  ${dep.requiresModuleKey} ${arrow} ${dep.moduleKey}`);
    }

    // Styles
    lines.push("  classDef complete fill:#22c55e,stroke:#16a34a,color:#fff");
    lines.push("  classDef locked fill:#6b7280,stroke:#4b5563,color:#d1d5db");
    lines.push("  classDef inprogress fill:#3b82f6,stroke:#2563eb,color:#fff");
    lines.push("  classDef available fill:#8b5cf6,stroke:#7c3aed,color:#fff");

    return lines.join("\n");
  }, [dependencies, modules, getModuleProgress, checkPrerequisitesMet, toDependencyEdges]);

  if (!mermaidCode || dependencies.length === 0) {
    return null;
  }

  return (
    <div className={`border border-border rounded-xl bg-card ${compact ? "p-3" : "p-6"}`}>
      {!compact && (
        <h3 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
          <Play className="w-4 h-4 text-primary" />
          Module Dependency Map
        </h3>
      )}
      <div className="overflow-x-auto">
        <MermaidDiagram code={mermaidCode} />
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Completed</span>
        <span className="flex items-center gap-1"><Circle className="w-3 h-3 text-blue-500" /> In Progress</span>
        <span className="flex items-center gap-1"><Circle className="w-3 h-3 text-violet-500" /> Available</span>
        <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-muted-foreground" /> Locked</span>
        <span className="text-muted-foreground">━━ Hard │ ── Soft</span>
      </div>
    </div>
  );
}
