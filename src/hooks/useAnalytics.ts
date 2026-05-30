import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePack } from "@/hooks/usePack";

export interface AnalyticsMetrics {
  totalMembers: number;
  totalModules: number;
  totalSectionsRead: number;
  totalQuizzesTaken: number;
  avgQuizScore: number;
  totalXpEarned: number;
  activeLearners: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  xp: number;
  sectionsRead: number;
  quizAvg: number;
}

export interface ModuleEngagement {
  moduleKey: string;
  title: string;
  sectionsRead: number;
  quizzesTaken: number;
  avgScore: number;
}

export function useAnalytics() {
  const { currentPackId } = usePack();

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["analytics_metrics", currentPackId],
    queryFn: async (): Promise<AnalyticsMetrics> => {
      const [members, modules, progress, quizzes, xp] = await Promise.all([
        supabase.from("pack_members").select("id", { count: "exact", head: true }).eq("pack_id", currentPackId!),
        supabase.from("generated_modules").select("id", { count: "exact", head: true }).eq("pack_id", currentPackId!).eq("status", "published"),
        supabase.from("user_progress").select("user_id, id").eq("pack_id", currentPackId!),
        supabase.from("quiz_scores").select("score, total, user_id").eq("pack_id", currentPackId!),
        supabase.from("learner_xp").select("amount").eq("pack_id", currentPackId!),
      ]);

      const progressData = progress.data || [];
      const quizData = quizzes.data || [];
      const xpData = xp.data || [];

      const uniqueLearners = new Set(progressData.map(p => p.user_id));
      const avgScore = quizData.length > 0
        ? Math.round(quizData.reduce((a, q) => a + (q.score / q.total) * 100, 0) / quizData.length)
        : 0;

      return {
        totalMembers: members.count || 0,
        totalModules: modules.count || 0,
        totalSectionsRead: progressData.length,
        totalQuizzesTaken: quizData.length,
        avgQuizScore: avgScore,
        totalXpEarned: xpData.reduce((a, x) => a + x.amount, 0),
        activeLearners: uniqueLearners.size,
      };
    },
    enabled: !!currentPackId,
  });

  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery({
    queryKey: ["analytics_leaderboard", currentPackId],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const { data: xpData } = await supabase
        .from("learner_xp")
        .select("user_id, amount")
        .eq("pack_id", currentPackId!);

      if (!xpData || xpData.length === 0) return [];

      // Aggregate XP by user
      const xpByUser: Record<string, number> = {};
      xpData.forEach(x => { xpByUser[x.user_id] = (xpByUser[x.user_id] || 0) + x.amount; });

      const userIds = Object.keys(xpByUser);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach(p => { profileMap[p.user_id] = p.display_name || "Anonymous"; });

      return userIds
        .map(uid => ({
          userId: uid,
          displayName: profileMap[uid] || "Anonymous",
          xp: xpByUser[uid],
          sectionsRead: 0,
          quizAvg: 0,
        }))
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 20);
    },
    enabled: !!currentPackId,
  });

  const { data: moduleEngagement = [], isLoading: engagementLoading } = useQuery({
    queryKey: ["analytics_engagement", currentPackId],
    queryFn: async (): Promise<ModuleEngagement[]> => {
      const [modules, progress, quizzes] = await Promise.all([
        supabase.from("generated_modules").select("module_key, title").eq("pack_id", currentPackId!).eq("status", "published"),
        supabase.from("user_progress").select("module_id").eq("pack_id", currentPackId!),
        supabase.from("quiz_scores").select("module_id, score, total").eq("pack_id", currentPackId!),
      ]);

      const mods = modules.data || [];
      const prog = progress.data || [];
      const quiz = quizzes.data || [];

      return mods.map(m => {
        const reads = prog.filter(p => p.module_id === m.module_key).length;
        const modQuizzes = quiz.filter(q => q.module_id === m.module_key);
        const avg = modQuizzes.length > 0
          ? Math.round(modQuizzes.reduce((a, q) => a + (q.score / q.total) * 100, 0) / modQuizzes.length)
          : 0;
        return {
          moduleKey: m.module_key,
          title: m.title,
          sectionsRead: reads,
          quizzesTaken: modQuizzes.length,
          avgScore: avg,
        };
      });
    },
    enabled: !!currentPackId,
  });

  return {
    metrics: metrics || null,
    metricsLoading,
    leaderboard,
    leaderboardLoading,
    moduleEngagement,
    engagementLoading,
  };
}
