import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTeamDirectory, TeamMember } from "@/hooks/useTeamDirectory";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Plus, Search, CheckCircle2, Circle, Mail, Github, MessageSquare, Trash2, Pencil, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP_TOOLTIPS } from "@/data/help-tooltips";

export default function TeamPage() {
  const { members, membersLoading, addTeamMember, updateTeamMember, deleteTeamMember, toggleMet, isMet, metCount, totalMembers } = useTeamDirectory();
  const { hasPackPermission } = useRole();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formExpertise, setFormExpertise] = useState("");
  const [formServices, setFormServices] = useState("");
  const [formSlack, setFormSlack] = useState("");
  const [formGithub, setFormGithub] = useState("");

  const filtered = useMemo(() =>
    members.filter(m =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role_title?.toLowerCase().includes(search.toLowerCase()) ||
      m.areas_of_expertise.some(a => a.toLowerCase().includes(search.toLowerCase())) ||
      m.services_owned.some(s => s.toLowerCase().includes(search.toLowerCase()))
    ),
    [members, search]
  );

  const resetForm = () => {
    setFormName(""); setFormEmail(""); setFormRole(""); setFormBio("");
    setFormExpertise(""); setFormServices(""); setFormSlack(""); setFormGithub("");
  };

  const openEdit = (m: TeamMember) => {
    setEditMember(m);
    setFormName(m.name);
    setFormEmail(m.email ?? "");
    setFormRole(m.role_title ?? "");
    setFormBio(m.bio ?? "");
    setFormExpertise(m.areas_of_expertise.join(", "));
    setFormServices(m.services_owned.join(", "));
    setFormSlack(m.slack_handle ?? "");
    setFormGithub(m.github_handle ?? "");
    setAddOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: formName.trim(),
      email: formEmail.trim() || null,
      role_title: formRole.trim() || null,
      bio: formBio.trim() || null,
      areas_of_expertise: formExpertise.split(",").map(s => s.trim()).filter(Boolean),
      services_owned: formServices.split(",").map(s => s.trim()).filter(Boolean),
      slack_handle: formSlack.trim() || null,
      github_handle: formGithub.trim() || null,
    };
    if (editMember) {
      updateTeamMember.mutate({ id: editMember.id, ...payload } as any, {
        onSuccess: () => { toast.success("Updated"); setAddOpen(false); resetForm(); setEditMember(null); },
      });
    } else {
      addTeamMember.mutate(payload as any, {
        onSuccess: () => { toast.success("Team member added"); setAddOpen(false); resetForm(); },
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" /> Team Directory
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5" data-tour="meeting-progress">
              People to meet: {metCount}/{totalMembers}
              <HelpTooltip content={HELP_TOOLTIPS.team.meetingProgress} />
            </p>
          </div>
          {hasPackPermission("author") && (
            <Button size="sm" onClick={() => { resetForm(); setEditMember(null); setAddOpen(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Add Member
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, role, expertise, or service..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div data-tour="team-member">
        {membersLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading team...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {members.length === 0 ? "No team members added yet." : "No results found."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((m, i) => {
              const met = isMet(m.id);
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`bg-card border rounded-xl p-5 transition-all ${met ? "border-primary/30" : "border-border"}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-card-foreground text-sm">{m.name}</h3>
                        {m.role_title && <p className="text-xs text-muted-foreground">{m.role_title}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {hasPackPermission("author") && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(m)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteTeamMember.mutate(m.id, { onSuccess: () => toast.success("Removed") })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {m.bio && <p className="text-xs text-muted-foreground mt-2">{m.bio}</p>}

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {m.areas_of_expertise.map(a => (
                      <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>
                    ))}
                    {m.services_owned.map(s => (
                      <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    {m.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {m.email}</span>}
                    {m.slack_handle && <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {m.slack_handle}</span>}
                    {m.github_handle && <span className="flex items-center gap-1"><Github className="w-3 h-3" /> {m.github_handle}</span>}
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/50" data-tour="meeting-checkbox">
                    <Button
                      variant={met ? "default" : "outline"}
                      size="sm"
                      className="w-full gap-2 text-xs"
                      onClick={() => toggleMet.mutate({ teamMemberId: m.id })}
                    >
                      {met ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                      {met ? "Met ✓" : "Mark as Met"}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editMember ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name *" value={formName} onChange={e => setFormName(e.target.value)} />
              <Input placeholder="Role / Title" value={formRole} onChange={e => setFormRole(e.target.value)} />
              <Input placeholder="Email" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
              <Input placeholder="Slack handle" value={formSlack} onChange={e => setFormSlack(e.target.value)} />
              <Input placeholder="GitHub handle" value={formGithub} onChange={e => setFormGithub(e.target.value)} />
              <Input placeholder="Areas of expertise (comma-separated)" value={formExpertise} onChange={e => setFormExpertise(e.target.value)} />
              <Input placeholder="Services owned (comma-separated)" value={formServices} onChange={e => setFormServices(e.target.value)} />
              <Textarea placeholder="Bio" value={formBio} onChange={e => setFormBio(e.target.value)} rows={3} />
              <Button onClick={handleSave} className="w-full" disabled={addTeamMember.isPending || updateTeamMember.isPending}>
                {editMember ? "Save Changes" : "Add Member"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
