import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useAudiencePrefs, ExperienceLevel } from "@/hooks/useAudiencePrefs";
import { useLearnerState } from "@/hooks/useLearnerState";
import { usePackTracks, PackTrack } from "@/hooks/usePackTracks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rocket, ChevronRight, Sprout, TreePine, Trees, Wrench, BarChart3, FileText, Zap, BookOpen, Layers } from "lucide-react";
import type { Audience, Depth } from "@/data/onboarding-data";

const STEPS = ["welcome", "profile", "preferences", "tracks"] as const;
type Step = typeof STEPS[number];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
};

export function LearnerOnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { currentPack } = usePack();
  const { updatePrefs } = useAudiencePrefs();
  const { updateLastOpened } = useLearnerState();
  const { tracks } = usePackTracks();

  const [stepIdx, setStepIdx] = useState(0);
  const [dir, setDir] = useState(1);

  // Form state
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [audience, setAudience] = useState<Audience>("mixed");
  const [depth, setDepth] = useState<Depth>("standard");
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);

  const hasTracks = tracks.length > 0;
  const activeSteps = hasTracks ? STEPS : STEPS.filter(s => s !== "tracks");
  const currentStep = activeSteps[stepIdx];
  const totalSteps = activeSteps.length;

  const goNext = () => { setDir(1); setStepIdx(i => Math.min(i + 1, totalSteps - 1)); };
  const goPrev = () => { setDir(-1); setStepIdx(i => Math.max(i - 1, 0)); };

  const handleFinish = () => {
    updatePrefs.mutate({
      audience,
      depth,
      learner_role: role || null,
      experience_level: experience,
    });
    if (selectedTrack) {
      updateLastOpened.mutate({ trackKey: selectedTrack });
    }
    onComplete();
  };

  const handleSkip = () => {
    // Save defaults so wizard doesn't show again
    updatePrefs.mutate({ audience: "mixed", depth: "standard" });
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {activeSteps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stepIdx ? "w-8 bg-primary" : i < stepIdx ? "w-4 bg-primary/40" : "w-4 bg-muted"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={currentStep}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {currentStep === "welcome" && (
              <div className="text-center">
                <motion.div animate={{ rotate: [0, -10, 10, -5, 0] }} transition={{ duration: 1.5, delay: 0.3 }}>
                  <Rocket className="w-16 h-16 text-primary mx-auto mb-6" />
                </motion.div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Welcome to {currentPack?.title || "RocketBoard"}! 👋
                </h1>
                {currentPack?.description && (
                  <p className="text-muted-foreground mb-4 text-sm">{currentPack.description}</p>
                )}
                <p className="text-muted-foreground mb-8">
                  Let's personalize your learning experience. This takes about 30 seconds.
                </p>
                <Button onClick={goNext} className="gap-2 gradient-primary text-primary-foreground border-0">
                  Let's Go <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {currentStep === "profile" && (
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1 text-center">Tell us about yourself</h2>
                <p className="text-muted-foreground text-sm text-center mb-6">This helps us tailor content to your needs.</p>

                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Your Role</label>
                    <Input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g., Frontend Developer, QA Engineer"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-3 block">Experience Level</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { key: "new" as const, icon: Sprout, label: "New", desc: "< 1 year" },
                        { key: "mid" as const, icon: TreePine, label: "Mid", desc: "1-5 years" },
                        { key: "senior" as const, icon: Trees, label: "Senior", desc: "5+ years" },
                      ]).map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setExperience(opt.key)}
                          className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all ${
                            experience === opt.key
                              ? "border-primary/40 bg-primary/10"
                              : "border-border hover:border-primary/20"
                          }`}
                        >
                          <opt.icon className={`w-6 h-6 ${experience === opt.key ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="text-sm font-medium text-foreground">{opt.label}</span>
                          <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={goPrev} size="sm">Back</Button>
                  <Button onClick={goNext} className="gap-2">Continue <ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}

            {currentStep === "preferences" && (
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1 text-center">Learning Preferences</h2>
                <p className="text-muted-foreground text-sm text-center mb-6">How would you like your content?</p>

                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-3 block">Content Style</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { key: "technical" as const, icon: Wrench, label: "Technical", desc: "Show me the code" },
                        { key: "mixed" as const, icon: BarChart3, label: "Mixed", desc: "Balance of both" },
                        { key: "non_technical" as const, icon: FileText, label: "Conceptual", desc: "Concepts & workflows" },
                      ]).map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setAudience(opt.key)}
                          className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all ${
                            audience === opt.key
                              ? "border-primary/40 bg-primary/10"
                              : "border-border hover:border-primary/20"
                          }`}
                        >
                          <opt.icon className={`w-6 h-6 ${audience === opt.key ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="text-sm font-medium text-foreground">{opt.label}</span>
                          <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-3 block">Content Depth</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { key: "shallow" as const, icon: Zap, label: "Quick", desc: "Overview only" },
                        { key: "standard" as const, icon: BookOpen, label: "Standard", desc: "Balanced detail" },
                        { key: "deep" as const, icon: Layers, label: "Deep", desc: "Comprehensive" },
                      ]).map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setDepth(opt.key)}
                          className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all ${
                            depth === opt.key
                              ? "border-primary/40 bg-primary/10"
                              : "border-border hover:border-primary/20"
                          }`}
                        >
                          <opt.icon className={`w-6 h-6 ${depth === opt.key ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="text-sm font-medium text-foreground">{opt.label}</span>
                          <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={goPrev} size="sm">Back</Button>
                  <Button onClick={hasTracks ? goNext : handleFinish} className="gap-2">
                    {hasTracks ? "Continue" : "Start Learning →"}
                    {hasTracks && <ChevronRight className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            {currentStep === "tracks" && (
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1 text-center">Choose Your Focus</h2>
                <p className="text-muted-foreground text-sm text-center mb-6">
                  This prioritizes content for your area. You can still access all tracks.
                </p>

                <div className="space-y-2">
                  {tracks.map(track => (
                    <button
                      key={track.track_key}
                      onClick={() => setSelectedTrack(track.track_key)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedTrack === track.track_key
                          ? "border-primary/40 bg-primary/10"
                          : "border-border hover:border-primary/20"
                      }`}
                    >
                      <span className="text-sm font-medium text-foreground">{track.title}</span>
                      {track.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{track.description}</p>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={goPrev} size="sm">Back</Button>
                  <Button onClick={handleFinish} className="gap-2 gradient-primary text-primary-foreground border-0">
                    Start Learning →
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Skip link */}
        {currentStep !== "welcome" && (
          <button onClick={handleSkip} className="block mx-auto mt-6 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
