import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { sendAITask } from "@/lib/ai-client";
import { buildGeneratePathsEnvelope } from "@/lib/envelope-builder";
import { fetchEvidenceSpans } from "@/lib/fetch-spans";

export interface GeneratedPathStep {
  id: string;
  title: string;
  time_estimate_minutes: number;
  steps: string[];
  success_criteria: string[];
  citations?: { span_id: string; path?: string; chunk_id?: string }[];
  track_key?: string | null;
  audience?: string | null;
  depth?: string | null;
}

export interface GeneratedPathsData {
  day1: GeneratedPathStep[];
  week1: GeneratedPathStep[];
}

export interface GeneratedPathsRow {
  id: string;
  pack_id: string;
  paths_data: GeneratedPathsData;
  created_at: string;
}

export function useGeneratedPaths() {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();
  const { packAccessLevel } = useRole();
  const queryClient = useQueryClient();

  const pathsQuery = useQuery({
    queryKey: ["generated_paths", currentPackId],
    queryFn: async () => {
      if (!currentPackId) return null;
      const { data, error } = await supabase
        .from("generated_paths")
        .select("*")
        .eq("pack_id", currentPackId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as GeneratedPathsRow | null;
    },
    enabled: !!currentPackId,
  });

  const generatePaths = useMutation({
    mutationFn: async () => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");

      let spans: any[] = [];
      try {
        spans = await fetchEvidenceSpans(currentPackId, "setup onboarding getting started environment configuration deployment workflow", 20);
      } catch {}

      const envelope = buildGeneratePathsEnvelope({
        auth: {
          user_id: user.id,
          org_id: currentPack?.org_id || null,
          roles: [],
          pack_access_level: packAccessLevel,
        },
        pack: {
          pack_id: currentPackId,
          pack_version: currentPack?.pack_version,
          title: currentPack?.title,
          description: currentPack?.description,
          language_mode: currentPack?.language_mode,
        },
        evidenceSpans: spans,
      });

      const result = await sendAITask(envelope);
      const pathsData: GeneratedPathsData = {
        day1: result.day1 || [],
        week1: result.week1 || [],
      };

      await supabase.from("generated_paths").delete().eq("pack_id", currentPackId);

      const { data, error } = await supabase
        .from("generated_paths")
        .insert({ pack_id: currentPackId, paths_data: pathsData as any })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as GeneratedPathsRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated_paths", currentPackId] });
    },
  });

  return {
    paths: pathsQuery.data,
    pathsLoading: pathsQuery.isLoading,
    generatePaths,
  };
}
