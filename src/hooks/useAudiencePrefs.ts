import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import type { Audience, Depth } from "@/data/onboarding-data";
import { toast } from "sonner";

export type GlossaryDensity = "low" | "standard" | "high";
export type ExperienceLevel = "new" | "mid" | "senior";
export type LearningStyle = "visual" | "text" | "interactive" | "balanced";
export type TonePreference = "direct" | "conversational" | "socratic" | "standard";
export type OutputLanguage = string;

export interface LearnerProfile {
  learner_role: string | null;
  experience_level: ExperienceLevel | null;
  learning_style: LearningStyle;
  framework_familiarity: string | null;
  tone_preference: TonePreference;
}

export function useAudiencePrefs() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ["audience_preferences", user?.id, currentPackId],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("audience_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updatePrefs = useMutation({
    mutationFn: async (opts: {
      audience: Audience;
      depth: Depth;
      glossary_density?: GlossaryDensity;
      learner_role?: string | null;
      experience_level?: ExperienceLevel | null;
      output_language?: string;
      mermaid_enabled?: boolean;
      learning_style?: LearningStyle;
      framework_familiarity?: string | null;
      tone_preference?: TonePreference;
    }) => {
      if (!user) return;
      const payload: any = {
        user_id: user.id,
        audience: opts.audience,
        depth: opts.depth,
        pack_id: currentPackId,
        updated_at: new Date().toISOString(),
      };
      if (opts.glossary_density) payload.glossary_density = opts.glossary_density;
      if (opts.learner_role !== undefined) payload.learner_role = opts.learner_role;
      if (opts.experience_level !== undefined) payload.experience_level = opts.experience_level;
      if (opts.output_language !== undefined) payload.output_language = opts.output_language;
      if (opts.mermaid_enabled !== undefined) payload.mermaid_enabled = opts.mermaid_enabled;
      if (opts.learning_style !== undefined) payload.learning_style = opts.learning_style;
      if (opts.framework_familiarity !== undefined) payload.framework_familiarity = opts.framework_familiarity;
      if (opts.tone_preference !== undefined) payload.tone_preference = opts.tone_preference;
      
      const { error } = await supabase.from("audience_preferences").upsert(
        payload,
        { onConflict: "user_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audience_preferences", user?.id, currentPackId] });
      toast.success("Preferences updated");
    },
    onError: (error) => {
      console.error("Failed to update preferences:", error);
      toast.error(`Failed to update preferences: ${error.message}`);
    },
  });

  return {
    audience: (prefs?.audience as Audience) ?? "technical",
    depth: (prefs?.depth as Depth) ?? "standard",
    glossaryDensity: ((prefs as any)?.glossary_density as GlossaryDensity) ?? "standard",
    learnerRole: ((prefs as any)?.learner_role as string | null) ?? null,
    experienceLevel: ((prefs as any)?.experience_level as ExperienceLevel | null) ?? null,
    outputLanguage: ((prefs as any)?.output_language as string) ?? "en",
    mermaidEnabled: ((prefs as any)?.mermaid_enabled as boolean) ?? true,
    learningStyle: ((prefs as any)?.learning_style as LearningStyle) ?? "balanced",
    frameworkFamiliarity: ((prefs as any)?.framework_familiarity as string | null) ?? null,
    tonePreference: ((prefs as any)?.tone_preference as TonePreference) ?? "standard",
    updatePrefs,
  };
}
