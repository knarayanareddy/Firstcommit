import { useCohort, CohortMemberProgress } from "@/hooks/useCohort";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useNavigate } from "react-router-dom";
import { Users, Flame, Trophy, TrendingUp, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

const RANK_ICONS = ["🏅", "🥈", "🥉"];

export function CohortWidget() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const { myCohort, cohortMembers, myCohortLoading, cohortMembersLoading } = useCohort();
  const navigate = useNavigate();

  if (myCohortLoading || cohortMembersLoading) return null;
  if (!myCohort) return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold text-card-foreground">Peer Learning</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Join a cohort to see how your peers are progressing and stay motivated together.
      </p>
      <button
        onClick={() => navigate(`/packs/${currentPackId}/cohort`)}
        className="text-xs text-primary hover:underline flex items-center gap-1"
      >
        View Cohorts <ChevronRight className="w-3 h-3" />
      </button>
    </motion.div>
  );

  // Filter members with privacy enabled, sort by progress
  const visibleMembers = cohortMembers
    .filter((m) => m.show_progress || m.user_id === user?.id)
    .sort((a, b) => b.progress_pct - a.progress_pct);

  const myIndex = visibleMembers.findIndex((m) => m.user_id === user?.id);
  const avgProgress = visibleMembers.length > 0
    ? Math.round(visibleMembers.reduce((sum, m) => sum + m.progress_pct, 0) / visibleMembers.length)
    : 0;
  const myProgress = visibleMembers.find((m) => m.user_id === user?.id)?.progress_pct ?? 0;
  const aboveAvg = myProgress > avgProgress;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-card-foreground">
            Your Cohort: {myCohort.name}
          </h3>
          <span className="text-xs text-muted-foreground">({visibleMembers.length} peers)</span>
        </div>
      </div>

      <div className="space-y-3">
        {visibleMembers.slice(0, 5).map((member, i) => {
          const isMe = member.user_id === user?.id;
          return (
            <div
              key={member.id}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                isMe ? "bg-primary/5 border border-primary/20" : ""
              }`}
            >
              <span className="w-5 text-center text-sm">
                {i < 3 ? RANK_ICONS[i] : ""}
              </span>
              <Avatar className="h-7 w-7">
                <AvatarImage src={member.avatar_url} />
                <AvatarFallback className="text-xs bg-muted">
                  {(member.display_name ?? "L")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm truncate ${isMe ? "font-medium text-primary" : "text-foreground"}`}>
                    {isMe ? "You" : member.display_name}
                  </span>
                  {member.streak_days > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-orange-500">
                      <Flame className="w-3 h-3" />
                      {member.streak_days}
                    </span>
                  )}
                </div>
                <Progress value={member.progress_pct} className="h-1.5 mt-1" />
              </div>
              <span className="text-sm font-mono text-muted-foreground w-10 text-right">
                {member.progress_pct}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          <span>Cohort avg: <span className="font-medium text-foreground">{avgProgress}%</span></span>
          {aboveAvg && (
            <span className="ml-2 text-green-500 flex items-center gap-1 inline-flex">
              <TrendingUp className="w-3 h-3" /> You're above average!
            </span>
          )}
        </div>
        <button
          onClick={() => navigate(`/packs/${currentPackId}/cohort`)}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View Details <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}
