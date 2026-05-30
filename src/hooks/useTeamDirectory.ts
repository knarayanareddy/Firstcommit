import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export interface TeamMember {
  id: string;
  pack_id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  slack_handle: string | null;
  github_handle: string | null;
  avatar_url: string | null;
  bio: string | null;
  areas_of_expertise: string[];
  services_owned: string[];
  is_auto_detected: boolean;
  created_at: string;
}

export interface MeetingProgress {
  id: string;
  user_id: string;
  pack_id: string;
  team_member_id: string;
  is_met: boolean;
  met_at: string | null;
  notes: string | null;
}

export function useTeamDirectory() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const teamMembers = useQuery({
    queryKey: ["team_members", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .eq("pack_id", currentPackId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
    enabled: !!currentPackId,
  });

  const meetingProgress = useQuery({
    queryKey: ["meeting_progress", user?.id, currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_progress")
        .select("*")
        .eq("user_id", user!.id)
        .eq("pack_id", currentPackId);
      if (error) throw error;
      return (data ?? []) as MeetingProgress[];
    },
    enabled: !!user && !!currentPackId,
  });

  const addTeamMember = useMutation({
    mutationFn: async (member: Partial<TeamMember> & { name: string }) => {
      const { error } = await supabase.from("team_members").insert({
        pack_id: currentPackId,
        ...member,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team_members", currentPackId] }),
  });

  const updateTeamMember = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TeamMember>) => {
      const { error } = await supabase.from("team_members").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team_members", currentPackId] }),
  });

  const deleteTeamMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team_members", currentPackId] }),
  });

  const toggleMet = useMutation({
    mutationFn: async ({ teamMemberId, notes }: { teamMemberId: string; notes?: string }) => {
      const existing = (meetingProgress.data ?? []).find(p => p.team_member_id === teamMemberId);
      if (existing?.is_met) {
        const { error } = await supabase
          .from("meeting_progress")
          .update({ is_met: false, met_at: null })
          .eq("id", existing.id);
        if (error) throw error;
      } else if (existing) {
        const { error } = await supabase
          .from("meeting_progress")
          .update({ is_met: true, met_at: new Date().toISOString(), notes: notes ?? existing.notes })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meeting_progress").insert({
          user_id: user!.id,
          pack_id: currentPackId,
          team_member_id: teamMemberId,
          is_met: true,
          met_at: new Date().toISOString(),
          notes: notes ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_progress"] }),
  });

  const isMet = (teamMemberId: string) =>
    (meetingProgress.data ?? []).some(p => p.team_member_id === teamMemberId && p.is_met);

  const metCount = (meetingProgress.data ?? []).filter(p => p.is_met).length;
  const totalMembers = teamMembers.data?.length ?? 0;

  return {
    members: teamMembers.data ?? [],
    membersLoading: teamMembers.isLoading,
    meetingProgress: meetingProgress.data ?? [],
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    toggleMet,
    isMet,
    metCount,
    totalMembers,
  };
}
