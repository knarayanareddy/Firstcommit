import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export type FeedbackType = "thumbs_up" | "thumbs_down" | "confusing" | "outdated" | "incorrect" | "missing_context";

export interface ContentFeedbackRow {
  id: string;
  user_id: string;
  pack_id: string;
  module_key: string;
  section_id: string | null;
  feedback_type: FeedbackType;
  comment: string | null;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ContentRatingRow {
  id: string;
  user_id: string;
  pack_id: string;
  module_key: string;
  section_id: string | null;
  rating: number;
  created_at: string;
}

export function useContentFeedback(moduleKey?: string) {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const myFeedback = useQuery({
    queryKey: ["content_feedback", "mine", user?.id, currentPackId, moduleKey],
    queryFn: async () => {
      let q = supabase
        .from("content_feedback")
        .select("*")
        .eq("user_id", user!.id)
        .eq("pack_id", currentPackId);
      if (moduleKey) q = q.eq("module_key", moduleKey);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContentFeedbackRow[];
    },
    enabled: !!user && !!currentPackId,
  });

  const packFeedback = useQuery({
    queryKey: ["content_feedback", "pack", currentPackId, moduleKey],
    queryFn: async () => {
      let q = supabase
        .from("content_feedback")
        .select("*")
        .eq("pack_id", currentPackId);
      if (moduleKey) q = q.eq("module_key", moduleKey);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContentFeedbackRow[];
    },
    enabled: !!currentPackId,
  });

  const packRatings = useQuery({
    queryKey: ["content_ratings", "pack", currentPackId, moduleKey],
    queryFn: async () => {
      let q = supabase
        .from("content_ratings")
        .select("*")
        .eq("pack_id", currentPackId);
      if (moduleKey) q = q.eq("module_key", moduleKey);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ContentRatingRow[];
    },
    enabled: !!currentPackId,
  });

  const submitFeedback = useMutation({
    mutationFn: async ({ moduleKey: mk, sectionId, feedbackType, comment }: {
      moduleKey: string; sectionId?: string; feedbackType: FeedbackType; comment?: string;
    }) => {
      const { error } = await supabase.from("content_feedback").upsert({
        user_id: user!.id,
        pack_id: currentPackId,
        module_key: mk,
        section_id: sectionId ?? null,
        feedback_type: feedbackType,
        comment: comment ?? null,
      }, { onConflict: "user_id,pack_id,module_key,section_id,feedback_type" } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content_feedback"] });
    },
  });

  const removeFeedback = useMutation({
    mutationFn: async ({ moduleKey: mk, sectionId, feedbackType }: {
      moduleKey: string; sectionId?: string; feedbackType: FeedbackType;
    }) => {
      let q = supabase
        .from("content_feedback")
        .delete()
        .eq("user_id", user!.id)
        .eq("pack_id", currentPackId)
        .eq("module_key", mk)
        .eq("feedback_type", feedbackType);
      if (sectionId) q = q.eq("section_id", sectionId);
      else q = q.is("section_id", null);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content_feedback"] });
    },
  });

  const submitRating = useMutation({
    mutationFn: async ({ moduleKey: mk, sectionId, rating }: {
      moduleKey: string; sectionId?: string; rating: number;
    }) => {
      const { error } = await supabase.from("content_ratings").upsert({
        user_id: user!.id,
        pack_id: currentPackId,
        module_key: mk,
        section_id: sectionId ?? null,
        rating,
      }, { onConflict: "user_id,pack_id,module_key,section_id" } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content_ratings"] });
    },
  });

  const resolveFeedback = useMutation({
    mutationFn: async (feedbackId: string) => {
      const { error } = await supabase
        .from("content_feedback")
        .update({ is_resolved: true, resolved_by: user!.id, resolved_at: new Date().toISOString() })
        .eq("id", feedbackId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content_feedback"] });
    },
  });

  const getMyFeedbackForSection = (mk: string, sectionId?: string): ContentFeedbackRow[] => {
    return (myFeedback.data ?? []).filter(
      f => f.module_key === mk && f.section_id === (sectionId ?? null)
    );
  };

  const getMyRatingForModule = (mk: string): number | null => {
    const r = (packRatings.data ?? []).find(
      r => r.module_key === mk && r.section_id === null && r.user_id === user?.id
    );
    return r?.rating ?? null;
  };

  const getAverageRating = (mk: string): { avg: number; count: number } | null => {
    const ratings = (packRatings.data ?? []).filter(r => r.module_key === mk && r.section_id === null);
    if (ratings.length === 0) return null;
    const avg = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
    return { avg: Math.round(avg * 10) / 10, count: ratings.length };
  };

  return {
    myFeedback: myFeedback.data ?? [],
    packFeedback: packFeedback.data ?? [],
    packRatings: packRatings.data ?? [],
    submitFeedback,
    removeFeedback,
    submitRating,
    resolveFeedback,
    getMyFeedbackForSection,
    getMyRatingForModule,
    getAverageRating,
    isLoading: myFeedback.isLoading,
  };
}
