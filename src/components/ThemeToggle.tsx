import { Sun, Monitor, Moon } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme, ThemeMode } from "@/hooks/useTheme";

const MODES: { key: ThemeMode; icon: typeof Sun; label: string }[] = [
  { key: "light", icon: Sun, label: "Light" },
  { key: "system", icon: Monitor, label: "System" },
  { key: "dark", icon: Moon, label: "Dark" },
];

/** Full segmented toggle for settings / expanded sidebar */
export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <div className="inline-flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5">
      {MODES.map((m) => {
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
            }`}
          >
            {active && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 bg-background rounded-md shadow-sm border border-border"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <m.icon className="w-3.5 h-3.5" />
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Compact icon-only button that cycles modes (for collapsed sidebar) */
export function ThemeToggleCompact() {
  const { mode, setMode, resolvedMode } = useTheme();

  const cycleMode = () => {
    const order: ThemeMode[] = ["light", "system", "dark"];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
  };

  const Icon = resolvedMode === "dark" ? Moon : Sun;

  return (
    <button
      onClick={cycleMode}
      className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title={`Theme: ${mode}`}
    >
      <motion.span
        key={resolvedMode}
        initial={{ rotate: -30, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Icon className="w-4 h-4" />
      </motion.span>
    </button>
  );
}
