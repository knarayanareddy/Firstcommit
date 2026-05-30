import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePack } from "@/hooks/usePack";

export interface FaqSuggestion {
  id: string;
  pack_id: string;
  canonical_question: string;
  example_questions: string[];
  count: number;
  last_seen_at: string;
  status: "open" | "dismissed" | "converted";
  converted_to_faq_id: string | null;
}

export function useFaqSuggestions() {
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const suggestionsQuery = useQuery({
    queryKey: ["faq_suggestions", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faq_suggestions" as any)
        .select("*")
        .eq("pack_id", currentPackId!)
        .eq("status", "open")
        .order("count", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FaqSuggestion[];
    },
    enabled: !!currentPackId,
  });

  const dismissSuggestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("faq_suggestions" as any)
        .update({ status: "dismissed" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faq_suggestions", currentPackId] });
    },
  });

  const markConverted = useMutation({
    mutationFn: async ({ id, faqId }: { id: string; faqId: string }) => {
      const { error } = await supabase
        .from("faq_suggestions" as any)
        .update({ status: "converted", converted_to_faq_id: faqId } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faq_suggestions", currentPackId] });
    },
  });

  return {
    suggestions: suggestionsQuery.data ?? [],
    suggestionsLoading: suggestionsQuery.isLoading,
    dismissSuggestion,
    markConverted,
  };
}

/** Call this when a user sends a chat message or creates a question discussion thread */
export async function trackQuestionSuggestion(packId: string, question: string) {
  try {
    await supabase.rpc("upsert_faq_suggestion" as any, {
      p_pack_id: packId,
      p_question: question,
    });
  } catch {
    // Best-effort: don't block the UI if RPC fails
  }
}
