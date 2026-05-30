import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePack } from "@/hooks/usePack";

export interface ContentFreshnessRow {
  id: string; pack_id: string; module_key: string; section_id: string;
  referenced_chunk_ids: string[]; chunk_hash_at_generation: Record<string, string>;
  is_stale: boolean; staleness_details: Record<string, any>; last_checked_at: string;
}

export function useContentFreshness() {
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const freshness = useQuery({
    queryKey: ["content_freshness", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_freshness").select("*").eq("pack_id", currentPackId);
      if (error) throw error;
      return (data ?? []) as ContentFreshnessRow[];
    },
    enabled: !!currentPackId,
  });

  const staleCount = (freshness.data ?? []).filter(f => f.is_stale).length;
  const totalSections = freshness.data?.length ?? 0;
  const freshPct = totalSections > 0 ? Math.round(((totalSections - staleCount) / totalSections) * 100) : 100;

  const checkStaleness = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-staleness", { body: { pack_id: currentPackId } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content_freshness"] }),
  });

  return { freshness: freshness.data ?? [], staleCount, freshPct, totalSections, checkStaleness, isLoading: freshness.isLoading };
}
