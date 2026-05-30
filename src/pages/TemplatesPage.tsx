import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTemplates, TemplateData, TemplateRow } from "@/hooks/useTemplates";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Sparkles, FileText, Trash2, Plus, Layout, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function TemplateCard({ template, onDelete }: { template: TemplateRow; onDelete: (id: string) => void }) {
  const navigate = useNavigate();
  const tpl = template.template_data;
  const sectionCount = tpl?.section_outline?.length || 0;
  const signalCount = tpl?.trigger_rules?.required_signals?.length || 0;

  return (
    <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/templates/${template.id}`)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layout className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">{template.title}</h3>
              <code className="text-[10px] text-muted-foreground font-mono">{template.template_key}</code>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(template.id); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
        {template.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{template.description}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px]">
            <ListChecks className="w-2.5 h-2.5 mr-1" />{sectionCount} sections
          </Badge>
          {signalCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
              {signalCount} signals
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TemplatesPage() {
  const { hasPackPermission } = useRole();
  const { templates, templatesLoading, createTemplate, saveTemplate, deleteTemplate } = useTemplates();
  const [showCreate, setShowCreate] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [generatedTemplate, setGeneratedTemplate] = useState<TemplateData | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  if (!hasPackPermission("admin")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">You need admin access to manage templates.</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleGenerate = async () => {
    if (!instruction.trim()) return;
    try {
      const result = await createTemplate.mutateAsync(instruction);
      setGeneratedTemplate(result.template);
      setWarnings(result.warnings);
      toast.success("Template generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate template");
    }
  };

  const handleSave = async () => {
    if (!generatedTemplate) return;
    try {
      await saveTemplate.mutateAsync(generatedTemplate);
      setShowCreate(false);
      setInstruction("");
      setGeneratedTemplate(null);
      setWarnings([]);
      toast.success("Template saved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save template");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success("Template deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between" data-tour="templates-header">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Templates</h1>
            <p className="text-sm text-muted-foreground mt-1">Module generation blueprints for your organization</p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create Template
          </Button>
        </div>

        {templatesLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : templates.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No templates yet</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Create AI-powered templates that define how modules are structured and generated.
              </p>
              <Button onClick={() => setShowCreate(true)}>
                <Sparkles className="w-4 h-4 mr-2" /> Create Your First Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tour="template-grid">
            {templates.map((t) => (
              <TemplateCard key={t.id} template={t} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {/* Create Template Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Template</DialogTitle>
              <DialogDescription>Describe the kind of module template you want to create.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Textarea
                placeholder="e.g. A template for API documentation modules that covers endpoints, authentication, error handling, and code examples..."
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={4}
              />
              <Button onClick={handleGenerate} disabled={createTemplate.isPending || !instruction.trim()} className="w-full">
                {createTemplate.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Generate Template
              </Button>

              {generatedTemplate && (
                <div className="space-y-4 border-t border-border pt-4">
                  <div>
                    <h4 className="font-semibold text-foreground">{generatedTemplate.title}</h4>
                    <code className="text-xs text-muted-foreground font-mono">{generatedTemplate.template_key}</code>
                    <p className="text-sm text-muted-foreground mt-1">{generatedTemplate.description}</p>
                  </div>

                  {generatedTemplate.section_outline?.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Section Outline</h5>
                      <div className="space-y-1.5">
                        {generatedTemplate.section_outline.map((s, i) => (
                          <div key={s.section_id} className="flex items-start gap-2 text-sm">
                            <span className="text-muted-foreground font-mono text-xs w-5 shrink-0">{i + 1}.</span>
                            <div>
                              <span className="font-medium text-foreground">{s.heading}</span>
                              <span className="text-muted-foreground ml-1">— {s.purpose}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {warnings.length > 0 && (
                    <div className="text-xs text-yellow-400 space-y-1">
                      {warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
                    </div>
                  )}

                  <Button onClick={handleSave} disabled={saveTemplate.isPending} className="w-full">
                    {saveTemplate.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Save Template
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
