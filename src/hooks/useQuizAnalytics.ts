import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePack } from "@/hooks/usePack";

export interface ModuleQuizStat {
  moduleKey: string;
  moduleTitle: string;
  avgScore: number;
  totalAttempts: number;
  passRate: number;
  uniqueLearners: number;
}

export interface QuestionStat {
  questionId: string;
  prompt: string;
  correctRate: number;
  avgTimeSeconds: number;
  totalAnswers: number;
  answerDistribution: { choiceId: string; choiceText: string; count: number; isCorrect: boolean }[];
  feedbackCounts: Record<string, number>;
  feedbackComments: { type: string; comment: string }[];
}

export interface QuizOverview {
  totalAttempts: number;
  avgScore: number;
  avgTimeMinutes: number;
  passRate: number;
  perfectScores: number;
  firstTryPassRate: number;
}

export interface Recommendation {
  type: "hard" | "easy" | "slow" | "content_gap" | "retake";
  moduleKey: string;
  questionId?: string;
  questionPrompt?: string;
  message: string;
}

export function useQuizAnalytics() {
  const { currentPackId } = usePack();

  // Pack-level overview from quiz_scores
  const overviewQuery = useQuery({
    queryKey: ["quiz_analytics_overview", currentPackId],
    queryFn: async (): Promise<QuizOverview> => {
      if (!currentPackId) return { totalAttempts: 0, avgScore: 0, avgTimeMinutes: 0, passRate: 0, perfectScores: 0, firstTryPassRate: 0 };
      const { data: scores, error } = await supabase
        .from("quiz_scores")
        .select("*")
        .eq("pack_id", currentPackId);
      if (error) throw error;
      if (!scores || scores.length === 0) return { totalAttempts: 0, avgScore: 0, avgTimeMinutes: 0, passRate: 0, perfectScores: 0, firstTryPassRate: 0 };

      const total = scores.length;
      const avgPct = scores.reduce((s, r) => s + (r.total > 0 ? (r.score / r.total) * 100 : 0), 0) / total;
      const passCount = scores.filter((r) => r.total > 0 && (r.score / r.total) >= 0.7).length;
      const perfectCount = scores.filter((r) => r.score === r.total).length;

      // Estimate first-try pass: group by (user,module), take earliest
      const firstTries = new Map<string, typeof scores[0]>();
      scores.forEach((s) => {
        const key = `${s.user_id}::${s.module_id}`;
        const existing = firstTries.get(key);
        if (!existing || s.completed_at < existing.completed_at) firstTries.set(key, s);
      });
      const firstTryPass = [...firstTries.values()].filter((r) => r.total > 0 && (r.score / r.total) >= 0.7).length;

      return {
        totalAttempts: total,
        avgScore: Math.round(avgPct),
        avgTimeMinutes: 0, // We'll compute from quiz_attempts if available
        passRate: Math.round((passCount / total) * 100),
        perfectScores: Math.round((perfectCount / total) * 100),
        firstTryPassRate: firstTries.size > 0 ? Math.round((firstTryPass / firstTries.size) * 100) : 0,
      };
    },
    enabled: !!currentPackId,
  });

  // Per-module stats
  const moduleStatsQuery = useQuery({
    queryKey: ["quiz_analytics_modules", currentPackId],
    queryFn: async (): Promise<ModuleQuizStat[]> => {
      if (!currentPackId) return [];
      const [scoresRes, modulesRes] = await Promise.all([
        supabase.from("quiz_scores").select("*").eq("pack_id", currentPackId),
        supabase.from("generated_modules").select("module_key, title").eq("pack_id", currentPackId).eq("status", "published"),
      ]);
      if (scoresRes.error) throw scoresRes.error;
      if (modulesRes.error) throw modulesRes.error;

      const titleMap = new Map((modulesRes.data || []).map((m) => [m.module_key, m.title]));
      const grouped = new Map<string, typeof scoresRes.data>();
      (scoresRes.data || []).forEach((s) => {
        const arr = grouped.get(s.module_id) || [];
        arr.push(s);
        grouped.set(s.module_id, arr);
      });

      return [...grouped.entries()].map(([mk, arr]) => {
        const avgPct = arr.reduce((s, r) => s + (r.total > 0 ? (r.score / r.total) * 100 : 0), 0) / arr.length;
        const passCount = arr.filter((r) => r.total > 0 && (r.score / r.total) >= 0.7).length;
        const uniqueUsers = new Set(arr.map((a) => a.user_id));
        return {
          moduleKey: mk,
          moduleTitle: titleMap.get(mk) || mk,
          avgScore: Math.round(avgPct),
          totalAttempts: arr.length,
          passRate: Math.round((passCount / arr.length) * 100),
          uniqueLearners: uniqueUsers.size,
        };
      });
    },
    enabled: !!currentPackId,
  });

  // Per-question stats for a specific module
  const fetchQuestionStats = (moduleKey: string) =>
    useQuery({
      queryKey: ["quiz_analytics_questions", currentPackId, moduleKey],
      queryFn: async (): Promise<QuestionStat[]> => {
        if (!currentPackId || !moduleKey) return [];

        const [attemptsRes, feedbackRes, quizRes] = await Promise.all([
          supabase.from("quiz_attempts").select("*").eq("pack_id", currentPackId).eq("module_key", moduleKey),
          supabase.from("quiz_question_feedback").select("*").eq("pack_id", currentPackId).eq("module_key", moduleKey),
          supabase.from("generated_quizzes").select("quiz_data").eq("pack_id", currentPackId).eq("module_key", moduleKey).maybeSingle(),
        ]);
        if (attemptsRes.error) throw attemptsRes.error;

        const attempts = attemptsRes.data || [];
        const feedback = feedbackRes.data || [];
        const quizData = quizRes.data?.quiz_data as any;
        const questions: any[] = quizData?.questions || [];
        const qMap = new Map(questions.map((q: any) => [q.id, q]));

        // Group attempts by question
        const grouped = new Map<string, typeof attempts>();
        attempts.forEach((a) => {
          const arr = grouped.get(a.question_id) || [];
          arr.push(a);
          grouped.set(a.question_id, arr);
        });

        // Group feedback by question
        const fbGrouped = new Map<string, typeof feedback>();
        feedback.forEach((f) => {
          const arr = fbGrouped.get(f.question_id) || [];
          arr.push(f);
          fbGrouped.set(f.question_id, arr);
        });

        return questions.map((q: any) => {
          const qAttempts = grouped.get(q.id) || [];
          const qFeedback = fbGrouped.get(q.id) || [];
          const correctCount = qAttempts.filter((a) => a.is_correct).length;
          const avgTime = qAttempts.length > 0
            ? qAttempts.reduce((s, a) => s + (a.time_spent_seconds || 0), 0) / qAttempts.length
            : 0;

          // Answer distribution
          const choiceCounts = new Map<string, number>();
          qAttempts.forEach((a) => {
            choiceCounts.set(a.selected_choice_id, (choiceCounts.get(a.selected_choice_id) || 0) + 1);
          });
          const distribution = (q.choices || []).map((c: any) => ({
            choiceId: c.id,
            choiceText: c.text,
            count: choiceCounts.get(c.id) || 0,
            isCorrect: c.id === q.correct_choice_id,
          }));

          // Feedback counts
          const fbCounts: Record<string, number> = {};
          const fbComments: { type: string; comment: string }[] = [];
          qFeedback.forEach((f) => {
            fbCounts[f.feedback_type] = (fbCounts[f.feedback_type] || 0) + 1;
            if (f.comment) fbComments.push({ type: f.feedback_type, comment: f.comment });
          });

          return {
            questionId: q.id,
            prompt: q.prompt,
            correctRate: qAttempts.length > 0 ? Math.round((correctCount / qAttempts.length) * 100) : 0,
            avgTimeSeconds: Math.round(avgTime),
            totalAnswers: qAttempts.length,
            answerDistribution: distribution,
            feedbackCounts: fbCounts,
            feedbackComments: fbComments,
          };
        });
      },
      enabled: !!currentPackId && !!moduleKey,
    });

  // Compute recommendations
  const computeRecommendations = (moduleStats: ModuleQuizStat[], questionStats: Map<string, QuestionStat[]>): Recommendation[] => {
    const recs: Recommendation[] = [];

    moduleStats.forEach((ms) => {
      if (ms.avgScore < 60) {
        recs.push({ type: "retake", moduleKey: ms.moduleKey, message: `"${ms.moduleTitle}" has a ${ms.avgScore}% avg score and ${ms.passRate}% pass rate. Consider revising the module content or quiz questions.` });
      }
    });

    questionStats.forEach((qs, mk) => {
      const moduleTitle = moduleStats.find((m) => m.moduleKey === mk)?.moduleTitle || mk;
      qs.forEach((q) => {
        if (q.totalAnswers >= 3 && q.correctRate < 40) {
          recs.push({ type: "hard", moduleKey: mk, questionId: q.questionId, questionPrompt: q.prompt, message: `"${q.prompt.slice(0, 60)}..." has a ${q.correctRate}% correct rate. Consider rewriting or clarifying answer options.` });
        }
        if (q.totalAnswers >= 5 && q.correctRate > 95) {
          recs.push({ type: "easy", moduleKey: mk, questionId: q.questionId, questionPrompt: q.prompt, message: `"${q.prompt.slice(0, 60)}..." has a ${q.correctRate}% correct rate. This may not be testing meaningful comprehension.` });
        }
        if (q.totalAnswers >= 3 && q.avgTimeSeconds > 30) {
          recs.push({ type: "slow", moduleKey: mk, questionId: q.questionId, questionPrompt: q.prompt, message: `"${q.prompt.slice(0, 60)}..." takes an avg of ${q.avgTimeSeconds}s. Learners may be struggling.` });
        }
        // Content gap: check if one wrong answer dominates
        if (q.totalAnswers >= 5) {
          const wrongChoices = q.answerDistribution.filter((d) => !d.isCorrect && d.count > 0);
          const totalWrong = wrongChoices.reduce((s, d) => s + d.count, 0);
          wrongChoices.forEach((wc) => {
            if (totalWrong > 0 && wc.count / q.totalAnswers > 0.35) {
              recs.push({ type: "content_gap", moduleKey: mk, questionId: q.questionId, message: `${Math.round((wc.count / q.totalAnswers) * 100)}% chose "${wc.choiceText.slice(0, 40)}..." for "${q.prompt.slice(0, 40)}...". This suggests a common misconception.` });
            }
          });
        }
      });
    });

    return recs;
  };

  return {
    overview: overviewQuery.data,
    overviewLoading: overviewQuery.isLoading,
    moduleStats: moduleStatsQuery.data || [],
    moduleStatsLoading: moduleStatsQuery.isLoading,
    fetchQuestionStats,
    computeRecommendations,
  };
}
