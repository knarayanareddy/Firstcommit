import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { sendAITask } from "@/lib/ai-client";
import { buildGenerateQuizEnvelope } from "@/lib/envelope-builder";
import { fetchEvidenceSpans } from "@/lib/fetch-spans";
import type { GeneratedModuleData } from "@/hooks/useGeneratedModules";

export interface QuizChoice {
  id: string;
  text: string;
}

export interface GeneratedQuizQuestion {
  id: string;
  prompt: string;
  choices: QuizChoice[];
  correct_choice_id: string;
  explanation_markdown: string;
  citations?: { span_id: string; path?: string; chunk_id?: string }[];
}

export interface GeneratedQuizData {
  module_key: string;
  track_key: string | null;
  audience: string | null;
  depth: string | null;
  questions: GeneratedQuizQuestion[];
}

export interface GeneratedQuizRow {
  id: string;
  pack_id: string;
  module_key: string;
  quiz_data: GeneratedQuizData;
  created_at: string;
}

export function useGeneratedQuiz(moduleKey: string) {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();
  const { packAccessLevel } = useRole();
  const queryClient = useQueryClient();

  const quizQuery = useQuery({
    queryKey: ["generated_quiz", currentPackId, moduleKey],
    queryFn: async () => {
      if (!currentPackId || !moduleKey) return null;
      const { data, error } = await supabase
        .from("generated_quizzes")
        .select("*")
        .eq("pack_id", currentPackId)
        .eq("module_key", moduleKey)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as GeneratedQuizRow | null;
    },
    enabled: !!currentPackId && !!moduleKey,
  });

  const generateQuiz = useMutation({
    mutationFn: async (opts: {
      moduleData?: GeneratedModuleData;
      trackKey?: string | null;
    }) => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");

      // Retrieve spans for the module
      let spans: any[] = [];
      try {
        spans = await fetchEvidenceSpans(currentPackId, `${moduleKey} quiz questions assessment`, 10);
      } catch {}

      const envelope = buildGenerateQuizEnvelope({
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
        moduleKey,
        trackKey: opts.trackKey,
        moduleData: opts.moduleData,
        evidenceSpans: spans,
      });

      const result = await sendAITask(envelope);
      const quizData = result.quiz as GeneratedQuizData;

      const { data, error } = await supabase
        .from("generated_quizzes")
        .upsert(
          {
            pack_id: currentPackId,
            module_key: moduleKey,
            quiz_data: quizData as any,
          },
          { onConflict: "pack_id,module_key" }
        )
        .select()
        .single();

      if (error) throw error;
      return data as unknown as GeneratedQuizRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated_quiz", currentPackId, moduleKey] });
    },
  });

  return {
    quiz: quizQuery.data,
    quizLoading: quizQuery.isLoading,
    generateQuiz,
  };
}
