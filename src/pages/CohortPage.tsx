import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCohort, CohortMemberProgress } from "@/hooks/useCohort";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, Flame, TrendingUp, Trophy, ArrowLeft, Plus, Calendar,
  Send, Trash2, UserPlus, AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";

const RANK_ICONS = ["🏅", "🥈", "🥉"];

export default function CohortPage() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const { hasPackPermission } = useRole();
  const navigate = useNavigate();
  const isAdmin = hasPackPermission("admin");

  const {
    cohorts, cohortsLoading,
    myCohort, myCohortLoading,
    cohortMembers, cohortMembersLoading,
    createCohort, deleteCohort, addMembers,
  } = useCohort();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [encourageTarget, setEncourageTarget] = useState<CohortMemberProgress | null>(null);
  const [encourageMsg, setEncourageMsg] = useState("");
  const [sendingEncourage, setSendingEncourage] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberCohortId, setAddMemberCohortId] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createCohort.mutate(
      { name: newName, description: newDesc || undefined, startDate: newStartDate || undefined, memberIds: [] },
      { onSuccess: () => { setCreateOpen(false); setNewName(""); setNewDesc(""); setNewStartDate(""); } }
    );
  };

  const handleEncourage = async () => {
    if (!encourageTarget || !user) return;
    setSendingEncourage(true);
    try {
      await supabase.from("notifications").insert({
        user_id: encourageTarget.user_id,
        title: "Encouragement from a peer 🎉",
        message: encourageMsg || `Keep it up! You're doing great on your learning journey.`,
        type: "encouragement",
        link: `/packs/${currentPackId}/cohort`,
      } as any);
      toast.success(`Encouragement sent to ${encourageTarget.display_name}!`);
      setEncourageTarget(null);
      setEncourageMsg("");
    } catch {
      toast.error("Failed to send encouragement");
    } finally {
      setSendingEncourage(false);
    }
  };

  const visibleMembers = cohortMembers
    .filter((m) => m.show_progress || m.user_id === user?.id)
    .sort((a, b) => b.progress_pct - a.progress_pct);

  const avgProgress = visibleMembers.length > 0
    ? Math.round(visibleMembers.reduce((s, m) => s + m.progress_pct, 0) / visibleMembers.length)
    : 0;

  const myProgress = visibleMembers.find((m) => m.user_id === user?.id)?.progress_pct ?? 0;

  const handleAddMemberByEmail = async () => {
    if (!addMemberEmail.trim() || !addMemberCohortId) return;
    setAddingMember(true);
    try {
      const { data, error } = await supabase.rpc("lookup_user_by_email", { _email: addMemberEmail.trim() });
      if (error) throw error;
      const rows = data as any[];
      if (!rows || rows.length === 0) {
        toast.error("No user found with that email");
        return;
      }
      const userId = rows[0].user_id;
      addMembers.mutate(
        { cohortId: addMemberCohortId, userIds: [userId] },
        {
          onSuccess: () => {
            setAddMemberEmail("");
            setAddMemberCohortId(null);
          },
        }
      );
    } catch {
      toast.error("Failed to look up user");
    } finally {
      setAddingMember(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">
              {myCohort ? myCohort.name : "Cohorts"}
            </h1>
          </div>

          {/* My Cohort View */}
          {!myCohortLoading && myCohort && (
            <>
              {/* Cohort meta */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    {myCohort.description && (
                      <p className="text-sm text-muted-foreground">{myCohort.description}</p>
                    )}
                    {myCohort.start_date && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Started {format(new Date(myCohort.start_date), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-3 h-3" />
                    {visibleMembers.length} members
                  </Badge>
                </div>

                {/* Group stats */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-foreground">{avgProgress}%</div>
                    <div className="text-xs text-muted-foreground">Cohort Avg</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-foreground">{myProgress}%</div>
                    <div className="text-xs text-muted-foreground">Your Progress</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className={`text-xl font-bold ${myProgress >= avgProgress ? "text-green-500" : "text-muted-foreground"}`}>
                      {myProgress >= avgProgress ? "📈 Above" : "📉 Below"}
                    </div>
                    <div className="text-xs text-muted-foreground">vs Average</div>
                  </div>
                </div>
              </div>

              {/* Member Leaderboard */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-card-foreground">Leaderboard</h2>
                </div>

                {cohortMembersLoading ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Loading members…</div>
                ) : (
                  <div className="space-y-3">
                    {visibleMembers.map((member, i) => {
                      const isMe = member.user_id === user?.id;
                      return (
                        <motion.div
                          key={member.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                            isMe ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/50"
                          }`}
                        >
                          <span className="w-6 text-center text-sm shrink-0">
                            {i < 3 ? RANK_ICONS[i] : <span className="text-muted-foreground text-xs">{i + 1}</span>}
                          </span>
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback className="text-xs bg-muted">
                              {(member.display_name ?? "L")[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isMe ? "text-primary" : "text-foreground"}`}>
                                {isMe ? "You" : member.display_name}
                              </span>
                              {member.streak_days > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-orange-500">
                                  <Flame className="w-3 h-3" /> {member.streak_days}d
                                </span>
                              )}
                            </div>
                            <Progress value={member.progress_pct} className="h-1.5 mt-1.5" />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-mono text-muted-foreground w-10 text-right">
                              {member.progress_pct}%
                            </span>
                            {!isMe && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => { setEncourageTarget(member); setEncourageMsg(""); }}
                              >
                                <Send className="w-3 h-3" /> Cheer
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* No cohort state for learners */}
          {!myCohortLoading && !myCohort && !isAdmin && (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium text-foreground mb-1">You're not in a cohort yet</h3>
              <p className="text-sm text-muted-foreground">Ask your admin to add you to a cohort to see peer progress.</p>
            </div>
          )}

          {/* Admin: All Cohorts */}
          {isAdmin && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-card-foreground">All Cohorts</h2>
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Create Cohort
                </Button>
              </div>

              {cohortsLoading ? (
                <div className="text-center py-4 text-muted-foreground text-sm">Loading…</div>
              ) : cohorts.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">No cohorts yet. Create one to group learners.</div>
              ) : (
                <div className="space-y-3">
                  {cohorts.map((c) => (
                    <div key={c.id} className="p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-sm text-foreground">{c.name}</span>
                          {c.start_date && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Started {format(new Date(c.start_date), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => setAddMemberCohortId(addMemberCohortId === c.id ? null : c.id)}
                          >
                            <UserPlus className="w-3 h-3" /> Add Member
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 h-7"
                            onClick={() => {
                              if (confirm(`Delete cohort "${c.name}"?`)) deleteCohort.mutate(c.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      {addMemberCohortId === c.id && (
                        <div className="flex items-center gap-2 pt-1">
                          <Input
                            placeholder="Enter member email…"
                            value={addMemberEmail}
                            onChange={(e) => setAddMemberEmail(e.target.value)}
                            className="h-8 text-sm"
                            onKeyDown={(e) => { if (e.key === "Enter") handleAddMemberByEmail(); }}
                          />
                          <Button
                            size="sm"
                            className="h-8 px-3"
                            onClick={handleAddMemberByEmail}
                            disabled={addingMember || !addMemberEmail.trim()}
                          >
                            {addingMember ? "Adding…" : "Add"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Create Cohort Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Cohort</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Name *</label>
              <Input placeholder="e.g. January 2025 Cohort" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
              <Textarea placeholder="Optional description…" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Start Date</label>
              <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newName.trim() || createCohort.isPending}>
                {createCohort.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Encourage Dialog */}
      <Dialog open={!!encourageTarget} onOpenChange={(o) => { if (!o) setEncourageTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Encouragement 🎉</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Send a motivational message to <span className="font-medium text-foreground">{encourageTarget?.display_name}</span>.
            </p>
            <Textarea
              placeholder={`Keep it up, ${encourageTarget?.display_name}! You're doing great!`}
              value={encourageMsg}
              onChange={(e) => setEncourageMsg(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEncourageTarget(null)}>Cancel</Button>
              <Button onClick={handleEncourage} disabled={sendingEncourage} className="gap-1.5">
                <Send className="w-3.5 h-3.5" /> Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
