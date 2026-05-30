import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { getNextReviewDate } from "@/lib/spaced-repetition";

export interface ReviewScheduleRow {
  id: string; user_id: string; pack_id: string; module_key: string;
  next_review_date: string; review_count: number; last_reviewed_at: string | null;
}

export function useReviewSchedule() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const schedule = useQuery({
    queryKey: ["review_schedule", user?.id, currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase.from("review_schedule").select("*")
        .eq("user_id", user!.id).eq("pack_id", currentPackId);
      if (error) throw error;
      return (data ?? []) as ReviewScheduleRow[];
    },
    enabled: !!user && !!currentPackId,
  });

  const dueReviews = (schedule.data ?? []).filter(s => new Date(s.next_review_date) <= new Date());

  const completeReview = useMutation({
    mutationFn: async ({ moduleKey, selfRating }: { moduleKey: string; selfRating: number }) => {
      const existing = (schedule.data ?? []).find(s => s.module_key === moduleKey);
      const newCount = (existing?.review_count ?? 0) + 1;
      const nextDate = getNextReviewDate(newCount, selfRating);
      if (existing) {
        const { error } = await supabase.from("review_schedule").update({
          review_count: newCount, next_review_date: nextDate.toISOString().split("T")[0],
          last_reviewed_at: new Date().toISOString(),
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("review_schedule").insert({
          user_id: user!.id, pack_id: currentPackId, module_key: moduleKey,
          review_count: newCount, next_review_date: nextDate.toISOString().split("T")[0],
          last_reviewed_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["review_schedule"] }),
  });

  const scheduleReview = useMutation({
    mutationFn: async (moduleKey: string) => {
      const nextDate = getNextReviewDate(0, 3);
      const { error } = await supabase.from("review_schedule").upsert({
        user_id: user!.id, pack_id: currentPackId, module_key: moduleKey,
        next_review_date: nextDate.toISOString().split("T")[0], review_count: 0,
      }, { onConflict: "user_id,pack_id,module_key" } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["review_schedule"] }),
  });

  return { schedule: schedule.data ?? [], dueReviews, completeReview, scheduleReview, isLoading: schedule.isLoading };
}
