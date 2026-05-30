import { forwardRef } from "react";

const TRACK_COLORS = [
  { bg: "bg-primary/15", text: "text-primary", border: "border-primary/30" },
  { bg: "bg-accent/15", text: "text-accent", border: "border-accent/30" },
  { bg: "bg-destructive/15", text: "text-destructive", border: "border-destructive/30" },
  { bg: "bg-secondary", text: "text-secondary-foreground", border: "border-border" },
  { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
  { bg: "bg-accent/10", text: "text-accent", border: "border-accent/20" },
];

function hashTrackKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface TrackBadgeProps {
  track: string;
  title?: string;
}

export const TrackBadge = forwardRef<HTMLSpanElement, TrackBadgeProps>(
  ({ track, title }, ref) => {
    const colorIdx = hashTrackKey(track) % TRACK_COLORS.length;
    const colors = TRACK_COLORS[colorIdx];
    const label = title || track.replace(/[-_]/g, " ");

    return (
      <span
        ref={ref}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
      >
        {label}
      </span>
    );
  }
);

TrackBadge.displayName = "TrackBadge";
