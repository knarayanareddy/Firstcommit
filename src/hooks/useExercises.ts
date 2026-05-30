import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { sendAITask } from "@/lib/ai-client";
import { fetchEvidenceSpans } from "@/lib/fetch-spans";
import { toast } from "sonner";

export interface Exercise {
  id: string;
  pack_id: string;
  module_key: string;
  section_id: string | null;
  exercise_key: string;
  title: string;
  description: string;
  exercise_type: string;
  difficulty: string;
  estimated_minutes: number;
  hints: string[];
  verification: Record<string, any>;
  evidence_citations: any[];
  sort_order: number;
  created_at: string;
}

export interface ExerciseSubmission {
  id: string;
  user_id: string;
  pack_id: string;
  exercise_key: string;
  submission_type: string;
  content: string;
  ai_feedback: {
    status: "correct" | "partially_correct" | "incorrect";
    feedback_markdown: string;
    score: number;
    suggestions: string[];
  } | null;
  status: string;
  hints_used: number;
  time_spent_seconds: number | null;
  submitted_at: string;
}

export function useExercises(moduleKey: string) {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();
  const { packAccessLevel, hasPackPermission } = useRole();
  const qc = useQueryClient();

  const exercisesQuery = useQuery({
    queryKey: ["exercises", currentPackId, moduleKey],
    queryFn: async () => {
      if (!currentPackId || !moduleKey) return [];
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("pack_id", currentPackId)
        .eq("module_key", moduleKey)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Exercise[];
    },
    enabled: !!currentPackId && !!moduleKey,
  });

  const mySubmissionsQuery = useQuery({
    queryKey: ["exercise_submissions", currentPackId, moduleKey, user?.id],
    queryFn: async () => {
      if (!currentPackId || !user) return [];
      // Get exercise keys for this module first
      const exercises = exercisesQuery.data || [];
      if (!exercises.length) return [];
      const keys = exercises.map((e) => e.exercise_key);
      const { data, error } = await supabase
        .from("exercise_submissions")
        .select("*")
        .eq("pack_id", currentPackId)
        .eq("user_id", user.id)
        .in("exercise_key", keys);
      if (error) throw error;
      return (data || []) as unknown as ExerciseSubmission[];
    },
    enabled: !!currentPackId && !!user && !!exercisesQuery.data?.length,
  });

  const submitExercise = useMutation({
    mutationFn: async (params: {
      exerciseKey: string;
      content: string;
      submissionType: string;
      hintsUsed: number;
      timeSpentSeconds: number;
    }) => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");
      const { data, error } = await supabase
        .from("exercise_submissions")
        .upsert(
          {
            user_id: user.id,
            pack_id: currentPackId,
            exercise_key: params.exerciseKey,
            submission_type: params.submissionType,
            content: params.content,
            hints_used: params.hintsUsed,
            time_spent_seconds: params.timeSpentSeconds,
            status: "submitted",
            ai_feedback: null,
          } as any,
          { onConflict: "user_id,pack_id,exercise_key" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ExerciseSubmission;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercise_submissions", currentPackId, moduleKey] });
    },
  });

  const verifyExercise = useMutation({
    mutationFn: async (params: {
      exerciseKey: string;
      exerciseDescription: string;
      exerciseType: string;
      verification: Record<string, any>;
      submission: string;
    }) => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");

      let spans: any[] = [];
      try {
        spans = await fetchEvidenceSpans(currentPackId, `${params.exerciseDescription.slice(0, 200)}`, 5);
      } catch {}

      const envelope = {
        task: { type: "verify_exercise", request_id: crypto.randomUUID() },
        auth: { user_id: user.id, org_id: currentPack?.org_id || null, roles: [], pack_access_level: packAccessLevel },
        pack: { pack_id: currentPackId, title: currentPack?.title },
        retrieval: { evidence_spans: spans.map((s: any) => ({ span_id: s.span_id, path: s.path, start_line: s.start_line, end_line: s.end_line, text: s.text })) },
        inputs: {
          exercise_description: params.exerciseDescription,
          exercise_type: params.exerciseType,
          verification_criteria: params.verification,
          learner_submission: params.submission,
        },
      };

      const result = await sendAITask(envelope);

      // Save feedback to submission
      const feedback = {
        status: result.status || "incorrect",
        feedback_markdown: result.feedback_markdown || result.response_markdown || "Could not generate feedback.",
        score: result.score ?? 0,
        suggestions: result.suggestions || [],
      };

      const submissionStatus = feedback.status === "correct" ? "verified" : feedback.status === "partially_correct" ? "needs_revision" : "needs_revision";

      await supabase
        .from("exercise_submissions")
        .update({ ai_feedback: feedback as any, status: submissionStatus } as any)
        .eq("user_id", user.id)
        .eq("pack_id", currentPackId)
        .eq("exercise_key", params.exerciseKey);

      qc.invalidateQueries({ queryKey: ["exercise_submissions", currentPackId, moduleKey] });
      return feedback;
    },
  });

  const generateExercises = useMutation({
    mutationFn: async (params: { moduleTitle: string; moduleDescription?: string }) => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");

      let spans: any[] = [];
      try {
        spans = await fetchEvidenceSpans(currentPackId, `${params.moduleTitle} ${params.moduleDescription || ""} exercises hands-on`, 15);
      } catch {}

      const envelope = {
        task: { type: "generate_exercises", request_id: crypto.randomUUID() },
        auth: { user_id: user.id, org_id: currentPack?.org_id || null, roles: [], pack_access_level: packAccessLevel },
        pack: { pack_id: currentPackId, title: currentPack?.title, description: currentPack?.description, language_mode: currentPack?.language_mode },
        retrieval: { evidence_spans: spans.map((s: any) => ({ span_id: s.span_id, path: s.path, start_line: s.start_line, end_line: s.end_line, text: s.text })) },
        inputs: {
          module_key: moduleKey,
          module_title: params.moduleTitle,
          module_description: params.moduleDescription,
        },
      };

      const result = await sendAITask(envelope);
      const exercises = result.exercises || [];

      // Delete old exercises for this module, then insert new ones
      await supabase.from("exercises").delete().eq("pack_id", currentPackId).eq("module_key", moduleKey);

      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        await supabase.from("exercises").insert({
          pack_id: currentPackId,
          module_key: moduleKey,
          section_id: ex.section_id || null,
          exercise_key: ex.exercise_key || `${moduleKey}-ex-${i + 1}`,
          title: ex.title,
          description: ex.description,
          exercise_type: ex.exercise_type,
          difficulty: ex.difficulty || "intermediate",
          estimated_minutes: ex.estimated_minutes || 10,
          hints: ex.hints || [],
          verification: ex.verification || {},
          evidence_citations: ex.evidence_citations || [],
          sort_order: i,
        } as any);
      }

      qc.invalidateQueries({ queryKey: ["exercises", currentPackId, moduleKey] });
      return exercises.length;
    },
  });

  const deleteExercise = useMutation({
    mutationFn: async (exerciseId: string) => {
      const { error } = await supabase.from("exercises").delete().eq("id", exerciseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercises", currentPackId, moduleKey] });
    },
  });

  return {
    exercises: exercisesQuery.data || [],
    exercisesLoading: exercisesQuery.isLoading,
    mySubmissions: mySubmissionsQuery.data || [],
    submissionsLoading: mySubmissionsQuery.isLoading,
    submitExercise,
    verifyExercise,
    generateExercises,
    deleteExercise,
  };
}
