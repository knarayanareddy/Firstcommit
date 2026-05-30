import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { useAudiencePrefs } from "@/hooks/useAudiencePrefs";
import { sendAITask } from "@/lib/ai-client";
import { buildGenerateGlossaryEnvelope } from "@/lib/envelope-builder";
import { fetchEvidenceSpans } from "@/lib/fetch-spans";

export interface GlossaryTerm {
  term: string;
  definition: string;
  context: string;
  citations?: { span_id: string; path?: string; chunk_id?: string }[];
  audience?: string | null;
}

export interface GeneratedGlossaryRow {
  id: string;
  pack_id: string;
  glossary_data: GlossaryTerm[];
  glossary_density: string | null;
  created_at: string;
}

export function useGeneratedGlossary() {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();
  const { packAccessLevel } = useRole();
  const { glossaryDensity } = useAudiencePrefs();
  const queryClient = useQueryClient();

  const glossaryQuery = useQuery({
    queryKey: ["generated_glossary", currentPackId],
    queryFn: async () => {
      if (!currentPackId) return null;
      const { data, error } = await supabase
        .from("generated_glossaries")
        .select("*")
        .eq("pack_id", currentPackId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as GeneratedGlossaryRow | null;
    },
    enabled: !!currentPackId,
  });

  const generateGlossary = useMutation({
    mutationFn: async (opts?: { density?: string }) => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");

      const density = opts?.density || glossaryDensity;

      // Retrieve broad spans
      let spans: any[] = [];
      try {
        spans = await fetchEvidenceSpans(currentPackId, "glossary terms definitions technical vocabulary configuration", 20);
      } catch {}

      const envelope = buildGenerateGlossaryEnvelope({
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
        glossaryDensity: density,
      });

      const result = await sendAITask(envelope);
      const glossaryData = result.glossary as GlossaryTerm[];

      // Delete existing then insert new
      await supabase
        .from("generated_glossaries")
        .delete()
        .eq("pack_id", currentPackId);

      const { data, error } = await supabase
        .from("generated_glossaries")
        .insert({
          pack_id: currentPackId,
          glossary_data: glossaryData as any,
          glossary_density: density,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as GeneratedGlossaryRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated_glossary", currentPackId] });
    },
  });

  return {
    glossary: glossaryQuery.data,
    glossaryLoading: glossaryQuery.isLoading,
    generateGlossary,
  };
}
