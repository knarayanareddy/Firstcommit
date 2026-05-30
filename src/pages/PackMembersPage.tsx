import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole, PackAccessLevel } from "@/hooks/useRole";
import { usePendingInvites } from "@/hooks/usePendingInvites";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedAction } from "@/components/ProtectedAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Users, UserPlus, Shield, Trash2, Crown, ShieldCheck, Pen, BookOpen, Eye, Clock, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP_TOOLTIPS } from "@/data/help-tooltips";

const ACCESS_LEVELS: { value: PackAccessLevel; label: string; icon: typeof Crown }[] = [
  { value: "owner", label: "Owner", icon: Crown },
  { value: "admin", label: "Admin", icon: ShieldCheck },
  { value: "author", label: "Author", icon: Pen },
  { value: "learner", label: "Learner", icon: BookOpen },
  { value: "read_only", label: "Read Only", icon: Eye },
];

export default function PackMembersPage() {
  const { packId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPackPermission } = useRole();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLevel, setInviteLevel] = useState<PackAccessLevel>("learner");

  const { invites: pendingInvites, sendInvite, deleteInvite } = usePendingInvites(packId);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["pack_members_list", packId],
    queryFn: async () => {
      if (!packId) return [];
      const { data, error } = await supabase
        .from("pack_members")
        .select("*")
        .eq("pack_id", packId)
        .order("joined_at", { ascending: true });
      if (error) throw error;

      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      return data.map((m) => ({
        ...m,
        display_name: profiles?.find((p) => p.user_id === m.user_id)?.display_name ?? "Unknown",
      }));
    },
    enabled: !!packId,
  });

  const { data: pack } = useQuery({
    queryKey: ["pack_detail", packId],
    queryFn: async () => {
      if (!packId) return null;
      const { data, error } = await supabase
        .from("packs")
        .select("*")
        .eq("id", packId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!packId,
  });

  const updateAccessLevel = useMutation({
    mutationFn: async ({ memberId, accessLevel }: { memberId: string; accessLevel: PackAccessLevel }) => {
      const { error } = await supabase
        .from("pack_members")
        .update({ access_level: accessLevel })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pack_members_list", packId] });
      toast.success("Access level updated");
    },
    onError: () => toast.error("Failed to update access level"),
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("pack_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pack_members_list", packId] });
      toast.success("Member removed");
    },
    onError: () => toast.error("Failed to remove member"),
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    sendInvite.mutate(
      { email: inviteEmail.trim(), accessLevel: inviteLevel },
      {
        onSuccess: (result) => {
          setInviteEmail("");
          toast.success(result.status === "added" ? "Member added!" : "Invite sent (pending signup)");
        },
        onError: (err: any) => toast.error(err.message || "Failed to invite"),
      }
    );
  };

  if (!hasPackPermission("admin")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          You don't have permission to manage members.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => navigate(`/packs/${packId}`)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="flex items-center gap-3 mb-6" data-tour="members-header">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Manage Members</h1>
              {pack && <p className="text-sm text-muted-foreground">{pack.title}</p>}
            </div>
          </div>

          {/* Invite Form */}
          <ProtectedAction requiredLevel="admin">
            <div className="bg-card border border-border rounded-xl p-5 mb-6" data-tour="invite-form">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-foreground">Invite by Email</h2>
                <HelpTooltip content={HELP_TOOLTIPS.members.emailInvite} />
              </div>
              <div className="flex gap-3">
                <Input
                  type="email"
                  placeholder="email@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                  maxLength={255}
                />
                <Select value={inviteLevel} onValueChange={(v) => setInviteLevel(v as PackAccessLevel)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_LEVELS.filter((l) => l.value !== "owner").map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || sendInvite.isPending}
                >
                  Invite
                </Button>
              </div>
            </div>
          </ProtectedAction>

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Pending Invites ({pendingInvites.length})</h2>
              </div>
              <div className="divide-y divide-border">
                {pendingInvites.filter((i: any) => !i.accepted_at).map((invite: any) => (
                  <div key={invite.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{invite.email}</p>
                        <p className="text-xs text-muted-foreground capitalize">{invite.access_level} • Pending</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteInvite.mutate(invite.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="bg-card border border-border rounded-xl overflow-hidden" data-tour="members-table">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Members ({members.length})</h2>
              <HelpTooltip content={HELP_TOOLTIPS.members.accessLevels} title="Access Levels" />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No members yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {members.map((member) => {
                  const levelInfo = ACCESS_LEVELS.find((l) => l.value === member.access_level) ?? ACCESS_LEVELS[3];
                  const LevelIcon = levelInfo.icon;
                  const isCurrentUser = member.user_id === user?.id;

                  return (
                    <div key={member.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <LevelIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {member.display_name}
                            {isCurrentUser && (
                              <span className="text-xs text-muted-foreground ml-2">(you)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">{levelInfo.label}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <ProtectedAction requiredLevel="admin">
                          <Select
                            value={member.access_level}
                            onValueChange={(v) =>
                              updateAccessLevel.mutate({ memberId: member.id, accessLevel: v as PackAccessLevel })
                            }
                            disabled={isCurrentUser}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACCESS_LEVELS.map((l) => (
                                <SelectItem key={l.value} value={l.value}>
                                  {l.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </ProtectedAction>

                        <ProtectedAction requiredLevel="admin">
                          {!isCurrentUser && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeMember.mutate(member.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </ProtectedAction>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
