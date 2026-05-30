import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionViewer } from "@/components/SectionViewer";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, MessageCircle, Wand2, Lightbulb, Play } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const MOCK_SANDBOX_MODULE = {
  title: "Sandbox: Understanding RocketBoard Architecture",
  description: "A safe place to practice refining content with AI. Changes made here are not saved.",
  module_data: {
    sections: [
      {
        section_id: "sb-1",
        heading: "The Core Ingestion Engine",
        content: "RocketBoard's ingestion engine uses a distributed worker pattern to process sources. Chunks are stored in a vector database for semantic retrieval.\n\n[ACTION: open_help(Ingestion Details)]",
        key_takeaway: "Distributed workers perform the heavy lifting of parsing and redaction."
      },
      {
        section_id: "sb-2",
        heading: "AI Generation Cascade",
        content: "When you trigger a generation, the AI follows a rigid dependency graph to ensure content consistency across modules, quizzes, and glossary terms.",
        key_takeaway: "Consistency is maintained via cross-referenced citations."
      }
    ]
  }
};

export default function SandboxModulePage() {
  const { packId } = useParams();
  const navigate = useNavigate();
  const [module, setModule] = useState(MOCK_SANDBOX_MODULE);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  const handleRefine = () => {
    if (!refineInstruction.trim()) return;
    
    setIsRefining(true);
    // Simulate AI refinement
    setTimeout(() => {
      const updatedModule = JSON.parse(JSON.stringify(module));
      updatedModule.module_data.sections[0].content += `\n\n**Refined Note:** ${refineInstruction} (Simulated refinement complete!)`;
      setModule(updatedModule);
      setIsRefining(false);
      setRefineOpen(false);
      setRefineInstruction("");
      toast.success("Module refined! (Sandbox mode: changes are temporary)");
    }, 1500);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5 py-1 px-3">
            <Play className="w-3 h-3 fill-current" /> Sandbox Mode
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{module.title}</h1>
            <Badge className="gradient-primary border-0">Demo</Badge>
          </div>
          <p className="text-muted-foreground text-lg">{module.description}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8 pb-32">
            {module.module_data.sections.map((section, idx) => (
              <div key={section.section_id} className="space-y-4 pt-4 first:pt-0">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <span className="text-muted-foreground/30 font-mono text-sm">{idx + 1}.</span>
                  {section.heading}
                </h2>
                <div className="prose prose-invert max-w-none bg-card/30 border border-border/50 rounded-xl p-6 shadow-sm">
                  <MarkdownRenderer>{section.content}</MarkdownRenderer>
                </div>
                {section.key_takeaway && (
                  <div className="flex items-start gap-3 bg-primary/5 border border-primary/10 rounded-lg p-4">
                    <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground/90 italic">{section.key_takeaway}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="sticky top-6 space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border/50 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <Wand2 className="w-5 h-5" />
                  <span className="font-semibold text-sm">Practice Refinement</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Refining content is how you curate AI output. Try asking it to "Make it more technical" or "Add a code example for a worker function".
                </p>
                <Button 
                  onClick={() => setRefineOpen(true)}
                  className="w-full gradient-primary border-0 shadow-lg hover:shadow-primary/20 transition-all font-semibold"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Refine with AI
                </Button>
              </div>

              <div className="p-5 rounded-2xl bg-card/30 border border-border/50 border-dashed space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MessageCircle className="w-4 h-4" />
                  <span className="font-medium text-xs">Help Tip</span>
                </div>
                <p className="text-[11px] text-muted-foreground italic">
                  "In the sandbox, the AI won't actually query your database, but it will show you how the UI responds to instructions."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={refineOpen} onOpenChange={setRefineOpen}>
        <DialogContent className="sm:max-w-[500px] border-primary/20 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Refine Sandbox Content
            </DialogTitle>
            <DialogDescription>
              Describe how you want to change this module. In sandbox mode, changes are for display only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="e.g. 'Explain the ingestion queue in more detail' or 'Add a warning about data privacy'"
              className="min-h-[120px] bg-muted/30 border-border/50 focus:border-primary/50 transition-colors"
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setRefineOpen(false)} disabled={isRefining}>Cancel</Button>
            <Button 
              onClick={handleRefine} 
              disabled={isRefining || !refineInstruction.trim()}
              className="gradient-primary border-0 shadow-md"
            >
              {isRefining ? (
                <>
                  <Wand2 className="w-4 h-4 mr-2 animate-spin" />
                  Refining...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Refine Content
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
