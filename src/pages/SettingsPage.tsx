import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Trash2, User, Layers, BookText, GraduationCap, Globe, GitBranch, Settings2, ShieldCheck, CheckCircle2, AlertTriangle, Palette, Info, Users, Eye, EyeOff, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAudiencePrefs, GlossaryDensity, ExperienceLevel, LearningStyle, TonePreference } from "@/hooks/useAudiencePrefs";
import { useGenerationPrefs, TargetReadingLevel } from "@/hooks/useGenerationPrefs";
import { usePeerVisibility } from "@/hooks/usePeerVisibility";
import { usePack } from "@/hooks/usePack";
import type { Audience, Depth } from "@/data/onboarding-data";
import { useState, useMemo } from "react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AIModelProviderSection } from "@/components/AIModelProviderSection";
import { SlackSettingsSection } from "@/components/SlackSettingsSection";
import { useRole } from "@/hooks/useRole";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP_TOOLTIPS } from "@/data/help-tooltips";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AUDIENCE_OPTIONS: { key: Audience; label: string; desc: string }[] = [
  { key: "technical", label: "Technical", desc: "Detailed, code-oriented content" },
  { key: "non_technical", label: "Non-Technical", desc: "Business-focused, simpler language" },
  { key: "mixed", label: "Mixed", desc: "Balanced for all audiences" },
];

const DEPTH_OPTIONS: { key: Depth; label: string; desc: string }[] = [
  { key: "shallow", label: "Shallow", desc: "Quick overview, key points only" },
  { key: "standard", label: "Standard", desc: "Balanced detail for most learners" },
  { key: "deep", label: "Deep", desc: "In-depth with implementation details" },
];

const GLOSSARY_DENSITY_OPTIONS: { key: GlossaryDensity; label: string; desc: string }[] = [
  { key: "low", label: "Low", desc: "Only essential/critical terms" },
  { key: "standard", label: "Standard", desc: "Common terms most engineers need" },
  { key: "high", label: "High", desc: "Comprehensive, includes niche terms" },
];

const EXPERIENCE_OPTIONS: { key: ExperienceLevel; label: string; desc: string }[] = [
  { key: "new", label: "New (< 1 year)", desc: "Just starting out, need extra guidance" },
  { key: "mid", label: "Mid (1-5 years)", desc: "Some experience, familiar with basics" },
  { key: "senior", label: "Senior (5+ years)", desc: "Experienced, focus on architecture & patterns" },
];

const LEARNING_STYLE_OPTIONS: { key: LearningStyle; label: string; desc: string }[] = [
  { key: "balanced", label: "Balanced", desc: "A mix of text, code, and visuals" },
  { key: "visual", label: "Visual", desc: "Heavy use of Mermaid diagrams and charts" },
  { key: "text", label: "Text-Heavy", desc: "Detailed written explanations" },
  { key: "interactive", label: "Interactive", desc: "Focused on code snippets and examples" },
];

const TONE_OPTIONS: { key: TonePreference; label: string; desc: string }[] = [
  { key: "standard", label: "Standard", desc: "Clear and helpful" },
  { key: "direct", label: "Direct", desc: "Concise, straight to the point" },
  { key: "conversational", label: "Conversational", desc: "Friendly and approachable" },
  { key: "socratic", label: "Socratic", desc: "Guides you with questions before answering" },
];

const READING_LEVEL_OPTIONS: { key: TargetReadingLevel; label: string; desc: string }[] = [
  { key: "plain", label: "Plain", desc: "Simple, easy-to-read language" },
  { key: "standard", label: "Standard", desc: "Balanced technical writing" },
  { key: "technical", label: "Technical", desc: "Dense, precise, expert-oriented" },
];

const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "�文 (简体)" },
  { code: "ko", label: "한�어" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];

