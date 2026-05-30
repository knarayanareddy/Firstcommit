import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRole } from "@/hooks/useRole";
import { useQuizAnalytics, QuestionStat, Recommendation } from "@/hooks/useQuizAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart3, Target, Clock, AlertTriangle, ChevronDown, ChevronUp,
  Lightbulb, ThumbsUp, ThumbsDown, HelpCircle, TrendingUp,
} from "lucide-react";
import { Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

function MetricCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function AnswerDistributionChart({ stats }: { stats: QuestionStat }) {
  const data = stats.answerDistribution.map((d) => ({
    name: d.choiceText.length > 30 ? d.choiceText.slice(0, 28) + "…" : d.choiceText,
    count: d.count,
    pct: stats.totalAnswers > 0 ? Math.round((d.count / stats.totalAnswers) * 100) : 0,
    isCorrect: d.isCorrect,
  }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={120} className="fill-muted-foreground" />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            formatter={(value: number, _name: string, props: any) => [`${value} (${props.payload.pct}%)`, "Responses"]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.isCorrect ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function QuestionDetailPanel({ stats }: { stats: QuestionStat }) {
  const totalFb = Object.values(stats.feedbackCounts).reduce((s, c) => s + c, 0);
  const topWrong = stats.answerDistribution
    .filter((d) => !d.isCorrect)
    .sort((a, b) => b.count - a.count)[0];

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="p-4 border-t border-border/50 space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Answer Distribution</p>
          <AnswerDistributionChart stats={stats} />
        </div>

        {/* Insights */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Insights</p>
          {stats.correctRate < 40 && stats.totalAnswers >= 3 && (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{100 - stats.correctRate}% of learners chose the wrong answer</span>
            </div>
          )}
          {topWrong && topWrong.count > 0 && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Target className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Most common wrong answer: "{topWrong.choiceText.slice(0, 50)}" ({topWrong.count} picks)</span>
            </div>
          )}
          {stats.avgTimeSeconds > 30 && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Average time: {stats.avgTimeSeconds}s (longest in this quiz)</span>
            </div>
          )}
        </div>

        {/* Feedback */}
        {totalFb > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Learner Feedback ({totalFb})</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.feedbackCounts).map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-xs gap-1">
                  {type === "fair" && <ThumbsUp className="w-3 h-3" />}
                  {type === "unfair" && <ThumbsDown className="w-3 h-3" />}
                  {type === "confusing" && <HelpCircle className="w-3 h-3" />}
                  {type} × {count}
                </Badge>
              ))}
            </div>
            {stats.feedbackComments.length > 0 && (
              <div className="space-y-1 mt-1">
                {stats.feedbackComments.slice(0, 3).map((fc, i) => (
                  <p key={i} className="text-xs text-muted-foreground italic">"{fc.comment}"</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function QuizAnalyticsPage() {
  const { hasPackPermission } = useRole();
  const { overview, overviewLoading, moduleStats, moduleStatsLoading, fetchQuestionStats, computeRecommendations } = useQuizAnalytics();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const questionStatsQuery = fetchQuestionStats(expandedModule || "");
  const questionStats = questionStatsQuery.data || [];

  const recommendations = useMemo(() => {
    if (!moduleStats.length) return [];
    const qsMap = new Map<string, QuestionStat[]>();
    if (expandedModule && questionStats.length) {
      qsMap.set(expandedModule, questionStats);
    }
    return computeRecommendations(moduleStats, qsMap);
  }, [moduleStats, expandedModule, questionStats, computeRecommendations]);

  if (!hasPackPermission("author")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Author access required to view quiz analytics.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (overviewLoading || moduleStatsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} data-tour="quiz-analytics-header">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Quiz Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Question performance, answer patterns & learner feedback</p>
        </motion.div>

        {/* Overview */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-tour="quiz-score-distribution">
            <MetricCard icon={Target} label="Total Attempts" value={overview.totalAttempts} />
            <MetricCard icon={TrendingUp} label="Avg Score" value={`${overview.avgScore}%`} />
            <MetricCard icon={Target} label="Pass Rate (≥70%)" value={`${overview.passRate}%`} />
            <MetricCard icon={Target} label="Perfect Scores" value={`${overview.perfectScores}%`} />
            <MetricCard icon={Target} label="1st-Try Pass" value={`${overview.firstTryPassRate}%`} />
            <MetricCard icon={Clock} label="Modules" value={moduleStats.length} />
          </div>
        )}

        {/* Per-Module Table */}
        <Card className="bg-card/50 border-border/50" data-tour="quiz-module-breakdown">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Per-Module Quiz Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {moduleStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No quiz data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-right">Avg Score</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead className="text-right">Pass Rate</TableHead>
                    <TableHead className="text-right">Learners</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moduleStats.map((ms) => (
                    <TableRow
                      key={ms.moduleKey}
                      className="cursor-pointer"
                      onClick={() => {
                        setExpandedModule(expandedModule === ms.moduleKey ? null : ms.moduleKey);
                        setExpandedQuestion(null);
                      }}
                    >
                      <TableCell className="font-medium">
                        {ms.moduleTitle}
                        {ms.avgScore < 60 && <Badge variant="destructive" className="ml-2 text-[10px]">⚠️ Low</Badge>}
                      </TableCell>
                      <TableCell className="text-right">{ms.avgScore}%</TableCell>
                      <TableCell className="text-right">{ms.totalAttempts}</TableCell>
                      <TableCell className="text-right">
                        {ms.passRate}%
                        {ms.passRate < 50 && <span className="text-destructive ml-1">⚠️</span>}
                      </TableCell>
                      <TableCell className="text-right">{ms.uniqueLearners}</TableCell>
                      <TableCell className="w-8">
                        {expandedModule === ms.moduleKey ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>

          {/* Expanded question table */}
          <AnimatePresence>
            {expandedModule && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CardContent className="pt-0">
                  <div className="border border-border/50 rounded-lg overflow-hidden">
                    <div className="bg-muted/30 px-4 py-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Question Performance — {moduleStats.find((m) => m.moduleKey === expandedModule)?.moduleTitle}
                      </p>
                    </div>
                    {questionStatsQuery.isLoading ? (
                      <div className="p-6 text-center"><div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow mx-auto" /></div>
                    ) : questionStats.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No per-question data yet.</p>
                    ) : (
                      <div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">Q</TableHead>
                              <TableHead>Topic</TableHead>
                              <TableHead className="text-right">Correct%</TableHead>
                              <TableHead className="text-right">Avg Time</TableHead>
                              <TableHead className="text-right">Answers</TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {questionStats.map((qs, i) => (
                              <Fragment key={qs.questionId}>
                                <TableRow
                                  key={qs.questionId}
                                  className="cursor-pointer"
                                  onClick={() => setExpandedQuestion(expandedQuestion === qs.questionId ? null : qs.questionId)}
                                >
                                  <TableCell className="font-mono text-xs">Q{i + 1}</TableCell>
                                  <TableCell className="text-sm max-w-xs truncate">
                                    {qs.prompt.slice(0, 60)}{qs.prompt.length > 60 ? "…" : ""}
                                    {qs.correctRate < 40 && qs.totalAnswers >= 3 && <span className="text-destructive ml-1">🔴</span>}
                                  </TableCell>
                                  <TableCell className="text-right">{qs.correctRate}%</TableCell>
                                  <TableCell className="text-right">
                                    {qs.avgTimeSeconds}s
                                    {qs.avgTimeSeconds > 30 && <span className="text-muted-foreground ml-1">⏱</span>}
                                  </TableCell>
                                  <TableCell className="text-right">{qs.totalAnswers}</TableCell>
                                  <TableCell className="w-8">
                                    {expandedQuestion === qs.questionId ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </TableCell>
                                </TableRow>
                                {expandedQuestion === qs.questionId && (
                                  <TableRow key={`${qs.questionId}-detail`}>
                                    <TableCell colSpan={6} className="p-0">
                                      <QuestionDetailPanel stats={qs} />
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" /> Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.slice(0, 8).map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    rec.type === "hard" ? "bg-destructive/10 text-destructive" :
                    rec.type === "easy" ? "bg-primary/10 text-primary" :
                    rec.type === "slow" ? "bg-accent/30 text-accent-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {rec.type === "hard" ? <AlertTriangle className="w-3 h-3" /> :
                     rec.type === "easy" ? <TrendingUp className="w-3 h-3" /> :
                     rec.type === "slow" ? <Clock className="w-3 h-3" /> :
                     <Lightbulb className="w-3 h-3" />}
                  </div>
                  <div>
                    <Badge variant="outline" className="text-[10px] mb-1">{rec.type}</Badge>
                    <p className="text-sm text-muted-foreground">{rec.message}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
