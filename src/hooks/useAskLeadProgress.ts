import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export function useAskLeadProgress() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const progressQuery = useQuery({
    queryKey: ["ask_lead_progress", currentPackId, user?.id],
    queryFn: async () => {
      if (!user || !currentPackId) return new Set<string>();
      const { data, error } = await supabase
        .from("ask_lead_progress")
        .select("question_id, is_asked")
        .eq("user_id", user.id)
        .eq("pack_id", currentPackId)
        .eq("is_asked", true);
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.question_id));
    },
    enabled: !!user && !!currentPackId,
  });

  const toggleQuestion = useMutation({
    mutationFn: async (questionId: string) => {
      if (!user || !currentPackId) throw new Error("Not authenticated");
      const currentlyAsked = progressQuery.data?.has(questionId) || false;
      const newAsked = !currentlyAsked;

      const { error } = await supabase
        .from("ask_lead_progress")
        .upsert(
          {
            user_id: user.id,
            pack_id: currentPackId,
            question_id: questionId,
            is_asked: newAsked,
            asked_at: newAsked ? new Date().toISOString() : null,
          },
          { onConflict: "user_id,pack_id,question_id" }
        );
      if (error) throw error;
    },
    onMutate: async (questionId) => {
      const key = ["ask_lead_progress", currentPackId, user?.id];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Set<string>>(key);
      queryClient.setQueryData(key, () => {
        const next = new Set(prev);
        if (next.has(questionId)) next.delete(questionId);
        else next.add(questionId);
        return next;
      });
      return { prev };
    },
    onError: (_err, _qid, context) => {
      if (context?.prev) {
        queryClient.setQueryData(
          ["ask_lead_progress", currentPackId, user?.id],
          context.prev
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["ask_lead_progress", currentPackId, user?.id],
      });
    },
  });

  return {
    askedQuestions: progressQuery.data || new Set<string>(),
    progressLoading: progressQuery.isLoading,
    toggleQuestion,
  };
}
