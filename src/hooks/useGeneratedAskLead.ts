import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { sendAITask } from "@/lib/ai-client";
import { buildGenerateAskLeadEnvelope } from "@/lib/envelope-builder";
import { fetchEvidenceSpans } from "@/lib/fetch-spans";

export interface GeneratedAskLeadQuestion {
  id: string;
  question: string;
  why_it_matters: string;
  citations?: { span_id: string; path?: string; chunk_id?: string }[];
  track_key?: string | null;
  audience?: string | null;
}

export interface GeneratedAskLeadRow {
  id: string;
  pack_id: string;
  questions_data: GeneratedAskLeadQuestion[];
  created_at: string;
}

export function useGeneratedAskLead() {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();
  const { packAccessLevel } = useRole();
  const queryClient = useQueryClient();

  const askLeadQuery = useQuery({
    queryKey: ["generated_ask_lead", currentPackId],
    queryFn: async () => {
      if (!currentPackId) return null;
      const { data, error } = await supabase
        .from("generated_ask_lead")
        .select("*")
        .eq("pack_id", currentPackId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as GeneratedAskLeadRow | null;
    },
    enabled: !!currentPackId,
  });

  const generateAskLead = useMutation({
    mutationFn: async () => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");

      let spans: any[] = [];
      try {
        spans = await fetchEvidenceSpans(currentPackId, "team process architecture decisions workflow onboarding culture", 20);
      } catch {}

      const envelope = buildGenerateAskLeadEnvelope({
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
      const questionsData = result.questions as GeneratedAskLeadQuestion[];

      await supabase.from("generated_ask_lead").delete().eq("pack_id", currentPackId);

      const { data, error } = await supabase
        .from("generated_ask_lead")
        .insert({ pack_id: currentPackId, questions_data: questionsData as any })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as GeneratedAskLeadRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated_ask_lead", currentPackId] });
    },
  });

  return {
    askLead: askLeadQuery.data,
    askLeadLoading: askLeadQuery.isLoading,
    generateAskLead,
  };
}
