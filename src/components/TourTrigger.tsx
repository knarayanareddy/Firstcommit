import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "@/hooks/useTour";

export function TourTrigger() {
  const { getCurrentPageTour, startTour } = useTour();
  const tour = getCurrentPageTour();

  if (!tour) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => startTour(tour.id)}
    >
      <MapPin className="w-3.5 h-3.5" />
      Take a tour
    </Button>
  );
}
