import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export interface FaqEntry {
  id: string;
  pack_id: string;
  question: string;
  answer_markdown: string;
  source: "chat" | "discussion" | "manual";
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
  related_module_key: string | null;
  related_section_id: string | null;
  status: "draft" | "published" | "archived";
}

export function useFaqEntries() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const entriesQuery = useQuery({
    queryKey: ["faq_entries", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faq_entries" as any)
        .select("*")
        .eq("pack_id", currentPackId!)
        .neq("status", "archived")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FaqEntry[];
    },
    enabled: !!currentPackId,
  });

  const createFaqEntry = useMutation({
    mutationFn: async (payload: {
      question: string;
      answer_markdown: string;
      source: FaqEntry["source"];
      tags?: string[];
      related_module_key?: string;
      status?: FaqEntry["status"];
    }) => {
      const { data, error } = await supabase
        .from("faq_entries" as any)
        .insert({
          pack_id: currentPackId!,
          created_by: user!.id,
          question: payload.question,
          answer_markdown: payload.answer_markdown,
          source: payload.source,
          tags: payload.tags ?? [],
          related_module_key: payload.related_module_key ?? null,
          status: payload.status ?? "published",
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as FaqEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faq_entries", currentPackId] });
    },
  });

  const updateFaqEntry = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FaqEntry> }) => {
      const { error } = await supabase
        .from("faq_entries" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faq_entries", currentPackId] });
    },
  });

  const archiveFaqEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("faq_entries" as any)
        .update({ status: "archived" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faq_entries", currentPackId] });
    },
  });

  return {
    entries: entriesQuery.data ?? [],
    entriesLoading: entriesQuery.isLoading,
    createFaqEntry,
    updateFaqEntry,
    archiveFaqEntry,
  };
}