const PROFILE_FIELDS = [
  { key: "audience", label: "Audience" },
  { key: "depth", label: "Content Depth" },
  { key: "role", label: "Role" },
  { key: "experience", label: "Experience Level" },
  { key: "language", label: "Output Language" },
  { key: "glossary", label: "Glossary Density" },
] as const;

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { audience, depth, glossaryDensity, learnerRole, experienceLevel, outputLanguage, mermaidEnabled, learningStyle, frameworkFamiliarity, tonePreference, updatePrefs } = useAudiencePrefs();
  const { targetReadingLevel, maxSectionsHint, packLimits, isAuthorPlus, updatePrefs: updateGenPrefs, updatePackLimits } = useGenerationPrefs();
  const { prefs: peerPrefs, updatePrefs: updatePeerPrefs } = usePeerVisibility();
  const { hasPackPermission } = useRole();
  const { currentPackId, currentPack } = usePack();
  const [roleInput, setRoleInput] = useState(learnerRole || "");
  const [frameworkInput, setFrameworkInput] = useState(frameworkFamiliarity || "");
  const [sectionsInput, setSectionsInput] = useState(maxSectionsHint);
  const [moduleWordsInput, setModuleWordsInput] = useState(packLimits.maxModuleWords);
  const [quizQuestionsInput, setQuizQuestionsInput] = useState(packLimits.maxQuizQuestions);
  const [takeawaysInput, setTakeawaysInput] = useState(packLimits.maxKeyTakeaways);

  const profileCompleteness = useMemo(() => {
    const filled: string[] = [];
    const missing: string[] = [];
    // audience always has a default, count as filled if not default
    filled.push("Audience"); // always set
    if (depth !== "standard") filled.push("Content Depth"); else missing.push("Content Depth");
    if (learnerRole) filled.push("Role"); else missing.push("Role");
    if (experienceLevel) filled.push("Experience Level"); else missing.push("Experience Level");
    if (outputLanguage !== "en") filled.push("Output Language"); else missing.push("Output Language");
    if (glossaryDensity !== "standard") filled.push("Glossary Density"); else missing.push("Glossary Density");
    if (learningStyle !== "balanced") filled.push("Learning Style"); else missing.push("Learning Style");
    if (frameworkFamiliarity) filled.push("Framework Familiarity"); else missing.push("Framework Familiarity");
    if (tonePreference !== "standard") filled.push("Tone Preference"); else missing.push("Tone Preference");
    return { filled, missing, total: 9, count: filled.length };
  }, [audience, depth, learnerRole, experienceLevel, outputLanguage, glossaryDensity, learningStyle, frameworkFamiliarity, tonePreference]);

  // Reset counts query
  const resetCountsQuery = useQuery({
    queryKey: ["reset_counts", currentPackId, user?.id],
    queryFn: async () => {
      if (!user || !currentPackId) return { sections: 0, quizzes: 0, notes: 0, paths: 0, askLead: 0, chat: 0 };
      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        supabase.from("user_progress").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("pack_id", currentPackId),
        supabase.from("quiz_scores").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("pack_id", currentPackId),
        supabase.from("learner_notes").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("pack_id", currentPackId),
        supabase.from("path_progress").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("pack_id", currentPackId).eq("is_checked", true),
        supabase.from("ask_lead_progress").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("pack_id", currentPackId).eq("is_asked", true),
        supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("pack_id", currentPackId),
      ]);
      return {
        sections: r1.count || 0,
        quizzes: r2.count || 0,
        notes: r3.count || 0,
        paths: r4.count || 0,
        askLead: r5.count || 0,
        chat: r6.count || 0,
      };
    },
    enabled: !!user && !!currentPackId,
  });

  const resetCounts = resetCountsQuery.data || { sections: 0, quizzes: 0, notes: 0, paths: 0, askLead: 0, chat: 0 };
  const totalResetItems = resetCounts.sections + resetCounts.quizzes + resetCounts.notes + resetCounts.paths + resetCounts.askLead + resetCounts.chat;

  const handleResetProgress = async () => {
    if (!user || !currentPackId) return;
    const results = await Promise.all([
      supabase.from("user_progress").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
      supabase.from("quiz_scores").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
      supabase.from("learner_notes").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
      supabase.from("path_progress").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
      supabase.from("ask_lead_progress").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
      supabase.from("chat_messages").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
      supabase.from("learner_state").delete().eq("user_id", user.id).eq("pack_id", currentPackId),
    ]);
    const hasError = results.some((r) => r.error);
    if (hasError) {
      toast.error("Failed to reset some progress data");
    } else {
      // Invalidate all relevant caches
      queryClient.invalidateQueries();
      toast.success("All progress reset successfully");
    }
  };

  const saveAll = (overrides: Partial<{ 
    audience: Audience; 
    depth: Depth; 
    glossary_density: GlossaryDensity; 
    learner_role: string | null; 
    experience_level: ExperienceLevel | null; 
    output_language: string; 
    mermaid_enabled: boolean; 
    learning_style: LearningStyle; 
    framework_familiarity: string | null; 
    tone_preference: TonePreference 
  }>) => {
    // We use the latest values from the hook to avoid overwriting with stale local state
    updatePrefs.mutate({
      audience: overrides.audience ?? audience,
      depth: overrides.depth ?? depth,
      glossary_density: overrides.glossary_density ?? glossaryDensity,
      learner_role: overrides.learner_role !== undefined ? overrides.learner_role : learnerRole,
      experience_level: overrides.experience_level !== undefined ? overrides.experience_level : experienceLevel,
      output_language: overrides.output_language ?? outputLanguage,
      mermaid_enabled: overrides.mermaid_enabled !== undefined ? overrides.mermaid_enabled : mermaidEnabled,
      learning_style: overrides.learning_style !== undefined ? overrides.learning_style : learningStyle,
      framework_familiarity: overrides.framework_familiarity !== undefined ? overrides.framework_familiarity : frameworkFamiliarity,
      tone_preference: overrides.tone_preference !== undefined ? overrides.tone_preference : tonePreference,
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <h1 className="text-2xl font-bold text-foreground mb-6" data-tour="settings-header">Settings</h1>

          {/* Profile Completeness */}
          <div className="bg-card border border-border rounded-xl p-6" data-tour="settings-profile">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Profile Completeness</h2>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <Progress value={(profileCompleteness.count / profileCompleteness.total) * 100} className="flex-1 h-2" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm font-medium text-muted-foreground whitespace-nowrap cursor-help">
                    {profileCompleteness.count}/{profileCompleteness.total} complete
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {profileCompleteness.missing.length > 0 ? (
                    <div className="text-xs">
                      <p className="font-medium mb-1">Missing fields:</p>
                      <ul className="list-disc pl-3">
                        {profileCompleteness.missing.map((f) => <li key={f}>{f}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs">All fields configured!</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Theme Selector */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Theme</h2>
              <HelpTooltip content={HELP_TOOLTIPS.settings.themeToggle} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Choose a color scheme for the interface.
            </p>
            <ThemeSwitcher />
          </div>

          {/* Audience Profile */}
          <div className="bg-card border border-border rounded-xl p-6" data-tour="settings-pack">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Audience Profile</h2>
              <HelpTooltip content={HELP_TOOLTIPS.settings.audienceProfile} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Choose your audience type to customize content tone and detail level.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => saveAll({ audience: opt.key })}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    audience === opt.key
                      ? "border-primary/40 bg-primary/10"
                      : "border-border hover:border-primary/20"
                  }`}
                >
                  <span className="text-sm font-medium text-card-foreground">{opt.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Depth Preference */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Content Depth</h2>
              <HelpTooltip content={HELP_TOOLTIPS.settings.contentDepth} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              How much detail do you want in module content?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DEPTH_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => saveAll({ depth: opt.key })}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    depth === opt.key
                      ? "border-primary/40 bg-primary/10"
                      : "border-border hover:border-primary/20"
                  }`}
                >
                  <span className="text-sm font-medium text-card-foreground">{opt.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Glossary Density */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookText className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Glossary Density</h2>
              <HelpTooltip content={HELP_TOOLTIPS.settings.glossaryDensity} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              How many glossary terms should be generated?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {GLOSSARY_DENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => saveAll({ glossary_density: opt.key })}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    glossaryDensity === opt.key
                      ? "border-primary/40 bg-primary/10"
                      : "border-border hover:border-primary/20"
                  }`}
                >
                  <span className="text-sm font-medium text-card-foreground">{opt.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Learner Profile */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Learner Profile</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Help the AI tailor content to your role and experience.
            </p>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-card-foreground mb-2 flex items-center gap-1.5">Your Role <HelpTooltip content={HELP_TOOLTIPS.settings.learnerRole} /></label>
                  <p className="text-xs text-muted-foreground mb-2">E.g., Frontend Developer, Data Engineer</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={roleInput}
                      onChange={(e) => setRoleInput(e.target.value)}
                      placeholder="e.g., Frontend Developer"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveAll({ learner_role: roleInput || null })}
                      disabled={roleInput === (learnerRole || "")}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-card-foreground mb-2 flex items-center gap-1.5">Framework Familiarity</label>
                  <p className="text-xs text-muted-foreground mb-2">Help AI use better analogies (e.g., "I know React but not Vue")</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={frameworkInput}
                      onChange={(e) => setFrameworkInput(e.target.value)}
                      placeholder="e.g., Expert in Python, new to Rust"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveAll({ framework_familiarity: frameworkInput || null })}
                      disabled={frameworkInput === (frameworkFamiliarity || "")}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-card-foreground mb-2 flex items-center gap-1.5">Experience Level <HelpTooltip content={HELP_TOOLTIPS.settings.experienceLevel} /></label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => saveAll({ experience_level: opt.key })}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        experienceLevel === opt.key
                          ? "border-primary/40 bg-primary/10"
                          : "border-border hover:border-primary/20"
                      }`}
                    >
                      <span className="text-sm font-medium text-card-foreground">{opt.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-card-foreground mb-2 flex items-center gap-1.5">Learning Style</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LEARNING_STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => saveAll({ learning_style: opt.key })}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        learningStyle === opt.key
                          ? "border-primary/40 bg-primary/10"
                          : "border-border hover:border-primary/20"
                      }`}
                    >
                      <span className="text-sm font-medium text-card-foreground">{opt.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-card-foreground mb-2 flex items-center gap-1.5">Tone Preference</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TONE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => saveAll({ tone_preference: opt.key })}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        tonePreference === opt.key
                          ? "border-primary/40 bg-primary/10"
                          : "border-border hover:border-primary/20"
                      }`}
                    >
                      <span className="text-sm font-medium text-card-foreground">{opt.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Output Language */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Output Language</h2>
              <HelpTooltip content={HELP_TOOLTIPS.settings.languagePreference} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Choose the language for AI-generated content and chat responses.
            </p>
            {currentPack?.language_mode === "english" && (
              <div className="flex items-start gap-2 bg-muted/50 border border-border rounded-lg p-3 mb-4">
                <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  This pack is configured for English only. Language preference will apply to other packs.
                </p>
              </div>
            )}
            <Select
              value={outputLanguage}
              onValueChange={(val) => {
                saveAll({ output_language: val });
                if (val !== "en") {
                  toast.info("Language preference saved. Existing generated content will remain in its original language. New content and chat responses will use your selected language.");
                }
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* AI Model Provider */}
          <AIModelProviderSection />

          {/* Generation Preferences (author+ only) */}
          {isAuthorPlus && (
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Generation Preferences</h2>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Author+</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Control how AI generates content for you.
            </p>

            <div className="space-y-5">
              {/* Target Reading Level */}
              <div>
                <label className="text-sm font-medium text-card-foreground mb-2 flex items-center gap-1.5">Target Reading Level <HelpTooltip content={HELP_TOOLTIPS.settings.targetReadingLevel} /></label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {READING_LEVEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => updateGenPrefs.mutate({ target_reading_level: opt.key })}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        targetReadingLevel === opt.key
                          ? "border-primary/40 bg-primary/10"
                          : "border-border hover:border-primary/20"
                      }`}
                    >
                      <span className="text-sm font-medium text-card-foreground">{opt.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Sections Hint */}
              <div>
                <label className="text-sm font-medium text-card-foreground mb-1 block">Max Sections per Module</label>
                <p className="text-xs text-muted-foreground mb-2">Suggested number of sections per module (1–15)</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={15}
                    value={sectionsInput}
                    onChange={(e) => setSectionsInput(Number(e.target.value))}
                    className="w-24"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const v = Math.max(1, Math.min(15, sectionsInput));
                      updateGenPrefs.mutate({ max_sections_hint: v });
                    }}
                    disabled={sectionsInput === maxSectionsHint}
                  >
                    Save
                  </Button>
                </div>
              </div>

              {/* Mermaid Diagrams */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary" />
                  <div>
                    <span className="text-sm font-medium text-card-foreground flex items-center gap-1.5">Enable Mermaid Diagrams <HelpTooltip content={HELP_TOOLTIPS.settings.mermaidEnabled} /></span>
                    <p className="text-xs text-muted-foreground">Allow AI to include diagrams in content</p>
                  </div>
                </div>
                <Switch
                  checked={mermaidEnabled}
                  onCheckedChange={(checked) => saveAll({ mermaid_enabled: checked })}
                />
              </div>
            </div>
          </div>
          )}

          {/* Generation Limits (author+ only) */}
          {isAuthorPlus && (
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-card-foreground">Generation Limits</h2>
                <HelpTooltip content={HELP_TOOLTIPS.settings.generationLimits} />
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Author+</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Pack-level limits that constrain AI output. Binding limits are enforced; advisory limits guide the AI.
              </p>

              <div className="space-y-4">
                {([
                  { key: "max_module_words", label: "Max Module Words", value: moduleWordsInput, setter: setModuleWordsInput, min: 200, max: 5000, desc: "Maximum word count for generated modules (binding)", current: packLimits.maxModuleWords },
                  { key: "max_quiz_questions", label: "Max Quiz Questions", value: quizQuestionsInput, setter: setQuizQuestionsInput, min: 1, max: 20, desc: "Maximum quiz questions per module", current: packLimits.maxQuizQuestions },
                  { key: "max_key_takeaways", label: "Max Key Takeaways", value: takeawaysInput, setter: setTakeawaysInput, min: 1, max: 15, desc: "Maximum key takeaways per module", current: packLimits.maxKeyTakeaways },
                ] as const).map((field) => (
                  <div key={field.key}>
                    <label className="text-sm font-medium text-card-foreground mb-0.5 block">{field.label}</label>
                    <p className="text-xs text-muted-foreground mb-1.5">{field.desc}</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={field.min}
                        max={field.max}
                        value={field.value}
                        onChange={(e) => field.setter(Number(e.target.value))}
                        placeholder={String(field.current)}
                        className="w-28"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePackLimits.mutate({ [field.key]: field.value })}
                        disabled={field.value === field.current}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Re-run Learner Onboarding */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Learner Onboarding</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Re-run the onboarding wizard to update your audience, depth, and track preferences.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!user || !currentPackId) return;
                await supabase.from("audience_preferences").delete().eq("user_id", user.id).or(`pack_id.eq.${currentPackId},pack_id.is.null`);
                queryClient.invalidateQueries({ queryKey: ["audience_preferences"] });
                queryClient.invalidateQueries({ queryKey: ["learner_onboarding_check"] });
                toast.success("Preferences cleared. Visit the dashboard to re-run the onboarding wizard.");
              }}
            >
              Reset & Re-run Setup
            </Button>
          </div>

          {/* Peer Privacy Settings */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground">Peer Learning Privacy</h2>
              <HelpTooltip content={HELP_TOOLTIPS.settings.peerPrivacy} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Control what your cohort peers can see about your activity and progress.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {peerPrefs.show_my_progress ? (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Show my progress</p>
                    <p className="text-xs text-muted-foreground">Allow peers to see your completion percentage</p>
                  </div>
                </div>
                <Switch
                  checked={peerPrefs.show_my_progress}
                  onCheckedChange={(val) => updatePeerPrefs.mutate({ show_my_progress: val })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {peerPrefs.show_my_activity ? (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Show my activity</p>
                    <p className="text-xs text-muted-foreground">Allow peers to see when you're active on modules</p>
                  </div>
                </div>
                <Switch
                  checked={peerPrefs.show_my_activity}
                  onCheckedChange={(val) => updatePeerPrefs.mutate({ show_my_activity: val })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Allow direct messages</p>
                    <p className="text-xs text-muted-foreground">Let peers send you encouragement messages</p>
                  </div>
                </div>
                <Switch
                  checked={peerPrefs.allow_direct_messages}
                  onCheckedChange={(val) => updatePeerPrefs.mutate({ allow_direct_messages: val })}
                />
              </div>
            </div>
          </div>

          {/* Slack Integration - Admin only */}
          {hasPackPermission("admin") && (
            <SlackSettingsSection />
          )}

          {/* Reset Progress */}
          <div className="bg-card border border-destructive/20 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h2 className="font-semibold text-card-foreground">Reset All Progress</h2>
              <HelpTooltip content={HELP_TOOLTIPS.settings.resetProgress} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Clear all your progress for this pack. This cannot be undone.
            </p>

            {/* Progress counts */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {[
                { label: "Sections read", count: resetCounts.sections },
                { label: "Quizzes completed", count: resetCounts.quizzes },
                { label: "Notes saved", count: resetCounts.notes },
                { label: "Path steps checked", count: resetCounts.paths },
                { label: "Questions asked", count: resetCounts.askLead },
                { label: "Chat messages", count: resetCounts.chat },
              ].map((item) => (
                <div key={item.label} className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-foreground">{item.count}</div>
                  <div className="text-[10px] text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2" disabled={totalResetItems === 0}>
                  <Trash2 className="w-4 h-4" />
                  Reset All Progress {totalResetItems > 0 && `(${totalResetItems} items)`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset ALL your progress for this pack including reading progress, quiz scores, notes, paths, ask-lead progress, and chat history. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetProgress} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Reset Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
