import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTemplates, TemplateData, TemplateChangeLogEntry } from "@/hooks/useTemplates";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Sparkles, ArrowLeft, Trash2, Code, ListChecks, Target, FileSearch } from "lucide-react";
import { toast } from "sonner";

export default function TemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { hasPackPermission } = useRole();
  const { fetchTemplate, saveTemplate, refineTemplate, deleteTemplate } = useTemplates();
  const { data: template, isLoading } = fetchTemplate(templateId || "");

  const [showRefine, setShowRefine] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [changeLog, setChangeLog] = useState<TemplateChangeLogEntry[]>([]);

  if (!hasPackPermission("admin")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">You need admin access to view templates.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!template) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground mb-4">Template not found</p>
          <Button variant="outline" onClick={() => navigate("/templates")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Templates
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const tpl = template.template_data;

  const handleRefine = async () => {
    if (!refineInstruction.trim()) return;
    try {
      const result = await refineTemplate.mutateAsync({
        existingTemplate: tpl,
        authorInstruction: refineInstruction,
      });
      await saveTemplate.mutateAsync(result.template);
      setChangeLog(result.changeLog);
      setRefineInstruction("");
      toast.success("Template refined and saved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to refine");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTemplate.mutateAsync(template.id);
      navigate("/templates");
      toast.success("Template deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  const triggers = tpl?.trigger_rules as any || {};
  const allTriggers = [
    ...((triggers.required_signals as string[]) || []).map((s: string) => ({ label: s, type: "signal" })),
    ...((triggers.path_patterns_any as string[]) || []).map((p: string) => ({ label: p, type: "path" })),
    ...((triggers.file_types_any as string[]) || []).map((f: string) => ({ label: f, type: "file" })),
    ...((triggers.repo_hints_any as string[]) || []).map((r: string) => ({ label: r, type: "repo" })),
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/templates")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{template.title}</h1>
              <code className="text-xs text-muted-foreground font-mono">{template.template_key}</code>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowRefine(true)}>
              <Sparkles className="w-4 h-4 mr-1" /> Refine
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          </div>
        </div>

        {template.description && (
          <p className="text-sm text-muted-foreground">{template.description}</p>
        )}

        {/* Section Outline */}
        {tpl?.section_outline?.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <ListChecks className="w-4 h-4 text-primary" /> Section Outline
              </h3>
              <div className="space-y-3">
                {tpl.section_outline.map((s: any, i: number) => (
                  <div key={s.section_id} className="flex items-start gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 mt-0.5">{i + 1}.</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{s.heading}</span>
                        <code className="text-[10px] text-muted-foreground/60 font-mono">{s.section_id}</code>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.purpose}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trigger Rules */}
        {allTriggers.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-primary" /> Trigger Rules
              </h3>
              <div className="flex flex-wrap gap-2">
                {allTriggers.map((t: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    <span className="text-muted-foreground mr-1">{t.type}:</span>{t.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generation Instructions */}
        {tpl?.generation_instructions && (
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Code className="w-4 h-4 text-primary" /> Generation Instructions
              </h3>
              <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md whitespace-pre-wrap font-mono">
                {tpl.generation_instructions}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Evidence Requirements */}
        {tpl?.evidence_requirements?.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <FileSearch className="w-4 h-4 text-primary" /> Evidence Requirements
              </h3>
              <div className="space-y-2">
                {tpl.evidence_requirements.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded border border-border mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-foreground">{r.requirement}</p>
                      <p className="text-xs text-muted-foreground">{r.why}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Change Log from last refinement */}
        {changeLog.length > 0 && (
          <Card className="border-primary/20">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Latest Changes</h3>
              <div className="space-y-2">
                {changeLog.map((c, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-foreground font-medium">{c.change}</span>
                    <span className="text-muted-foreground ml-1">— {c.reason}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Refine Dialog */}
        <Dialog open={showRefine} onOpenChange={setShowRefine}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Refine Template</DialogTitle>
              <DialogDescription>Describe what you'd like to change about this template.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="e.g. Add a troubleshooting section, make the code examples section more detailed..."
                value={refineInstruction}
                onChange={(e) => setRefineInstruction(e.target.value)}
                rows={4}
              />
              <Button onClick={handleRefine} disabled={refineTemplate.isPending || !refineInstruction.trim()} className="w-full">
                {refineTemplate.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Refine Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
