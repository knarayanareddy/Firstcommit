import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";

export type TargetReadingLevel = "plain" | "standard" | "technical";

export interface GenerationPrefs {
  targetReadingLevel: TargetReadingLevel;
  maxSectionsHint: number;
  mermaidEnabled: boolean;
}

export interface PackLimits {
  maxModuleWords: number;
  maxQuizQuestions: number;
  maxKeyTakeaways: number;
}

export function useGenerationPrefs() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const { hasPackPermission } = useRole();
  const queryClient = useQueryClient();

  const { data: userPrefs, isLoading: userPrefsLoading } = useQuery({
    queryKey: ["generation_prefs", user?.id, currentPackId],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("audience_preferences")
        .select("target_reading_level, max_sections_hint, mermaid_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: packLimits, isLoading: packLimitsLoading } = useQuery({
    queryKey: ["pack_generation_limits", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_generation_limits")
        .select("*")
        .eq("pack_id", currentPackId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentPackId,
  });

  const updatePrefs = useMutation({
    mutationFn: async (opts: {
      target_reading_level?: TargetReadingLevel;
      max_sections_hint?: number;
      mermaid_enabled?: boolean;
    }) => {
      if (!user) return;
      const payload: Record<string, unknown> = {
        user_id: user.id,
        pack_id: currentPackId,
        updated_at: new Date().toISOString(),
      };
      if (opts.target_reading_level !== undefined) payload.target_reading_level = opts.target_reading_level;
      if (opts.max_sections_hint !== undefined) payload.max_sections_hint = opts.max_sections_hint;
      if (opts.mermaid_enabled !== undefined) payload.mermaid_enabled = opts.mermaid_enabled;
      const { error } = await supabase
        .from("audience_preferences")
        .upsert(payload as any, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generation_prefs", user?.id, currentPackId] });
      queryClient.invalidateQueries({ queryKey: ["audience_preferences", user?.id, currentPackId] });
    },
  });

  const updatePackLimits = useMutation({
    mutationFn: async (opts: {
      max_module_words?: number;
      max_quiz_questions?: number;
      max_key_takeaways?: number;
    }) => {
      if (!user || !currentPackId) return;
      const payload: Record<string, unknown> = {
        pack_id: currentPackId,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };
      if (opts.max_module_words !== undefined) payload.max_module_words = opts.max_module_words;
      if (opts.max_quiz_questions !== undefined) payload.max_quiz_questions = opts.max_quiz_questions;
      if (opts.max_key_takeaways !== undefined) payload.max_key_takeaways = opts.max_key_takeaways;
      const { error } = await supabase
        .from("pack_generation_limits")
        .upsert(payload as any, { onConflict: "pack_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pack_generation_limits", currentPackId] });
    },
  });

  return {
    targetReadingLevel: ((userPrefs as any)?.target_reading_level as TargetReadingLevel) ?? "plain",
    maxSectionsHint: ((userPrefs as any)?.max_sections_hint as number) ?? 7,
    mermaidEnabled: ((userPrefs as any)?.mermaid_enabled as boolean) ?? true,
    packLimits: {
      maxModuleWords: ((packLimits as any)?.max_module_words as number) ?? 1400,
      maxQuizQuestions: ((packLimits as any)?.max_quiz_questions as number) ?? 5,
      maxKeyTakeaways: ((packLimits as any)?.max_key_takeaways as number) ?? 7,
    },
    isAuthorPlus: hasPackPermission("author"),
    updatePrefs,
    updatePackLimits,
    loading: userPrefsLoading || packLimitsLoading,
  };
}
