import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export function useStreak() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const { data: streak } = useQuery({
    queryKey: ["learner_streak", user?.id, currentPackId],
    queryFn: async () => {
      if (!user || !currentPackId) return null;
      const { data, error } = await supabase
        .from("learner_streaks")
        .select("*")
        .eq("user_id", user.id)
        .eq("pack_id", currentPackId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!currentPackId,
  });

  const recordActivity = useMutation({
    mutationFn: async () => {
      if (!user || !currentPackId) return;
      const today = new Date().toISOString().split("T")[0];

      if (streak?.last_activity_date === today) return; // Already recorded today

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const isConsecutive = streak?.last_activity_date === yesterdayStr;
      const newStreak = isConsecutive ? (streak?.current_streak || 0) + 1 : 1;
      const newLongest = Math.max(newStreak, streak?.longest_streak || 0);

      if (streak) {
        await supabase
          .from("learner_streaks")
          .update({
            current_streak: newStreak,
            longest_streak: newLongest,
            last_activity_date: today,
          })
          .eq("id", streak.id);
      } else {
        await supabase.from("learner_streaks").insert({
          user_id: user.id,
          pack_id: currentPackId,
          current_streak: 1,
          longest_streak: 1,
          last_activity_date: today,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learner_streak", user?.id, currentPackId] });
    },
  });

  return {
    currentStreak: streak?.current_streak || 0,
    longestStreak: streak?.longest_streak || 0,
    lastActivity: streak?.last_activity_date || null,
    recordActivity,
  };
}
