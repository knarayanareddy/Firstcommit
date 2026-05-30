import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export function useSources() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["pack_sources", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_sources_safe" as any)
        .select("*")
        .eq("pack_id", currentPackId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentPackId,
  });

  const addSource = useMutation({
    mutationFn: async ({ sourceType, sourceUri, label, sourceConfig }: {
      sourceType: string;
      sourceUri: string;
      label?: string;
      sourceConfig?: Record<string, any>;
    }) => {
      const insertData: any = {
        pack_id: currentPackId,
        source_type: sourceType,
        source_uri: sourceUri,
        label: label || null,
      };
      if (sourceConfig) {
        insertData.source_config = sourceConfig;
      }
      const { data, error } = await supabase
        .from("pack_sources")
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pack_sources", currentPackId] });
    },
  });

  const deleteSource = useMutation({
    mutationFn: async (sourceId: string) => {
      // CASCADE handles ingestion_jobs and knowledge_chunks cleanup automatically
      const { error } = await supabase
        .from("pack_sources")
        .delete()
        .eq("id", sourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pack_sources", currentPackId] });
      queryClient.invalidateQueries({ queryKey: ["chunk_counts", currentPackId] });
      queryClient.invalidateQueries({ queryKey: ["ingestion_jobs"] });
    },
  });

  const updateSourceWeight = useMutation({
    mutationFn: async ({ sourceId, weight }: { sourceId: string; weight: number }) => {
      const { error } = await supabase
        .from("pack_sources")
        .update({ weight } as any)
        .eq("id", sourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pack_sources", currentPackId] });
    },
  });

  // Get chunk count per source
  const { data: chunkCounts = {} } = useQuery({
    queryKey: ["chunk_counts", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_chunks")
        .select("source_id")
        .eq("pack_id", currentPackId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((c) => {
        counts[c.source_id] = (counts[c.source_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!currentPackId,
  });

  const configureSource = useMutation({
    mutationFn: async ({ sourceId, sourceType, sourceUri, label, sourceConfig, credentials }: {
      sourceId?: string;
      sourceType: string;
      sourceUri: string;
      label?: string;
      sourceConfig?: Record<string, any>;
      credentials?: Record<string, string>;
    }) => {
      const { data, error } = await supabase.functions.invoke("configure-source", {
        body: {
          pack_id: currentPackId,
          source_id: sourceId,
          source_type: sourceType,
          source_uri: sourceUri,
          label,
          source_config: sourceConfig,
          credentials,
        }
      });
      if (error) throw error;

      const normalizedId = data?.id ?? data?.source_id ?? sourceId;
      if (!normalizedId) {
        throw new Error("Source configuration succeeded but no source id was returned");
      }

      return {
        ...data,
        id: normalizedId,
        source_id: normalizedId,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pack_sources", currentPackId] });
    },
  });

  return { sources, isLoading, addSource, configureSource, deleteSource, updateSourceWeight, chunkCounts };
}
