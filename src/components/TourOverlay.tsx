import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tour } from "@/lib/tour-system";

interface TourOverlayProps {
  tour: Tour;
  onComplete: () => void;
  onSkip: () => void;
}

export function TourOverlay({ tour, onComplete, onSkip }: TourOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const targetElementRef = useRef<HTMLElement | null>(null);

  const step = tour.steps[stepIndex];
  const isLast = stepIndex === tour.steps.length - 1;

  useEffect(() => {
    const cleanupElevatedElement = () => {
      if (targetElementRef.current) {
        targetElementRef.current.style.removeProperty("z-index");
        targetElementRef.current.style.removeProperty("position");
        targetElementRef.current.style.removeProperty("pointer-events");
        if ((targetElementRef.current as any)._tourClickHandler) {
          targetElementRef.current.removeEventListener('click', (targetElementRef.current as any)._tourClickHandler);
          delete (targetElementRef.current as any)._tourClickHandler;
        }
        targetElementRef.current = null;
      }
    };

    cleanupElevatedElement();
    setTargetRect(null);

    if (!step?.target) {
      return;
    }

    const selector = step.target;
    let animationFrameId: number | null = null;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;
    let lastRectStr = "";
    let hasScrolled = false;
    let disposed = false;

    const elevateElement = (el: HTMLElement) => {
      const computedStyle = window.getComputedStyle(el);
      if (computedStyle.position === 'static') {
        el.style.setProperty("position", "relative", "important");
      }
      el.style.setProperty("z-index", "10005", "important");
      el.style.setProperty("pointer-events", "auto", "important");
      targetElementRef.current = el;
    };

    const trackPosition = () => {
      if (disposed) return;
      const el = targetElementRef.current;
      if (!el || !document.contains(el)) {
        // Element disappeared — stop tracking, rect stays at last known position
        return;
      }

      const rect = el.getBoundingClientRect();
      const currentRectStr = `${rect.x},${rect.y},${rect.width},${rect.height}`;
      if (currentRectStr !== lastRectStr && rect.width > 0 && rect.height > 0) {
        lastRectStr = currentRectStr;
        setTargetRect(rect);
      }

      animationFrameId = requestAnimationFrame(trackPosition);
    };

    // Phase 1: Poll for the element using setInterval (more reliable than rAF for discovery)
    let pollAttempts = 0;
    const MAX_POLL_ATTEMPTS = 50; // 50 * 100ms = 5 seconds

    const tryFindElement = () => {
      if (disposed) return;
      pollAttempts++;

      const el = document.querySelector(selector) as HTMLElement;
      if (el) {
        // Found it! Stop polling, start tracking
        if (pollIntervalId) {
          clearInterval(pollIntervalId);
          pollIntervalId = null;
        }

        const rect = el.getBoundingClientRect();

        elevateElement(el);

        // Scroll into view
        el.scrollIntoView({ behavior: "smooth", block: "center" });

        // Attach click listener if waitForClick is true
        if (step.waitForClick) {
          const clickHandler = () => {
             // Let the click happen natively, but also advance the tour
             setTimeout(() => {
               if (!disposed) {
                 if (isLast) onComplete();
                 else setStepIndex((i) => i + 1);
               }
             }, 50);
          };
          el.addEventListener('click', clickHandler);
          (el as any)._tourClickHandler = clickHandler;
        }

        // Start continuous position tracking
        trackPosition();
        return;
      }


      if (pollAttempts >= MAX_POLL_ATTEMPTS) {
        // Give up — element never appeared
        console.warn(`[TourOverlay] Could not find element: ${selector} after ${MAX_POLL_ATTEMPTS * 100}ms`);
        if (pollIntervalId) {
          clearInterval(pollIntervalId);
          pollIntervalId = null;
        }
      }
    };

    // Try immediately, then every 100ms
    tryFindElement();
    if (!targetElementRef.current) {
      pollIntervalId = setInterval(tryFindElement, 100);
    }

    return () => {
      disposed = true;
      if (pollIntervalId) clearInterval(pollIntervalId);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      cleanupElevatedElement();
    };
  }, [step?.target, stepIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      if ((e.key === "ArrowRight" || e.key === "Enter") && !step?.waitForClick) {
        if (isLast) onComplete();
        else setStepIndex((i) => i + 1);
      }
      if (e.key === "ArrowLeft" && stepIndex > 0) setStepIndex((i) => i - 1);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isLast, onComplete, onSkip, stepIndex, step?.waitForClick]);

  const padding = step?.spotlightPadding ?? 8;

  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        marginLeft: "-170px",  // half of w-[340px]
        marginTop: "-100px",   // approximate half-height
        zIndex: 10006,
        maxWidth: 360,
      };
    }

    const pos = step?.position || "bottom";
    const gap = 12;
    const style: React.CSSProperties = { position: "fixed", zIndex: 10006, maxWidth: 360 };

    switch (pos) {
      case "top":
        style.bottom = `${window.innerHeight - targetRect.top + gap + padding}px`;
        style.left = `${targetRect.left + targetRect.width / 2}px`;
        style.transform = "translateX(-50%)";
        break;
      case "left":
        style.top = `${targetRect.top + targetRect.height / 2}px`;
        style.right = `${window.innerWidth - targetRect.left + gap + padding}px`;
        style.transform = "translateY(-50%)";
        break;
      case "right":
        style.top = `${targetRect.top + targetRect.height / 2}px`;
        style.left = `${targetRect.right + gap + padding}px`;
        style.transform = "translateY(-50%)";
        break;
      default: // bottom
        style.top = `${targetRect.bottom + gap + padding}px`;
        style.left = `${targetRect.left + targetRect.width / 2}px`;
        style.transform = "translateX(-50%)";
        break;
    }

    return style;
  };

  // SVG Cutout values
  const x = targetRect ? targetRect.left - padding : 0;
  const y = targetRect ? targetRect.top - padding : 0;
  const w = targetRect ? targetRect.width + padding * 2 : 0;
  const h = targetRect ? targetRect.height + padding * 2 : 0;

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000]"
        style={{ pointerEvents: "none" }}
      >

        {/*
          SVG-based masking system.
          We use fillRule="evenodd" to punch a hole exactly where the target is.
          Since SVG <path> elements only capture clicks on painted areas,
          the "hole" remains transparent to clicks (pass-through),
          while the dark mask captures clicks and triggers onSkip.
        */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "auto" }}
          onClick={onSkip}
        >
          {targetRect ? (
            <path
              d={`M-10000,-10000 H20000 V20000 H-10000 Z M${x},${y} V${y + h} H${x + w} V${y} Z`}
              fill="rgba(0, 0, 0, 0.75)"
              fillRule="evenodd"
            />
          ) : (
            <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.75)" />
          )}

          {/* Spotlight glowing border */}
          {targetRect && (
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={8}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              style={{ pointerEvents: "none" }}
            />
          )}
        </svg>

        {/* Tooltip card */}
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          style={{ ...getTooltipStyle(), pointerEvents: "auto" }}
          className="bg-card border border-border rounded-xl shadow-2xl p-4 w-[340px]"
        >
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-muted-foreground">
              📍 Step {stepIndex + 1} of {tour.steps.length}
            </span>
            <button
              onClick={onSkip}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close tour"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Title & content */}
          <h4 className="text-sm font-semibold text-foreground mb-1">{step.title}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
            {step.content.split(/\*\*(.*?)\*\*/g).map((part, i) =>
              i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : part
            )}
          </p>
          {step.waitForClick && (
            <div className="mt-3 text-[10px] font-semibold text-primary animate-pulse flex items-center gap-1.5">
              <span>👉</span> Click the highlighted element to continue
            </div>
          )}

          {/* Progress dots & buttons */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-1">
              {tour.steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === stepIndex ? "bg-primary" : i < stepIndex ? "bg-primary/40" : "bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setStepIndex((i) => i - 1)}
                >
                  <ChevronLeft className="w-3 h-3" /> Back
                </Button>
              )}
              {!step.waitForClick && (
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    if (isLast) onComplete();
                    else setStepIndex((i) => i + 1);
                  }}
                >
                  {isLast ? "Done" : "Next"} {!isLast && <ChevronRight className="w-3 h-3" />}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
