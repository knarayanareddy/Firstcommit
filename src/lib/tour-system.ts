export type TourStep = {
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  action?: 'click' | 'scroll' | null;
  spotlightPadding?: number;
  waitForClick?: boolean;
};

export type Tour = {
  id: string;
  pagePattern?: string; // Optional: if omitted, tour can only be started programmatically
  requiredRole?: string;
  steps: TourStep[];
};

export function matchesTourRoute(tour: Tour, pathname: string): boolean {
  if (!tour.pagePattern) return false; // no pattern = never auto-triggered
  const regex = new RegExp(tour.pagePattern);
  return regex.test(pathname);
}
