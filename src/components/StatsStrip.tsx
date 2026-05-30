import { motion } from "framer-motion";
import { Flame, Award, Zap } from "lucide-react";

interface StatsStripProps {
  completedModules: number;
  totalSectionsRead: number;
  totalSections: number;
  /** Total number of modules (generated or static). */
  totalModules?: number;
}

export function StatsStrip({ completedModules, totalSectionsRead, totalSections, totalModules }: StatsStripProps) {
  const moduleCount = totalModules ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Award className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-lg font-bold text-card-foreground">{completedModules}/{moduleCount}</p>
          <p className="text-xs text-muted-foreground">Modules Done</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25 }}
        className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-lg font-bold text-card-foreground">{totalSectionsRead}/{totalSections}</p>
          <p className="text-xs text-muted-foreground">Sections Read</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.35 }}
        className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-lg bg-track-infra/10 flex items-center justify-center">
          <Flame className="w-5 h-5 text-track-infra" />
        </div>
        <div>
          <p className="text-lg font-bold text-card-foreground">{completedModules}</p>
          <p className="text-xs text-muted-foreground">Streak 🔥</p>
        </div>
      </motion.div>
    </div>
  );
}
