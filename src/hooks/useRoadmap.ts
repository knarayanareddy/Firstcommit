import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export type RoadmapPhase = 'day_1_30' | 'day_31_60' | 'day_61_90';
export type RoadmapItemStatus = 'blocked' | 'available' | 'in_progress' | 'done' | 'skipped';
export type RoadmapItemType = 'module' | 'section' | 'quiz' | 'milestone' | 'task' | 'link' | 'doc';

export interface RoadmapItem {
  id: string;
  playlist_id: string;
  title: string;
  description: string | null;
  item_type: RoadmapItemType;
  module_id: string | null;
  section_id: string | null;
  milestone_id: string | null;
  url: string | null;
  due_offset_days: number | null;
  unlock_offset_days: number | null;
  sort_order: number;
  computed_due_date?: string;
  computed_unlock_date?: string;
  current_status?: RoadmapItemStatus;
  is_blocked_by_dependency?: boolean;
  prerequisite_title?: string;
}

export interface RoadmapPlaylist {
  id: string;
  pack_id: string;
  title: string;
  description: string | null;
  phase: RoadmapPhase;
  required: boolean;
  owner_user_id: string | null;
  owner_display_name: string | null;
  items: RoadmapItem[];
}

export interface RoadmapAssignment {
  id: string;
  playlist_id: string;
  learner_user_id: string;
  start_date: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
}

export function useRoadmap() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  // Fetch all assignments for the current user in this pack
  const assignments = useQuery({
    queryKey: ["roadmap_assignments", user?.id, currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlist_assignments")
        .select(`
          *,
          playlist:playlists(
            *,
            items:playlist_items(*)
          )
        `)
        .eq("learner_user_id", user?.id)
        .eq("pack_id", currentPackId);

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!currentPackId,
  });

  // Fetch actual raw progress to compute state client-side (or refresh) 
  const progress = useQuery({
    queryKey: ["roadmap_progress", user?.id, currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlist_item_progress")
        .select("*")
        .eq("learner_user_id", user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch external progress signals (user_progress for sections)
  const externalProgress = useQuery({
    queryKey: ["external_progress", user?.id, currentPackId],
    queryFn: async () => {
      const [userProgress, quizScores] = await Promise.all([
        supabase.from("user_progress").select("*").eq("user_id", user?.id).eq("pack_id", currentPackId),
        supabase.from("quiz_scores").select("*").eq("user_id", user?.id).eq("pack_id", currentPackId)
      ]);
      return {
        userProgress: userProgress.data || [],
        quizScores: quizScores.data || []
      };
    },
    enabled: !!user && !!currentPackId,
  });

  const updateItemStatus = useMutation({
    mutationFn: async ({ assignmentId, itemId, status, note }: { 
      assignmentId: string, 
      itemId: string, 
      status: RoadmapItemStatus,
      note?: string
    }) => {
      // 1. Idempotency check: Don't update if already in that status
      const existing = progress.data?.find(p => p.item_id === itemId && p.assignment_id === assignmentId);
      if (existing?.status === status) return existing;

      // 2. Perform upsert
      const { data, error } = await supabase
        .from("playlist_item_progress")
        .upsert({
          assignment_id: assignmentId,
          item_id: itemId,
          learner_user_id: user!.id,
          status,
          note,
          last_event_at: new Date().toISOString(),
          completed_at: status === 'done' ? new Date().toISOString() : null
        }, { 
          onConflict: 'assignment_id,item_id' 
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roadmap_progress"] });
      qc.invalidateQueries({ queryKey: ["roadmap_assignments"] });
    }
  });

  return {
    assignments: assignments.data || [],
    isLoading: assignments.isLoading || progress.isLoading || externalProgress.isLoading,
    updateItemStatus,
    externalProgress: externalProgress.data,
    progress: progress.data || []
  };
}
