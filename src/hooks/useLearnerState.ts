import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export function useLearnerState() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const { data: learnerState } = useQuery({
    queryKey: ["learner_state", user?.id, currentPackId],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("learner_state")
        .select("*")
        .eq("user_id", user.id)
        .or(`pack_id.eq.${currentPackId},pack_id.is.null`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updateLastOpened = useMutation({
    mutationFn: async ({ moduleId, trackKey }: { moduleId?: string; trackKey?: string }) => {
      if (!user) return;
      const { error } = await supabase.from("learner_state").upsert(
        {
          user_id: user.id,
          last_opened_module_id: moduleId ?? learnerState?.last_opened_module_id ?? null,
          last_opened_track_key: trackKey ?? null,
          pack_id: currentPackId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learner_state", user?.id, currentPackId] });
    },
  });

  return {
    lastOpenedModuleId: learnerState?.last_opened_module_id ?? null,
    lastOpenedTrackKey: learnerState?.last_opened_track_key ?? null,
    updateLastOpened,
  };
}
