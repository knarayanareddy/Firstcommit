import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

/**
 * Check if the current user has audience_preferences for the current pack.
 * Used to detect whether the learner onboarding wizard should be shown.
 */
export function useLearnerOnboardingCheck() {
  const { user } = useAuth();
  const { currentPackId } = usePack();

  const { data: hasPrefs, isLoading } = useQuery({
    queryKey: ["learner_onboarding_check", user?.id, currentPackId],
    queryFn: async () => {
      if (!user || !currentPackId) return true; // default to true (no wizard)
      const { data, error } = await supabase
        .from("audience_preferences")
        .select("id")
        .eq("user_id", user.id)
        .or(`pack_id.eq.${currentPackId},pack_id.is.null`)
        .limit(1)
        .maybeSingle();
      if (error) return true; // on error, don't block
      return !!data;
    },
    enabled: !!user && !!currentPackId,
  });

  return {
    hasCompletedOnboarding: hasPrefs ?? true,
    isChecking: isLoading,
  };
}
