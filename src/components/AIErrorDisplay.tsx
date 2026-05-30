import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, AlertCircle, WifiOff, CreditCard, Clock, HelpCircle, ChevronDown, Search, RefreshCw } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { AIError, AIErrorCode } from "@/lib/ai-errors";
import { useTour } from "@/hooks/useTour";

interface AIErrorDisplayProps {
  error: AIError;
  compact?: boolean;
  onRetry?: () => void;
  onSearchQuery?: (query: string) => void;
}

const RETRYABLE: Set<AIErrorCode> = new Set(["insufficient_evidence", "invalid_output", "rate_limited", "network_error"]);
const RATE_LIMIT_COUNTDOWN = 30;

const ERROR_CONFIG: Record<AIErrorCode, {
  icon: typeof AlertTriangle;
  color: string;
  bg: string;
  border: string;
  title: string;
  defaultMessage: string;
}> = {
  insufficient_evidence: {
    icon: Search,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    title: "Not Enough Evidence",
    defaultMessage: "Not enough source data to answer this. Try adding more sources to your pack.",
  },
  invalid_input: {
    icon: AlertCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    title: "Invalid Request",
    defaultMessage: "There was a problem with the request.",
  },
  conflicting_instruction: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    title: "Conflicting Instructions",
    defaultMessage: "Conflicting instructions detected.",
  },
  unsupported_task: {
    icon: HelpCircle,
    color: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
    title: "Not Available",
    defaultMessage: "This feature is not yet available.",
  },
  invalid_output: {
    icon: AlertCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    title: "Unexpected Response",
    defaultMessage: "The AI produced an unexpected response. Please try again.",
  },
  rate_limited: {
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    title: "Too Many Requests",
    defaultMessage: "Too many requests. Please wait a moment.",
  },
  credit_exhausted: {
    icon: CreditCard,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    title: "Credits Exhausted",
    defaultMessage: "AI credits exhausted. Contact your admin.",
  },
  network_error: {
    icon: WifiOff,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    title: "Network Error",
    defaultMessage: "Network error. Check your connection and try again.",
  },
};

export function AIErrorDisplay({ error, compact = false, onRetry, onSearchQuery }: AIErrorDisplayProps) {
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [countdown, setCountdown] = useState(error.code === "rate_limited" ? RATE_LIMIT_COUNTDOWN : 0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config = ERROR_CONFIG[error.code] || ERROR_CONFIG.invalid_output;
  const Icon = config.icon;
  const isRetryable = RETRYABLE.has(error.code) && !!onRetry;
  const retryDisabled = error.code === "rate_limited" && countdown > 0;

  // Countdown for rate-limited
  useEffect(() => {
    if (error.code !== "rate_limited") return;
    setCountdown(RATE_LIMIT_COUNTDOWN);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [error.code]);

  // Programmatically trigger tour for retryable errors
  const { startTour, shouldShowTour } = useTour();
  useEffect(() => {
    if (!compact && isRetryable && shouldShowTour("ai-error-recovery")) {
      const t = setTimeout(() => {
        startTour("ai-error-recovery");
      }, 600); // Wait for animation
      return () => clearTimeout(t);
    }
  }, [compact, isRetryable, shouldShowTour, startTour]);

  const handleRetry = useCallback(() => {
    if (retryDisabled || !onRetry) return;
    onRetry();
  }, [retryDisabled, onRetry]);

  return (
    <AnimatePresence>
      <motion.div
        data-tour="ai-error-display"
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className={`rounded-xl border ${config.border} ${config.bg} ${compact ? "px-3 py-2" : "p-4"}`}
      >
        <div className="flex items-start gap-2.5">
          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
          <div className="flex-1 min-w-0">
            {!compact && (
              <h4 className={`text-sm font-semibold ${config.color} mb-0.5`}>{config.title}</h4>
            )}
            <p className={`${compact ? "text-xs" : "text-sm"} text-foreground/80`}>
              {error.message || config.defaultMessage}
            </p>

            {/* Suggested search queries */}
            {error.suggestedSearchQueries.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {error.suggestedSearchQueries.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => onSearchQuery?.(q)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-background/50 border border-border hover:border-primary/30 hover:bg-primary/5 text-foreground/70 hover:text-foreground transition-colors"
                  >
                    <Search className="w-2.5 h-2.5" />
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Retry button */}
            {isRetryable && (
              <div className="mt-2" data-tour="ai-error-retry">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetry}
                  disabled={retryDisabled}
                  className="gap-1.5 text-xs h-7"
                >
                  <RefreshCw className="w-3 h-3" />
                  {retryDisabled ? `Retry in ${countdown}s` : "Retry"}
                </Button>
              </div>
            )}

            {/* Warnings */}
            {error.warnings.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setWarningsOpen(!warningsOpen)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${warningsOpen ? "rotate-180" : ""}`} />
                  {error.warnings.length} warning{error.warnings.length > 1 ? "s" : ""}
                </button>
                <AnimatePresence>
                  {warningsOpen && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden list-disc list-inside mt-1 space-y-0.5"
                    >
                      {error.warnings.map((w, i) => (
                        <li key={i} className="text-xs text-muted-foreground">{w}</li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
