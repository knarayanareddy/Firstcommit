import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { modules } from "@/data/onboarding-data";

export function useProgress() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const { data: progressData = [] } = useQuery({
    queryKey: ["user_progress", user?.id, currentPackId],
    queryFn: async () => {
      if (!user) return [];
      const query = supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", user.id);
      
      const { data, error } = await query.or(`pack_id.eq.${currentPackId},pack_id.is.null`);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: quizScores = [] } = useQuery({
    queryKey: ["quiz_scores", user?.id, currentPackId],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("quiz_scores")
        .select("*")
        .eq("user_id", user.id)
        .or(`pack_id.eq.${currentPackId},pack_id.is.null`);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const toggleSection = useMutation({
    mutationFn: async ({ moduleId, sectionId }: { moduleId: string; sectionId: string }) => {
      if (!user) return;
      const existing = progressData.find(
        (p) => p.module_id === moduleId && p.section_id === sectionId
      );
      if (existing) {
        const { error } = await supabase
          .from("user_progress")
          .delete()
          .eq("user_id", user.id)
          .eq("module_id", moduleId)
          .eq("section_id", sectionId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_progress").insert({
          user_id: user.id,
          module_id: moduleId,
          section_id: sectionId,
          pack_id: currentPackId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_progress", user?.id, currentPackId] });
    },
  });

  const saveQuizScore = useMutation({
    mutationFn: async ({ moduleId, score, total }: { moduleId: string; score: number; total: number }) => {
      if (!user) return;
      const { error } = await supabase.from("quiz_scores").upsert(
        { user_id: user.id, module_id: moduleId, score, total, pack_id: currentPackId },
        { onConflict: "user_id,module_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz_scores", user?.id, currentPackId] });
    },
  });

  // Works with both static module IDs and generated module_keys
  const getModuleProgress = (moduleId: string, totalSectionsOverride?: number): number => {
    const readCount = progressData.filter((p) => p.module_id === moduleId).length;
    // Try static module first
    const staticMod = modules.find((m) => m.id === moduleId);
    const totalSections = totalSectionsOverride || staticMod?.sections.length;
    if (!totalSections || totalSections === 0) return readCount > 0 ? 50 : 0;
    return Math.round((readCount / totalSections) * 100);
  };

  const isSectionRead = (moduleId: string, sectionId: string): boolean => {
    return progressData.some((p) => p.module_id === moduleId && p.section_id === sectionId);
  };

  const getReadSectionsForModule = (moduleId: string): Set<string> => {
    return new Set(
      progressData.filter((p) => p.module_id === moduleId).map((p) => p.section_id)
    );
  };

  const totalSectionsRead = progressData.length;
  const totalSections = modules.reduce((a, m) => a + m.sections.length, 0);
  const completedModules = modules.filter((m) => getModuleProgress(m.id) === 100).length;

  return {
    progressData,
    quizScores,
    toggleSection,
    saveQuizScore,
    getModuleProgress,
    isSectionRead,
    getReadSectionsForModule,
    totalSectionsRead,
    totalSections,
    completedModules,
  };
}
