import { useTheme, THEMES, ThemeMeta } from "@/hooks/useTheme";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/ThemeToggle";

function ThemeCard({ meta, active, onClick }: { meta: ThemeMeta; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative text-left p-3 rounded-lg border transition-all ${
        active
          ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
          : "border-border hover:border-primary/20 bg-card/50"
      }`}
    >
      {active && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2"
        >
          <CheckCircle2 className="w-4 h-4 text-primary" />
        </motion.div>
      )}
      {/* Color preview dots */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="w-4 h-4 rounded-full border border-border/50"
          style={{ backgroundColor: meta.preview.bg }}
        />
        <span
          className="w-4 h-4 rounded-full border border-border/50"
          style={{ backgroundColor: meta.preview.primary }}
        />
        <span
          className="w-4 h-4 rounded-full border border-border/50"
          style={{ backgroundColor: meta.preview.accent }}
        />
      </div>
      <span className="text-sm font-medium text-foreground">{meta.label}</span>
      <p className="text-xs text-muted-foreground mt-0.5 pr-5">{meta.description}</p>
    </button>
  );
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      {/* Light/Dark/System mode toggle */}
      <div>
        <label className="text-sm font-medium text-card-foreground mb-2 block">Appearance</label>
        <ThemeToggle />
      </div>

      {/* Color theme grid */}
      <div>
        <label className="text-sm font-medium text-card-foreground mb-2 block">Color Theme</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.key}
              meta={t}
              active={theme === t.key}
              onClick={() => setTheme(t.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
