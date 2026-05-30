import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export interface QuizAttemptInsert {
  module_key: string;
  question_id: string;
  selected_choice_id: string;
  is_correct: boolean;
  time_spent_seconds: number | null;
  attempt_number: number;
}

export function useQuizAttempts(moduleKey: string) {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const myAttempts = useQuery({
    queryKey: ["quiz_attempts", currentPackId, moduleKey, user?.id],
    queryFn: async () => {
      if (!currentPackId || !user) return [];
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("pack_id", currentPackId)
        .eq("module_key", moduleKey)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentPackId && !!moduleKey && !!user,
  });

  const getMaxAttemptNumber = (): number => {
    if (!myAttempts.data || myAttempts.data.length === 0) return 0;
    return Math.max(...myAttempts.data.map((a) => a.attempt_number));
  };

  const saveAttempt = useMutation({
    mutationFn: async (attempt: QuizAttemptInsert) => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");
      const { error } = await supabase.from("quiz_attempts").insert({
        user_id: user.id,
        pack_id: currentPackId,
        module_key: attempt.module_key,
        question_id: attempt.question_id,
        selected_choice_id: attempt.selected_choice_id,
        is_correct: attempt.is_correct,
        time_spent_seconds: attempt.time_spent_seconds,
        attempt_number: attempt.attempt_number,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quiz_attempts", currentPackId, moduleKey] });
    },
  });

  const saveQuestionFeedback = useMutation({
    mutationFn: async (fb: { question_id: string; feedback_type: string; comment?: string }) => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");
      const { error } = await supabase.from("quiz_question_feedback").insert({
        user_id: user.id,
        pack_id: currentPackId,
        module_key: moduleKey,
        question_id: fb.question_id,
        feedback_type: fb.feedback_type,
        comment: fb.comment || null,
      });
      if (error && !error.message.includes("duplicate")) throw error;
    },
  });

  return { myAttempts, getMaxAttemptNumber, saveAttempt, saveQuestionFeedback };
}
