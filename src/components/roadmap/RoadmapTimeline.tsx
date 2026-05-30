import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RoadmapItem, RoadmapPhase, RoadmapItemStatus } from "@/hooks/useRoadmap";
import { RoadmapItemCard } from "@/components/roadmap/RoadmapItemCard";
import { Lock, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface RoadmapTimelineProps {
  items: RoadmapItem[];
  packId: string;
  assignmentId: string;
}

const PHASES: { id: RoadmapPhase; label: string; deadline: string }[] = [
  { id: 'day_1_30', label: 'Day 1–30', deadline: 'First 30 days' },
  { id: 'day_31_60', label: 'Day 31–60', deadline: 'Next 30 days' },
  { id: 'day_61_90', label: 'Day 61–90', deadline: 'Final 30 days' },
];

export function RoadmapTimeline({ items, packId, assignmentId }: RoadmapTimelineProps) {
  // Group items by phase (based on playlist phase if available, or just use items)
  // v1 simplicity: we assume the items passed belong to the playlist's phase
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {PHASES.map((phase, idx) => (
        <div 
          key={phase.id} 
          className="flex flex-col h-full"
          data-tour={`roadmap-phase-${phase.id.replace(/_/g, '-')}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{phase.label}</h3>
              <p className="text-[11px] text-muted-foreground">{phase.deadline}</p>
            </div>
            {/* Simple progress dot for phase */}
            <div className="w-2 h-2 rounded-full bg-primary/20" />
          </div>
          
          <div className="flex-1 space-y-4 min-h-[500px] bg-muted/30 rounded-xl p-3 border border-dashed border-border/50">
            {/* In a real implementation, we'd filter items by phase here */}
            {/* For now, we'll just show items for the phase if the playlist matches */}
            <AnimatePresence mode="popLayout">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <RoadmapItemCard 
                    item={item} 
                    packId={packId} 
                    assignmentId={assignmentId} 
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            
            {items.length === 0 && (
              <div className="h-full flex items-center justify-center text-muted-foreground/30 italic text-xs">
                No items assigned
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
