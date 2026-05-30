import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useProgress } from "@/hooks/useProgress";
import type { DependencyEdge } from "@/lib/dependency-graph";

export interface ModuleDependencyRow {
  id: string;
  pack_id: string;
  module_key: string;
  requires_module_key: string;
  requirement_type: string;
  min_completion_percentage: number;
  min_quiz_score: number;
  created_at: string;
}

export interface UnmetPrereq {
  moduleKey: string;
  title?: string;
  currentProgress: number;
  requiredProgress: number;
  currentQuizScore: number | null;
  requiredQuizScore: number;
  met: boolean;
}

export interface PrerequisiteCheck {
  allMet: boolean;
  hasHardBlock: boolean;
  hasSoftWarning: boolean;
  unmet: UnmetPrereq[];
  hardUnmet: UnmetPrereq[];
  softUnmet: UnmetPrereq[];
}

export function useModuleDependencies() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const { getModuleProgress, quizScores } = useProgress();
  const queryClient = useQueryClient();

  const { data: dependencies = [], isLoading } = useQuery({
    queryKey: ["module_dependencies", currentPackId],
    queryFn: async () => {
      if (!currentPackId) return [];
      const { data, error } = await supabase
        .from("module_dependencies" as any)
        .select("*")
        .eq("pack_id", currentPackId);
      if (error) throw error;
      return (data || []) as unknown as ModuleDependencyRow[];
    },
    enabled: !!currentPackId,
  });

  const getPrerequisitesForModule = (moduleKey: string): ModuleDependencyRow[] => {
    return dependencies.filter((d) => d.module_key === moduleKey);
  };

  const getDependentsOfModule = (moduleKey: string): ModuleDependencyRow[] => {
    return dependencies.filter((d) => d.requires_module_key === moduleKey);
  };

  const checkPrerequisitesMet = (moduleKey: string, moduleTitleMap?: Record<string, string>): PrerequisiteCheck => {
    const prereqs = getPrerequisitesForModule(moduleKey);
    if (prereqs.length === 0) {
      return { allMet: true, hasHardBlock: false, hasSoftWarning: false, unmet: [], hardUnmet: [], softUnmet: [] };
    }

    const unmet: UnmetPrereq[] = [];

    for (const prereq of prereqs) {
      const progress = getModuleProgress(prereq.requires_module_key);
      const quizScore = quizScores.find((q) => q.module_id === prereq.requires_module_key);
      const quizPct = quizScore && quizScore.total > 0 ? Math.round((quizScore.score / quizScore.total) * 100) : null;

      const progressMet = progress >= prereq.min_completion_percentage;
      const quizMet = prereq.min_quiz_score === 0 || (quizPct !== null && quizPct >= prereq.min_quiz_score);
      const met = progressMet && quizMet;

      unmet.push({
        moduleKey: prereq.requires_module_key,
        title: moduleTitleMap?.[prereq.requires_module_key],
        currentProgress: progress,
        requiredProgress: prereq.min_completion_percentage,
        currentQuizScore: quizPct,
        requiredQuizScore: prereq.min_quiz_score,
        met,
      });
    }

    const hardPrereqs = prereqs.filter((p) => p.requirement_type === "hard");
    const softPrereqs = prereqs.filter((p) => p.requirement_type === "soft");

    const hardUnmet = unmet.filter((u) => !u.met && hardPrereqs.some((h) => h.requires_module_key === u.moduleKey));
    const softUnmet = unmet.filter((u) => !u.met && softPrereqs.some((s) => s.requires_module_key === u.moduleKey));

    return {
      allMet: unmet.every((u) => u.met),
      hasHardBlock: hardUnmet.length > 0,
      hasSoftWarning: softUnmet.length > 0,
      unmet: unmet.filter((u) => !u.met),
      hardUnmet,
      softUnmet,
    };
  };

  const saveDependencies = useMutation({
    mutationFn: async (deps: Omit<DependencyEdge, "id">[]) => {
      if (!currentPackId) throw new Error("No pack");
      // Delete existing
      await supabase.from("module_dependencies" as any).delete().eq("pack_id", currentPackId);
      if (deps.length === 0) return;
      const rows = deps.map((d) => ({
        pack_id: currentPackId,
        module_key: d.moduleKey,
        requires_module_key: d.requiresModuleKey,
        requirement_type: d.requirementType,
        min_completion_percentage: d.minCompletionPercentage,
        min_quiz_score: d.minQuizScore,
      }));
      const { error } = await supabase.from("module_dependencies" as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["module_dependencies", currentPackId] }),
  });

  const addDependency = useMutation({
    mutationFn: async (dep: { moduleKey: string; requiresModuleKey: string; requirementType?: string; minCompletion?: number; minQuizScore?: number }) => {
      if (!currentPackId) throw new Error("No pack");
      const { error } = await supabase.from("module_dependencies" as any).insert({
        pack_id: currentPackId,
        module_key: dep.moduleKey,
        requires_module_key: dep.requiresModuleKey,
        requirement_type: dep.requirementType || "soft",
        min_completion_percentage: dep.minCompletion ?? 100,
        min_quiz_score: dep.minQuizScore ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["module_dependencies", currentPackId] }),
  });

  const removeDependency = useMutation({
    mutationFn: async (depId: string) => {
      const { error } = await supabase.from("module_dependencies" as any).delete().eq("id", depId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["module_dependencies", currentPackId] }),
  });

  const toDependencyEdges = (): DependencyEdge[] => {
    return dependencies.map((d) => ({
      moduleKey: d.module_key,
      requiresModuleKey: d.requires_module_key,
      requirementType: d.requirement_type as "hard" | "soft",
      minCompletionPercentage: d.min_completion_percentage,
      minQuizScore: d.min_quiz_score,
    }));
  };

  return {
    dependencies,
    dependenciesLoading: isLoading,
    getPrerequisitesForModule,
    getDependentsOfModule,
    checkPrerequisitesMet,
    saveDependencies,
    addDependency,
    removeDependency,
    toDependencyEdges,
  };
}
