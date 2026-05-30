import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProgress } from "@/hooks/useProgress";
import { useGeneratedModules } from "@/hooks/useGeneratedModules";
import { useGeneratedAskLead } from "@/hooks/useGeneratedAskLead";
import { useAskLeadProgress } from "@/hooks/useAskLeadProgress";
import { useGeneratedPaths } from "@/hooks/useGeneratedPaths";
import { usePathProgress } from "@/hooks/usePathProgress";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { useModuleDependencies } from "@/hooks/useModuleDependencies";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ListChecks, GraduationCap, MessageSquareMore, PartyPopper, ArrowRight } from "lucide-react";

interface Suggestion {
  priority: number;
  icon: React.ReactNode;
  text: string;
  action: () => void;
  label: string;
}

export function SuggestedNextAction() {
  const navigate = useNavigate();
  const { currentPackId } = usePack();
  const { hasPackPermission } = useRole();
  const isAuthor = hasPackPermission("author");
  const { progressData, quizScores } = useProgress();
  const { modules: allModules } = useGeneratedModules();
  const { askLead } = useGeneratedAskLead();
  const { askedQuestions } = useAskLeadProgress();
  const { paths: pathsRow } = useGeneratedPaths();
  const { checkedSteps: day1Checked } = usePathProgress("day1");
  const { checkPrerequisitesMet } = useModuleDependencies();

  const modules = isAuthor ? allModules : allModules.filter(m => m.status === "published");
  const unlockedModules = modules.filter(m => !checkPrerequisitesMet(m.module_key).hasHardBlock);
  const packId = currentPackId;

  const questions = askLead?.questions_data || [];
  const pathsData = pathsRow?.paths_data;

  const suggestion = useMemo((): Suggestion | null => {
    if (!packId || modules.length === 0) return null;

    const candidates: Suggestion[] = [];

    // 1. Day 1 checklist for new users
    const hasAnyProgress = progressData.length > 0;
    const day1Steps = pathsData?.day1 || [];
    if (!hasAnyProgress && day1Steps.length > 0) {
      candidates.push({
        priority: 1,
        icon: <ListChecks className="w-4 h-4" />,
        text: "Start with your Day 1 checklist",
        action: () => navigate(`/packs/${packId}/paths`),
        label: "View Checklist",
      });
    }

    // 2. Quiz ready — all sections read in a module but no quiz score
    for (const mod of unlockedModules) {
      const sectionCount = (mod.module_data as any)?.sections?.length || 0;
      if (sectionCount === 0) continue;
      const readCount = progressData.filter(p => p.module_id === mod.module_key).length;
      if (readCount >= sectionCount) {
        const hasQuiz = quizScores.some(q => q.module_id === mod.module_key);
        if (!hasQuiz) {
          candidates.push({
            priority: 2,
            icon: <GraduationCap className="w-4 h-4" />,
            text: `Ready to test your knowledge? Take the ${mod.title} quiz`,
            action: () => navigate(`/packs/${packId}/modules/${mod.module_key}`),
            label: "Take Quiz",
          });
          break;
        }
      }
    }

    // 3. Unasked lead questions
    const totalQuestions = questions.length;
    const askedCount = askedQuestions.size;
    const unaskedCount = totalQuestions - askedCount;
    if (unaskedCount > 0) {
      candidates.push({
        priority: 3,
        icon: <MessageSquareMore className="w-4 h-4" />,
        text: `You have ${unaskedCount} question${unaskedCount > 1 ? "s" : ""} left to ask your lead`,
        action: () => navigate(`/packs/${packId}/ask-lead`),
        label: "View Questions",
      });
    }

    // 4. All complete celebration
    const allModulesComplete = unlockedModules.every(mod => {
      const sectionCount = (mod.module_data as any)?.sections?.length || 0;
      const readCount = progressData.filter(p => p.module_id === mod.module_key).length;
      return sectionCount > 0 && readCount >= sectionCount;
    });
    if (allModulesComplete && unlockedModules.length > 0) {
      candidates.push({
        priority: 4,
        icon: <PartyPopper className="w-4 h-4" />,
        text: "🎉 All modules complete! Check the glossary for reference.",
        action: () => navigate(`/packs/${packId}/glossary`),
        label: "View Glossary",
      });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.priority - b.priority);
    return candidates[0];
  }, [packId, modules, progressData, quizScores, questions, askedQuestions, pathsData, day1Checked, navigate]);

  if (!suggestion || isAuthor) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mt-3 flex items-center gap-3 px-4 py-3 rounded-lg bg-accent/50 border border-border"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
        {suggestion.icon}
      </div>
      <p className="text-sm text-foreground flex-1">{suggestion.text}</p>
      <Button size="sm" variant="ghost" className="gap-1 text-xs flex-shrink-0" onClick={suggestion.action}>
        {suggestion.label} <ArrowRight className="w-3 h-3" />
      </Button>
    </motion.div>
  );
}
