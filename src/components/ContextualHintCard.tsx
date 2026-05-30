import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, X, Rocket, ChevronDown, ChevronUp, Bot, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/lib/contextualHints/types";

interface ContextualHintCardProps {
  hint: Hint;
  onDismiss: () => void;
  onSnooze: () => void;
  onAskRocket: () => void;
}

export function ContextualHintCard({ hint, onDismiss, onSnooze, onAskRocket }: ContextualHintCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-24 right-6 z-40 w-80 pointer-events-auto"
    >
      <Card className="shadow-2xl border-primary/20 bg-card/95 backdrop-blur-sm overflow-hidden">
        <CardHeader className="p-4 pb-2 space-y-0 flex flex-row items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold leading-none">{hint.title}</CardTitle>
              <Badge variant="outline" className="text-[10px] mt-1 h-4 px-1.5 py-0 bg-muted/50 border-primary/20 text-primary">
                Rocket Suggestion
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1 text-muted-foreground" onClick={onDismiss}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </CardHeader>
        
        <CardContent className="p-4 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {hint.summary}
          </p>
          
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                  {hint.steps.map((step, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-[10px] font-mono text-primary bg-primary/10 w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-[11px] text-foreground leading-snug">
                        {step.text}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>

        <CardFooter className="p-3 bg-muted/30 border-t border-border/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? (
                <>Hide <ChevronUp className="ml-1 w-3 h-3" /></>
              ) : (
                <>Show steps <ChevronDown className="ml-1 w-3 h-3" /></>
              )}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2 text-muted-foreground" onClick={onSnooze}>
              Snooze
            </Button>
          </div>
          <Button size="sm" className="h-8 text-[11px] gap-1.5 px-3 gradient-primary border-0" onClick={onAskRocket}>
            <Rocket className="w-3.5 h-3.5" />
            Ask Rocket
          </Button>
        </CardFooter>
      </Card>
      
      {/* Small glow effect */}
      <div className="absolute -z-10 inset-0 bg-primary/5 blur-2xl rounded-2xl" />
    </motion.div>
  );
}
