import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export interface ManualGlossaryTerm {
  id: string;
  pack_id: string;
  term: string;
  definition: string;
  context: string | null;
  created_by: string | null;
  created_at: string;
  source: "manual" | "faq" | "chat";
}

export function useManualGlossary() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const termsQuery = useQuery({
    queryKey: ["manual_glossary", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_glossary_terms" as any)
        .select("*")
        .eq("pack_id", currentPackId!)
        .order("term", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ManualGlossaryTerm[];
    },
    enabled: !!currentPackId,
  });

  const createTerm = useMutation({
    mutationFn: async (payload: { term: string; definition: string; context?: string; source?: ManualGlossaryTerm["source"] }) => {
      const { data, error } = await supabase
        .from("manual_glossary_terms" as any)
        .insert({
          pack_id: currentPackId!,
          created_by: user!.id,
          term: payload.term,
          definition: payload.definition,
          context: payload.context ?? null,
          source: payload.source ?? "manual",
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ManualGlossaryTerm;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual_glossary", currentPackId] });
    },
  });

  const deleteTerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("manual_glossary_terms" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual_glossary", currentPackId] });
    },
  });

  return {
    manualTerms: termsQuery.data ?? [],
    manualTermsLoading: termsQuery.isLoading,
    createTerm,
    deleteTerm,
  };
}
