import { Module } from "@/data/onboarding-data";
import { Clock, ChevronRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { TrackBadge } from "./TrackBadge";

interface ModuleCardProps {
  module: Module;
  index: number;
  progress: number; // 0-100
  onClick: () => void;
}

export function ModuleCard({ module, index, progress, onClick }: ModuleCardProps) {
  const allTracks = [...new Set(module.sections.flatMap((s) => s.tracks))];
  const isComplete = progress === 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      onClick={onClick}
      className="group relative bg-card border border-border rounded-xl p-6 cursor-pointer transition-all duration-300 hover:border-primary/40 hover:glow-border"
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl overflow-hidden bg-muted">
        <div
          className="h-full gradient-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-start justify-between mb-4 mt-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{module.icon}</span>
          <div>
            <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
              {module.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{module.estimatedMinutes} min</span>
              <span>•</span>
              <span>{module.sections.length} sections</span>
              <span>•</span>
              <span className={`capitalize ${
                module.difficulty === "beginner" ? "text-green-500" :
                module.difficulty === "intermediate" ? "text-yellow-500" : "text-red-500"
              }`}>{module.difficulty}</span>
            </div>
          </div>
        </div>
        {isComplete ? (
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {module.description}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {allTracks.map((t) => (
          <TrackBadge key={t} track={t} />
        ))}
      </div>
    </motion.div>
  );
}
