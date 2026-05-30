import { DashboardLayout } from "@/components/DashboardLayout";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3, Users, BookOpen, CheckCircle2, Trophy, Zap, Target, Award,
} from "lucide-react";
import { motion } from "framer-motion";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP_TOOLTIPS } from "@/data/help-tooltips";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { CohortScatterChart } from "@/components/CohortScatterChart";
import { AlertTriangle, Clock } from "lucide-react";

function MetricCard({ icon: Icon, label, value, sub, helpContent }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; helpContent?: string;
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {label}
            {helpContent && <HelpTooltip content={helpContent} />}
          </p>
          {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { hasPackPermission } = useRole();
  const { metrics, metricsLoading, leaderboard, moduleEngagement } = useAnalytics();

  if (!hasPackPermission("admin")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Admin access required to view analytics.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (metricsLoading || !metrics) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        </div>
      </DashboardLayout>
    );
  }

  const chartData = moduleEngagement.map(m => ({
    name: m.title.length > 20 ? m.title.slice(0, 18) + "…" : m.title,
    reads: m.sectionsRead,
    quizzes: m.quizzesTaken,
    score: m.avgScore,
  }));

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} data-tour="analytics-header">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Pack engagement & learner performance</p>
        </motion.div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-tour="analytics-metrics">
          <MetricCard icon={Users} label="Members" value={metrics.totalMembers} />
          <MetricCard icon={BookOpen} label="Published Modules" value={metrics.totalModules} />
          <MetricCard icon={CheckCircle2} label="Sections Read" value={metrics.totalSectionsRead} />
          <MetricCard icon={Target} label="Quizzes Taken" value={metrics.totalQuizzesTaken} sub={`Avg: ${metrics.avgQuizScore}%`} helpContent={HELP_TOOLTIPS.analytics.avgQuizScore} />
          <MetricCard icon={Zap} label="Total XP Earned" value={metrics.totalXpEarned} />
          <MetricCard icon={Users} label="Active Learners" value={metrics.activeLearners} helpContent={HELP_TOOLTIPS.analytics.activeUsers} />
        </div>

        {/* Module Engagement Chart */}
        {chartData.length > 0 && (
          <Card className="bg-card/50 border-border/50" data-tour="analytics-chart">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Module Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="reads" fill="hsl(var(--primary))" name="Sections Read" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="quizzes" fill="hsl(var(--primary) / 0.5)" name="Quizzes" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cohort Analytics & Bottleneck Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CohortScatterChart
            data={[
              { userId: "1", userName: "Learner A", completionTimeDays: 4, avgQuizScore: 92, xpEarned: 450 },
              { userId: "2", userName: "Learner B", completionTimeDays: 7, avgQuizScore: 88, xpEarned: 380 },
              { userId: "3", userName: "Learner C", completionTimeDays: 12, avgQuizScore: 75, xpEarned: 290 },
              { userId: "4", userName: "Learner D", completionTimeDays: 5, avgQuizScore: 95, xpEarned: 510 },
            ]}
          />

          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" /> Bottleneck Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-foreground">Module 4: Database Architecture</span>
                    <Badge variant="outline" className="text-[10px] text-orange-400 border-orange-500/30">High Friction</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Users spend 40% more time here than average. Quiz failure rate: 35%.
                  </p>
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 42m avg</span>
                    <span className="flex items-center gap-1"><Target className="w-3 h-3" /> 1.8 attempts</span>
                  </div>
                </div>

                <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-foreground">Module 2: CI/CD Pipeline</span>
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Stable</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    High engagement. 90% first-pass quiz rate.
                  </p>
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 15m avg</span>
                    <span className="flex items-center gap-1"><Target className="w-3 h-3" /> 1.1 attempts</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard */}
        <Card className="bg-card/50 border-border/50" data-tour="analytics-leaderboard">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" /> Leaderboard
              <HelpTooltip content={HELP_TOOLTIPS.gamification.leaderboard} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No XP activity yet.</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div key={entry.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {i < 3 ? (
                        <Award className={`w-4 h-4 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-400" : "text-amber-600"}`} />
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{entry.displayName}</p>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      {entry.xp} XP
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
