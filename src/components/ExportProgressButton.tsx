import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useProgress } from "@/hooks/useProgress";
import { useGeneratedModules } from "@/hooks/useGeneratedModules";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { generateProgressPDF, ProgressExportData } from "@/lib/export-progress";

export function ExportProgressButton({ className }: { className?: string }) {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();
  const { progressData, quizScores, getModuleProgress } = useProgress();
  const { modules: generatedModules } = useGeneratedModules();
  const { hasPackPermission } = useRole();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!user || !currentPackId) return;
    setExporting(true);

    try {
      // Fetch notes
      const { data: notes } = await supabase
        .from("learner_notes")
        .select("*")
        .eq("user_id", user.id)
        .eq("pack_id", currentPackId);

      // Fetch path progress
      const { data: pathData } = await supabase
        .from("path_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("pack_id", currentPackId)
        .eq("is_checked", true);

      // Build module data
      const modules = generatedModules.map((mod) => {
        const sections = (mod.module_data?.sections || []) as { section_id: string; heading: string }[];
        const readSet = new Set(
          progressData.filter((p) => p.module_id === mod.module_key).map((p) => p.section_id)
        );
        return {
          title: mod.title,
          difficulty: mod.difficulty || undefined,
          sectionsRead: readSet.size,
          totalSections: sections.length,
          progress: getModuleProgress(mod.module_key),
          sections: sections.map((s) => ({
            title: s.heading,
            isRead: readSet.has(s.section_id),
          })),
        };
      });

      // Build quiz scores
      const quizData = (quizScores || []).map((q) => {
        const mod = generatedModules.find((m) => m.module_key === q.module_id);
        return {
          moduleTitle: mod?.title || q.module_id,
          score: q.score,
          total: q.total,
        };
      });

      // Build notes
      const noteData = (notes || []).map((n) => {
        const mod = generatedModules.find((m) => m.module_key === n.module_id);
        const sections = (mod?.module_data?.sections || []) as { section_id: string; heading: string }[];
        const section = sections.find((s) => s.section_id === n.section_id);
        return {
          moduleTitle: mod?.title || n.module_id,
          sectionTitle: section?.heading || n.section_id,
          content: n.content,
          date: new Date(n.updated_at).toLocaleDateString(),
        };
      });

      // Build path progress
      const day1 = (pathData || []).filter((p) => p.path_type === "day1");
      const week1 = (pathData || []).filter((p) => p.path_type === "week1");
      const pathProgress = [
        { type: "Day 1", stepsChecked: day1.length, totalSteps: day1.length, checkedItems: day1.map((p) => p.step_id) },
        { type: "Week 1", stepsChecked: week1.length, totalSteps: week1.length, checkedItems: week1.map((p) => p.step_id) },
      ].filter((p) => p.stepsChecked > 0);

      const overallProgress = modules.length
        ? Math.round(modules.reduce((a, m) => a + m.progress, 0) / modules.length)
        : 0;

      const exportData: ProgressExportData = {
        userName: user.user_metadata?.full_name || user.email || "Learner",
        userEmail: user.email || "",
        packTitle: currentPack?.title || "Pack",
        packDescription: currentPack?.description || "",
        overallProgress,
        modules,
        quizScores: quizData,
        notes: noteData,
        pathProgress,
        generatedDate: new Date().toLocaleDateString(),
      };

      const blob = generateProgressPDF(exportData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rocketboard-progress-${currentPack?.title?.replace(/\s+/g, "-").toLowerCase() || "report"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Progress report exported!");
    } catch (e: any) {
      toast.error("Export failed: " + (e.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  if (!hasPackPermission("learner")) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      className={`gap-2 ${className || ""}`}
    >
      {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      Export PDF
    </Button>
  );
}
