import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export type MilestonePhase = "day_1" | "week_1" | "week_2" | "month_1" | "month_2" | "month_3";
export type MilestoneTargetType = "module_completion" | "quiz_score" | "path_completion" | "meeting" | "custom";
export type MilestoneStatus = "pending" | "in_progress" | "completed" | "overdue";

export interface Milestone {
  id: string;
  pack_id: string;
  title: string;
  description: string | null;
  phase: MilestonePhase;
  target_type: MilestoneTargetType;
  target_value: Record<string, any>;
  is_required: boolean;
  sort_order: number;
  created_at: string;
}

export interface MilestoneProgress {
  id: string;
  user_id: string;
  pack_id: string;
  milestone_id: string;
  status: MilestoneStatus;
  completed_at: string | null;
}

export const PHASE_LABELS: Record<MilestonePhase, string> = {
  day_1: "Day 1",
  week_1: "Week 1",
  week_2: "Week 2",
  month_1: "Month 1",
  month_2: "Month 2",
  month_3: "Month 3",
};

export const PHASE_ORDER: MilestonePhase[] = ["day_1", "week_1", "week_2", "month_1", "month_2", "month_3"];

export function useMilestones() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const milestones = useQuery({
    queryKey: ["milestones", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_milestones")
        .select("*")
        .eq("pack_id", currentPackId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
    enabled: !!currentPackId,
  });

  const progress = useQuery({
    queryKey: ["milestone_progress", user?.id, currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learner_milestone_progress")
        .select("*")
        .eq("user_id", user!.id)
        .eq("pack_id", currentPackId);
      if (error) throw error;
      return (data ?? []) as MilestoneProgress[];
    },
    enabled: !!user && !!currentPackId,
  });

  const addMilestone = useMutation({
    mutationFn: async (m: Partial<Milestone> & { title: string; phase: MilestonePhase }) => {
      const { error } = await supabase.from("onboarding_milestones").insert({
        pack_id: currentPackId,
        ...m,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", currentPackId] }),
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Milestone>) => {
      const { error } = await supabase.from("onboarding_milestones").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", currentPackId] }),
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("onboarding_milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", currentPackId] }),
  });

  const updateProgress = useMutation({
    mutationFn: async ({ milestoneId, status }: { milestoneId: string; status: MilestoneStatus }) => {
      const existing = (progress.data ?? []).find(p => p.milestone_id === milestoneId);
      const completedAt = status === "completed" ? new Date().toISOString() : null;
      if (existing) {
        const { error } = await supabase.from("learner_milestone_progress")
          .update({ status, completed_at: completedAt })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("learner_milestone_progress").insert({
          user_id: user!.id,
          pack_id: currentPackId,
          milestone_id: milestoneId,
          status,
          completed_at: completedAt,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestone_progress"] }),
  });

  const getStatus = (milestoneId: string): MilestoneStatus =>
    (progress.data ?? []).find(p => p.milestone_id === milestoneId)?.status ?? "pending";

  const completedCount = (progress.data ?? []).filter(p => p.status === "completed").length;
  const totalCount = milestones.data?.length ?? 0;

  return {
    milestones: milestones.data ?? [],
    milestonesLoading: milestones.isLoading,
    progress: progress.data ?? [],
    addMilestone,
    updateMilestone,
    deleteMilestone,
    updateProgress,
    getStatus,
    completedCount,
    totalCount,
  };
}
