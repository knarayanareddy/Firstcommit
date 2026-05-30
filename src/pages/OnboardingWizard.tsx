import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Building2, Package, Users, CheckCircle2, ArrowRight, ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, HelpCircle, ExternalLink } from "lucide-react";

const STORAGE_KEY = "rocketboard_onboarding_step";
const STORAGE_ORG_KEY = "rocketboard_onboarding_org";
const STORAGE_PACK_KEY = "rocketboard_onboarding_pack";

interface InviteEntry {
  email: string;
  accessLevel: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

const stepsMeta = [
  { label: "Welcome", icon: Rocket },
  { label: "Organization", icon: Building2 },
  { label: "First Pack", icon: Package },
  { label: "Invite Team", icon: Users },
  { label: "Done", icon: CheckCircle2 },
];

export default function OnboardingWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Math.min(parseInt(saved, 10), 4) : 0;
  });

  // Org state
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [existingOrgDetected, setExistingOrgDetected] = useState(false);

  // Pack state
  const [packTitle, setPackTitle] = useState("");
  const [packDesc, setPackDesc] = useState("");
  const [langMode, setLangMode] = useState("english");
  const [packId, setPackId] = useState<string | null>(() => localStorage.getItem(STORAGE_PACK_KEY));

  // Invites
  const [invites, setInvites] = useState<InviteEntry[]>([{ email: "", accessLevel: "learner" }]);
  const [loading, setLoading] = useState(false);

  // Check if user already has an org — if so, skip org creation step
  useEffect(() => {
    if (!user) return;
    const checkExistingOrg = async () => {
      const { data } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1);
      if (data && data.length > 0) {
        const detectedOrgId = data[0].org_id;
        setOrgId(detectedOrgId);
        localStorage.setItem(STORAGE_ORG_KEY, detectedOrgId);
        setExistingOrgDetected(true);
        // If on welcome or org creation step, jump to pack creation
        if (step <= 1) {
          setStep(2);
        }
      } else {
        // No org found — clear any stale localStorage and reset to org creation
        localStorage.removeItem(STORAGE_ORG_KEY);
        localStorage.removeItem(STORAGE_PACK_KEY);
        setOrgId(null);
        if (step > 1) {
          setStep(0);
        }
      }
    };
    checkExistingOrg();
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(step));
  }, [step]);

  useEffect(() => {
    setOrgSlug(slugify(orgName));
  }, [orgName]);

  const next = () => setStep((s) => Math.min(s + 1, 4));
  // Don't allow going back to org creation if org already exists
  const prev = () => setStep((s) => {
    const minStep = existingOrgDetected ? 2 : 0;
    return Math.max(s - 1, minStep);
  });

  const handleCreateOrg = async () => {
    if (!user || !orgName.trim()) return;
    setLoading(true);
    try {
      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .insert({ name: orgName.trim(), slug: orgSlug || slugify(orgName) })
        .select()
        .single();
      if (orgErr) throw orgErr;

      const { error: memErr } = await supabase
        .from("org_members")
        .insert({ org_id: org.id, user_id: user.id, role: "owner" });
      if (memErr) throw memErr;

      setOrgId(org.id);
      localStorage.setItem(STORAGE_ORG_KEY, org.id);
      next();
    } catch (err: any) {
      if (err.code === "23505" && err.message.includes("organizations_slug_key")) {
        toast.error("This slug is already taken. Please try a different one.");
      } else {
        toast.error(err.message || "Failed to create organization");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePack = async () => {
    if (!user || !orgId || !packTitle.trim()) return;
    setLoading(true);
    try {
      const newPackId = crypto.randomUUID();
      const { error: packErr } = await supabase
        .from("packs")
        .insert({
          id: newPackId,
          title: packTitle.trim(),
          description: packDesc.trim() || null,
          org_id: orgId,
          language_mode: langMode,
          created_by: user.id,
        });
      if (packErr) throw packErr;

      const { error: memErr } = await supabase
        .from("pack_members")
        .insert({ pack_id: newPackId, user_id: user.id, access_level: "owner" });
      if (memErr) throw memErr;

      setPackId(newPackId);
      localStorage.setItem(STORAGE_PACK_KEY, newPackId);
      next();
    } catch (err: any) {
      toast.error(err.message || "Failed to create pack");
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvites = async () => {
    if (!packId || !user) return;
    const validInvites = invites.filter((i) => i.email.trim());
    if (validInvites.length === 0) {
      next();
      return;
    }
    setLoading(true);
    try {
      for (const inv of validInvites) {
        // Try to find existing user by checking profiles
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .ilike("display_name", inv.email.trim());

        if (profiles && profiles.length > 0) {
          // User exists, add directly
          await supabase.from("pack_members").insert({
            pack_id: packId,
            user_id: profiles[0].user_id,
            access_level: inv.accessLevel,
          });
        } else {
          // Store as pending invite
          await supabase.from("pending_invites").upsert({
            pack_id: packId,
            email: inv.email.trim().toLowerCase(),
            access_level: inv.accessLevel,
            invited_by: user.id,
          }, { onConflict: "pack_id,email" });
        }
      }
      toast.success(`${validInvites.length} invite(s) sent`);
      next();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invites");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    // Clear onboarding state
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_ORG_KEY);
    localStorage.removeItem(STORAGE_PACK_KEY);
    if (packId) {
      localStorage.setItem("rocketboard_current_pack", packId);
      navigate(`/packs/${packId}/sources`);
    } else {
      navigate("/packs");
    }
  };

  const addInviteRow = () => setInvites([...invites, { email: "", accessLevel: "learner" }]);
  const removeInviteRow = (idx: number) => setInvites(invites.filter((_, i) => i !== idx));
  const updateInvite = (idx: number, field: keyof InviteEntry, value: string) => {
    setInvites(invites.map((inv, i) => (i === idx ? { ...inv, [field]: value } : inv)));
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background dark p-4">
      {/* Progress stepper */}
      <div className="flex items-center gap-2 mb-8">
        {stepsMeta.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`w-8 h-px ${isDone ? "bg-primary" : "bg-border"}`} />
              )}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  isActive
                    ? "gradient-primary text-primary-foreground"
                    : isDone
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait" custom={1}>
          {step === 0 && (
            <motion.div
              key="welcome"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-card border border-border rounded-xl p-8 text-center"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -5, 0] }}
                transition={{ duration: 1.5, delay: 0.3, ease: "easeInOut" }}
                className="inline-flex mb-4"
              >
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center">
                  <Rocket className="w-8 h-8 text-primary-foreground" />
                </div>
              </motion.div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Welcome to <span className="gradient-text">RocketBoard</span>!
              </h1>
              <p className="text-muted-foreground mb-6">
                Let's set up your onboarding workspace in about 2 minutes.
              </p>
              <Button onClick={next} className="gradient-primary text-primary-foreground border-0 gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="org"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-card border border-border rounded-xl p-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Create Organization</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                What's your team or company called?
              </p>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-foreground">Organization Name</label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p className="w-64 text-xs">
                            This is your primary workspace top-level entity (e.g., your company or department name).
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g., Acme Engineering"
                    maxLength={100}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-foreground">Slug</label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p className="w-64 text-xs">
                            The unique identifier used in your organization's URL. Must be lowercase, numbers, and hyphens only.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                    placeholder="acme-engineering"
                    className="font-mono text-sm"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Auto-generated from name</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-lg">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-primary" />
                  <span>Confused? Check our <a href="/help/gs-1" target="_blank" className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">Getting Started guide <ExternalLink className="w-2.5 h-2.5" /></a></span>
                </p>
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="ghost" onClick={prev} className="gap-1">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Button
                  onClick={handleCreateOrg}
                  disabled={!orgName.trim() || loading}
                  className="gradient-primary text-primary-foreground border-0 gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="pack"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-card border border-border rounded-xl p-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Create Your First Pack</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                A Pack is a collection of onboarding content for your team. You can have multiple packs for different teams or projects.
              </p>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-foreground">Pack Title</label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p className="w-64 text-xs">
                            A Pack is a curated learning context (e.g., 'React Frontend Onboarding' or 'SRE Handbook').
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    value={packTitle}
                    onChange={(e) => setPackTitle(e.target.value)}
                    placeholder="e.g., Backend Services Onboarding"
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Description (optional)</label>
                  <Textarea
                    value={packDesc}
                    onChange={(e) => setPackDesc(e.target.value)}
                    placeholder="Everything a new backend engineer needs to know..."
                    rows={3}
                    maxLength={500}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Language Mode</label>
                  <Select value={langMode} onValueChange={setLangMode}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English Only</SelectItem>
                      <SelectItem value="multilingual">Multilingual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="ghost" onClick={prev} className="gap-1">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Button
                  onClick={handleCreatePack}
                  disabled={!packTitle.trim() || loading}
                  className="gradient-primary text-primary-foreground border-0 gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Pack <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="invite"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-card border border-border rounded-xl p-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Invite Team</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Invite your team members. You can always do this later.
              </p>

              <div className="space-y-3">
                {invites.map((inv, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="email@company.com"
                      value={inv.email}
                      onChange={(e) => updateInvite(idx, "email", e.target.value)}
                      className="flex-1"
                      maxLength={255}
                    />
                    <Select value={inv.accessLevel} onValueChange={(v) => updateInvite(idx, "accessLevel", v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="author">Author</SelectItem>
                        <SelectItem value="learner">Learner</SelectItem>
                        <SelectItem value="read_only">Read Only</SelectItem>
                      </SelectContent>
                    </Select>
                    {invites.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeInviteRow(idx)} className="shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addInviteRow} className="gap-1">
                  <Plus className="w-3 h-3" /> Add Another
                </Button>
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="ghost" onClick={() => { next(); }} className="text-muted-foreground">
                  Skip for Now
                </Button>
                <Button
                  onClick={handleSendInvites}
                  disabled={loading}
                  className="gradient-primary text-primary-foreground border-0 gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send Invites <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="done"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-card border border-border rounded-xl p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="inline-flex mb-4"
              >
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
              </motion.div>
              <h1 className="text-2xl font-bold text-foreground mb-2">You're all set! 🎉</h1>
              <p className="text-muted-foreground mb-6">
                Next step: connect your source code repos and documents so we can generate your onboarding content.
              </p>
              <Button onClick={handleFinish} className="gradient-primary text-primary-foreground border-0 gap-2">
                Go to Sources <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        Step {step + 1} of {stepsMeta.length}
      </p>

      {/* Persistent Help Access */}
      <div className="fixed bottom-6 right-6">
        <Button
          variant="secondary"
          size="sm"
          className="rounded-full shadow-lg border border-border gap-2"
          onClick={() => window.open("/help", "_blank")}
        >
          <HelpCircle className="w-4 h-4" />
          Need Help?
        </Button>
      </div>
    </div>
  );
}
