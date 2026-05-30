import { useState } from "react";
import { Star } from "lucide-react";
import { useContentFeedback } from "@/hooks/useContentFeedback";
import { toast } from "sonner";

interface ModuleRatingProps {
  moduleKey: string;
}

export function ModuleRating({ moduleKey }: ModuleRatingProps) {
  const { submitRating, getMyRatingForModule, getAverageRating } = useContentFeedback(moduleKey);
  const [hoveredStar, setHoveredStar] = useState(0);
  const myRating = getMyRatingForModule(moduleKey);
  const avg = getAverageRating(moduleKey);

  const handleRate = (rating: number) => {
    submitRating.mutate(
      { moduleKey, rating },
      { onSuccess: () => toast.success("Rating saved") }
    );
  };

  return (
    <div className="flex flex-col items-center gap-2 py-4 px-6 bg-card border border-border rounded-xl">
      <p className="text-sm font-medium text-foreground">Rate this module</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => {
          const filled = hoveredStar ? n <= hoveredStar : n <= (myRating ?? 0);
          return (
            <button
              key={n}
              onClick={() => handleRate(n)}
              onMouseEnter={() => setHoveredStar(n)}
              onMouseLeave={() => setHoveredStar(0)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={`w-6 h-6 transition-colors ${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
              />
            </button>
          );
        })}
      </div>
      {avg && (
        <p className="text-[11px] text-muted-foreground">
          Avg: {avg.avg}/5 ({avg.count} rating{avg.count !== 1 ? "s" : ""})
        </p>
      )}
    </div>
  );
}
