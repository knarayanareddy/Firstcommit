import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { toast } from "sonner";

export interface Cohort {
  id: string;
  pack_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  created_by: string;
  created_at: string;
}

export interface CohortMember {
  id: string;
  cohort_id: string;
  user_id: string;
  joined_at: string;
  display_name?: string;
  avatar_url?: string;
}

export interface CohortMemberProgress extends CohortMember {
  progress_pct: number;
  streak_days: number;
  show_progress: boolean;
}

export function useCohort() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const cohortsQuery = useQuery({
    queryKey: ["cohorts", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cohorts")
        .select("*")
        .eq("pack_id", currentPackId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Cohort[];
    },
    enabled: !!currentPackId,
  });

  // Find the user's cohort
  const myCohortQuery = useQuery({
    queryKey: ["my_cohort", user?.id, currentPackId],
    queryFn: async () => {
      const { data: memberships, error: memErr } = await supabase
        .from("cohort_members")
        .select("cohort_id")
        .eq("user_id", user!.id);
      if (memErr) throw memErr;
      if (!memberships || memberships.length === 0) return null;

      const cohortIds = memberships.map((m: any) => m.cohort_id);
      const { data: cohorts, error: cohErr } = await supabase
        .from("cohorts")
        .select("*")
        .in("id", cohortIds)
        .eq("pack_id", currentPackId!)
        .limit(1);
      if (cohErr) throw cohErr;
      return (cohorts?.[0] as unknown as Cohort) ?? null;
    },
    enabled: !!user && !!currentPackId,
  });

  // Fetch cohort members with profiles and progress
  const cohortMembersQuery = useQuery({
    queryKey: ["cohort_members", myCohortQuery.data?.id],
    queryFn: async () => {
      const cohortId = myCohortQuery.data!.id;
      const { data: members, error } = await supabase
        .from("cohort_members")
        .select("*")
        .eq("cohort_id", cohortId);
      if (error) throw error;
      if (!members || members.length === 0) return [];

      const userIds = members.map((m: any) => m.user_id);

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      // Fetch visibility preferences
      const { data: visPrefs } = await supabase
        .from("peer_visibility_preferences")
        .select("user_id, show_my_progress")
        .in("user_id", userIds)
        .eq("pack_id", currentPackId!);

      // Fetch progress (sections read per user)
      const { data: progress } = await supabase
        .from("user_progress" as any)
        .select("user_id, is_read")
        .in("user_id", userIds)
        .eq("pack_id", currentPackId!);

      // Fetch streaks
      const { data: streaks } = await supabase
        .from("learner_streaks")
        .select("user_id, current_streak")
        .in("user_id", userIds)
        .eq("pack_id", currentPackId!);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const visMap = new Map((visPrefs ?? []).map((v: any) => [v.user_id, v]));
      const streakMap = new Map((streaks ?? []).map((s: any) => [s.user_id, s.current_streak]));

      // Calculate progress per user
      const progressByUser = new Map<string, { read: number; total: number }>();
      for (const p of (progress ?? []) as any[]) {
        const curr = progressByUser.get(p.user_id) ?? { read: 0, total: 0 };
        curr.total++;
        if (p.is_read) curr.read++;
        progressByUser.set(p.user_id, curr);
      }

      return members.map((m: any): CohortMemberProgress => {
        const profile = profileMap.get(m.user_id);
        const vis = visMap.get(m.user_id);
        const prog = progressByUser.get(m.user_id);
        const pct = prog && prog.total > 0 ? Math.round((prog.read / prog.total) * 100) : 0;
        return {
          ...m,
          display_name: (profile as any)?.display_name ?? "Learner",
          avatar_url: (profile as any)?.avatar_url ?? null,
          progress_pct: pct,
          streak_days: streakMap.get(m.user_id) ?? 0,
          show_progress: (vis as any)?.show_my_progress ?? true,
        };
      });
    },
    enabled: !!myCohortQuery.data?.id && !!currentPackId,
  });

  const createCohort = useMutation({
    mutationFn: async ({ name, description, startDate, memberIds }: {
      name: string; description?: string; startDate?: string; memberIds: string[];
    }) => {
      const { data: cohort, error: cErr } = await supabase
        .from("cohorts")
        .insert({
          pack_id: currentPackId!,
          name,
          description: description ?? null,
          start_date: startDate ?? null,
          created_by: user!.id,
        } as any)
        .select()
        .single();
      if (cErr) throw cErr;

      if (memberIds.length > 0) {
        const rows = memberIds.map((uid) => ({
          cohort_id: (cohort as any).id,
          user_id: uid,
        }));
        const { error: mErr } = await supabase
          .from("cohort_members")
          .insert(rows as any);
        if (mErr) throw mErr;
      }
      return cohort as unknown as Cohort;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cohorts"] });
      qc.invalidateQueries({ queryKey: ["my_cohort"] });
      toast.success("Cohort created");
    },
  });

  const deleteCohort = useMutation({
    mutationFn: async (cohortId: string) => {
      const { error } = await supabase.from("cohorts").delete().eq("id", cohortId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cohorts"] });
      qc.invalidateQueries({ queryKey: ["my_cohort"] });
      toast.success("Cohort deleted");
    },
  });

  const addMembers = useMutation({
    mutationFn: async ({ cohortId, userIds }: { cohortId: string; userIds: string[] }) => {
      const rows = userIds.map((uid) => ({ cohort_id: cohortId, user_id: uid }));
      const { error } = await supabase.from("cohort_members").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cohort_members"] });
      toast.success("Members added");
    },
  });

  return {
    cohorts: cohortsQuery.data ?? [],
    cohortsLoading: cohortsQuery.isLoading,
    myCohort: myCohortQuery.data ?? null,
    myCohortLoading: myCohortQuery.isLoading,
    cohortMembers: cohortMembersQuery.data ?? [],
    cohortMembersLoading: cohortMembersQuery.isLoading,
    createCohort,
    deleteCohort,
    addMembers,
  };
}
