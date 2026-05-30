import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";
import { AlertTriangle, Maximize2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";

let idCounter = 0;

interface MermaidDiagramProps {
  code: string;
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const idRef = useRef(`mermaid-${++idCounter}-${Date.now()}`);
  const { resolvedMode } = useTheme();

  const render = useCallback(async () => {
    // Re-initialize mermaid with correct theme for current mode
    mermaid.initialize({
      startOnLoad: false,
      theme: resolvedMode === "dark" ? "dark" : "default",
      securityLevel: "strict",
      fontFamily: "inherit",
    });
    // Generate a fresh ID for each render to avoid mermaid caching issues
    idRef.current = `mermaid-${++idCounter}-${Date.now()}`;
    try {
      // Clear out the previous HTML so mermaid doesn't complain about existing elements
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      
      const { svg: rendered } = await mermaid.render(idRef.current, code.trim());
      setSvg(rendered);
      setError(null);
    } catch (e: any) {
      console.warn("Mermaid rendering error:", e);
      setError(e?.message || "Failed to render diagram");
      setSvg(null);
      // Clean up the error container mermaid sometimes leaves behind in the DOM tree
      const temp = document.getElementById(idRef.current);
      temp?.remove();
    }
  }, [code, resolvedMode]);

  useEffect(() => {
    render();
  }, [render]);

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          Diagram could not be rendered
        </div>
        <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap font-mono bg-muted/50 rounded p-3">
          {code}
        </pre>
      </div>
    );
  }

  if (!svg) return null;

  return (
    <>
      <div className="my-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Diagram</span>
          <button
            onClick={() => setZoomed(true)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Maximize2 className="w-3 h-3" />
            Expand
          </button>
        </div>
        <div
          ref={containerRef}
          className="overflow-x-auto [&>svg]:max-w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {/* Zoom modal */}
      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-8"
            onClick={() => setZoomed(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-[90vw] max-h-[90vh] overflow-auto bg-card border border-border rounded-2xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setZoomed(false)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-muted hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div
                className="[&>svg]:max-w-full [&>svg]:h-auto"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
