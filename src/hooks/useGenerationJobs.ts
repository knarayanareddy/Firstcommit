import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePack } from "@/hooks/usePack";
import { useEffect } from "react";

export interface GenerationJob {
  id: string;
  pack_id: string;
  job_type: "module" | "quiz" | "glossary" | "paths" | "ask_lead";
  module_key: string | null;
  status: "queued" | "generating" | "completed" | "failed";
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export function useGenerationJobs() {
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: ["generation_jobs", currentPackId],
    queryFn: async () => {
      if (!currentPackId) return [];
      const { data, error } = await supabase
        .from("generation_jobs")
        .select("*")
        .eq("pack_id", currentPackId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as GenerationJob[];
    },
    enabled: !!currentPackId,
  });

  // Realtime subscription for live updates
  useEffect(() => {
    if (!currentPackId) return;
    const channel = supabase
      .channel(`gen-jobs-${currentPackId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "generation_jobs", filter: `pack_id=eq.${currentPackId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["generation_jobs", currentPackId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentPackId, queryClient]);

  return {
    jobs: jobsQuery.data || [],
    jobsLoading: jobsQuery.isLoading,
    refetch: jobsQuery.refetch,
  };
}
