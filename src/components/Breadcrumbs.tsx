import { useLocation, Link } from "react-router-dom";
import { usePack } from "@/hooks/usePack";
import { ChevronRight, Home } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const ROUTE_LABELS: Record<string, string> = {
  modules: "Modules",
  glossary: "Glossary",
  paths: "Paths",
  "ask-lead": "Ask Lead",
  sources: "Sources",
  plan: "Plan",
  review: "Review",
  analytics: "Analytics",
  members: "Members",
  feedback: "Feedback",
  team: "Team",
  bookmarks: "Saved",
  timeline: "Timeline",
  health: "Content Health",
  settings: "Settings",
  templates: "Templates",
  packs: "Packs",
};

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const { currentPack } = usePack();
  const isMobile = useIsMobile();

  const segments = pathname.split("/").filter(Boolean);

  // Build breadcrumb items
  const crumbs: { label: string; href: string }[] = [];

  if (segments[0] === "packs" && segments[1]) {
    crumbs.push({ label: currentPack?.title ?? "Pack", href: `/packs/${segments[1]}` });

    for (let i = 2; i < segments.length; i++) {
      const seg = segments[i];
      const label = ROUTE_LABELS[seg] ?? seg;
      const href = "/" + segments.slice(0, i + 1).join("/");
      crumbs.push({ label, href });
    }
  } else {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const label = ROUTE_LABELS[seg] ?? seg;
      const href = "/" + segments.slice(0, i + 1).join("/");
      crumbs.push({ label, href });
    }
  }

  if (crumbs.length <= 1) return null;

  // Mobile: show last 2 only
  const displayCrumbs = isMobile ? crumbs.slice(-2) : crumbs;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground mb-4 overflow-hidden">
      {!isMobile && (
        <>
          <Link to="/" className="hover:text-foreground transition-colors shrink-0">
            <Home className="w-3.5 h-3.5" />
          </Link>
          <ChevronRight className="w-3 h-3 shrink-0" />
        </>
      )}
      {isMobile && crumbs.length > 2 && (
        <>
          <span>…</span>
          <ChevronRight className="w-3 h-3 shrink-0" />
        </>
      )}
      {displayCrumbs.map((crumb, i) => {
        const isLast = i === displayCrumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1 min-w-0">
            {isLast ? (
              <span className="text-foreground font-medium truncate">{crumb.label}</span>
            ) : (
              <>
                <Link to={crumb.href} className="hover:text-foreground transition-colors truncate max-w-[120px]">
                  {crumb.label}
                </Link>
                <ChevronRight className="w-3 h-3 shrink-0" />
              </>
            )}
          </span>
        );
      })}
    </nav>
  );
}
