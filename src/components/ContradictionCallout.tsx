import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { CitationBadge } from "@/components/CitationBadge";

export interface ContradictionSide {
  claim: string;
  citations?: { span_id: string; path?: string; chunk_id?: string }[];
}

export interface Contradiction {
  topic?: string;
  description?: string;
  side_a?: ContradictionSide;
  side_b?: ContradictionSide;
  how_to_resolve?: string[];
  // Legacy flat shape from chat responses
  claim?: string;
  reason?: string;
}

interface ContradictionCalloutProps {
  contradiction: Contradiction;
  index?: number;
  compact?: boolean;
}

export function ContradictionCallout({ contradiction, index = 0, compact = false }: ContradictionCalloutProps) {
  const hasSides = contradiction.side_a && contradiction.side_b;

  if (compact) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        <div className="flex items-center gap-1 font-medium">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {contradiction.topic || "Contradiction detected"}
        </div>
        {contradiction.description && (
          <p className="mt-1 opacity-80">{contradiction.description}</p>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {contradiction.topic || "Conflicting Evidence"}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Description fallback for simple contradictions */}
        {!hasSides && contradiction.description && (
          <p className="text-sm text-muted-foreground">{contradiction.description}</p>
        )}

        {/* Side-by-side views */}
        {hasSides && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Side A */}
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">View A</div>
              <p className="text-sm text-foreground">{contradiction.side_a!.claim}</p>
              {contradiction.side_a!.citations && contradiction.side_a!.citations.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {contradiction.side_a!.citations.map((c) => (
                    <CitationBadge key={c.span_id} spanId={c.span_id} path={c.path} chunkId={c.chunk_id} />
                  ))}
                </div>
              )}
            </div>

            {/* Side B */}
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">View B</div>
              <p className="text-sm text-foreground">{contradiction.side_b!.claim}</p>
              {contradiction.side_b!.citations && contradiction.side_b!.citations.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {contradiction.side_b!.citations.map((c) => (
                    <CitationBadge key={c.span_id} spanId={c.span_id} path={c.path} chunkId={c.chunk_id} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* How to resolve */}
        {contradiction.how_to_resolve && contradiction.how_to_resolve.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">How to resolve</div>
            <ul className="space-y-1">
              {contradiction.how_to_resolve.map((step, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span> {step}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Inline compact version for chat panel */
export function ContradictionInline({ contradictions }: { contradictions: Contradiction[] }) {
  if (!contradictions?.length) return null;
  return (
    <div className="space-y-2">
      {contradictions.map((c, i) => (
        <ContradictionCallout key={i} contradiction={c} index={i} compact />
      ))}
    </div>
  );
}
