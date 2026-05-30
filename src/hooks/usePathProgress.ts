import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export function usePathProgress(pathType: "day1" | "week1") {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const progressQuery = useQuery({
    queryKey: ["path_progress", currentPackId, pathType, user?.id],
    queryFn: async () => {
      if (!user || !currentPackId) return new Set<string>();
      const { data, error } = await supabase
        .from("path_progress")
        .select("step_id, is_checked")
        .eq("user_id", user.id)
        .eq("pack_id", currentPackId)
        .eq("path_type", pathType)
        .eq("is_checked", true);
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.step_id));
    },
    enabled: !!user && !!currentPackId,
  });

  const toggleStep = useMutation({
    mutationFn: async (stepId: string) => {
      if (!user || !currentPackId) throw new Error("Not authenticated");
      const currentlyChecked = progressQuery.data?.has(stepId) || false;
      const newChecked = !currentlyChecked;

      const { error } = await supabase
        .from("path_progress")
        .upsert(
          {
            user_id: user.id,
            pack_id: currentPackId,
            path_type: pathType,
            step_id: stepId,
            is_checked: newChecked,
            checked_at: newChecked ? new Date().toISOString() : null,
          },
          { onConflict: "user_id,pack_id,path_type,step_id" }
        );
      if (error) throw error;
      return { stepId, checked: newChecked };
    },
    onMutate: async (stepId) => {
      // Optimistic update
      const key = ["path_progress", currentPackId, pathType, user?.id];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Set<string>>(key);
      queryClient.setQueryData(key, () => {
        const next = new Set(prev);
        if (next.has(stepId)) next.delete(stepId);
        else next.add(stepId);
        return next;
      });
      return { prev };
    },
    onError: (_err, _stepId, context) => {
      if (context?.prev) {
        queryClient.setQueryData(
          ["path_progress", currentPackId, pathType, user?.id],
          context.prev
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["path_progress", currentPackId, pathType, user?.id],
      });
    },
  });

  return {
    checkedSteps: progressQuery.data || new Set<string>(),
    progressLoading: progressQuery.isLoading,
    toggleStep,
  };
}
