import { useMemo } from "react";
import { motion } from "framer-motion";

interface SectionMiniMapProps {
  sections: { id: string; heading: string }[];
  readSections: Set<string>;
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export function SectionMiniMap({ sections, readSections, currentIndex, onNavigate }: SectionMiniMapProps) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">Sections</p>
      {sections.map((s, i) => {
        const isRead = readSections.has(s.id);
        const isCurrent = i === currentIndex;
        return (
          <button
            key={s.id}
            onClick={() => onNavigate(i)}
            className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-xs transition-colors ${
              isCurrent
                ? "bg-primary/10 text-primary font-medium"
                : isRead
                ? "text-muted-foreground hover:text-foreground"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              isCurrent ? "bg-primary" : isRead ? "bg-primary/40" : "bg-muted-foreground/30"
            }`} />
            <span className="truncate">{s.heading}</span>
          </button>
        );
      })}
    </div>
  );
}
