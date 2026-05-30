import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export type ChatFeedbackReason =
  | "incorrect"
  | "outdated"
  | "confusing"
  | "missing_citations"
  | "policy_violation";

export interface ChatFeedbackRow {
  id: string;
  user_id: string;
  pack_id: string | null;
  module_id: string | null;
  message_content: string;
  reason: ChatFeedbackReason;
  comment: string | null;
  create_task: boolean;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export const CHAT_FEEDBACK_REASON_LABELS: Record<ChatFeedbackReason, { label: string; icon: string }> = {
  incorrect: { label: "Incorrect", icon: "❌" },
  outdated: { label: "Outdated", icon: "📅" },
  confusing: { label: "Confusing", icon: "🤔" },
  missing_citations: { label: "Missing citations", icon: "🔍" },
  policy_violation: { label: "Policy violation", icon: "🚨" },
};

export function useChatFeedback() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  /** All chat feedback for the current pack (author view) */
  const packChatFeedback = useQuery({
    queryKey: ["chat_feedback", "pack", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_feedback" as any)
        .select("*")
        .eq("pack_id", currentPackId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ChatFeedbackRow[];
    },
    enabled: !!currentPackId,
  });

  const submitChatFeedback = useMutation({
    mutationFn: async ({
      messageContent,
      reason,
      comment,
      createTask,
      moduleId,
      traceId,
    }: {
      messageContent: string;
      reason: ChatFeedbackReason;
      comment?: string;
      createTask?: boolean;
      moduleId?: string;
      traceId?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("chat_feedback" as any)
        .insert({
          user_id: user.id,
          pack_id: currentPackId ?? null,
          module_id: moduleId ?? null,
          message_content: messageContent.slice(0, 2000), // cap size
          reason,
          comment: comment ?? null,
          create_task: createTask ?? true,
          trace_id: traceId ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as ChatFeedbackRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat_feedback"] });
    },
  });

  const resolveChatFeedback = useMutation({
    mutationFn: async (feedbackId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("chat_feedback" as any)
        .update({
          is_resolved: true,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", feedbackId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat_feedback"] });
    },
  });

  return {
    packChatFeedback: packChatFeedback.data ?? [],
    isLoadingPackFeedback: packChatFeedback.isLoading,
    submitChatFeedback,
    resolveChatFeedback,
  };
}
