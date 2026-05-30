import { useState } from "react";
import { Menu, Settings, LogOut, User, Search } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/components/ui/sidebar";
import { useNavigate, useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/NotificationBell";

const PAGE_TITLES: Record<string, string> = {
  modules: "Modules",
  glossary: "Glossary",
  paths: "Paths",
  "ask-lead": "Ask Your Lead",
  sources: "Sources",
  plan: "Plan",
  review: "Review",
  members: "Members",
  settings: "Settings",
  templates: "Templates",
  analytics: "Analytics",
};

function getPageTitle(pathname: string, packTitle?: string): string {
  const segments = pathname.split("/").filter(Boolean);
  // /packs/:id/xxx → xxx
  if (segments[0] === "packs" && segments.length >= 3) {
    const page = segments[2];
    return PAGE_TITLES[page] || "Dashboard";
  }
  // /settings, /templates
  const last = segments[segments.length - 1];
  return PAGE_TITLES[last] || packTitle || "RocketBoard";
}

export function MobileTopBar() {
  const isMobile = useIsMobile();
  const { toggleSidebar } = useSidebar();
  const { signOut, user } = useAuth();
  const { currentPack } = usePack();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  if (!isMobile) return null;

  const pageTitle = getPageTitle(location.pathname, currentPack?.title);
  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "U";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-3 bg-card/95 backdrop-blur-sm border-b border-border">
      {/* Hamburger */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center w-10 h-10 rounded-lg text-foreground hover:bg-muted transition-colors touch-manipulation"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Title */}
      <span className="text-sm font-semibold text-foreground truncate max-w-[40vw]">
        {pageTitle}
      </span>

      {/* Notifications & Avatar */}
      <div className="flex items-center gap-2">
        <button onClick={() => setSearchOpen(true)} className="flex items-center justify-center w-9 h-9 rounded-lg text-foreground hover:bg-muted transition-colors touch-manipulation" aria-label="Search">
          <Search className="w-4.5 h-4.5" />
        </button>
        <NotificationBell compact />
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        
        {/* Avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary text-xs font-bold touch-manipulation">
            {initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2">
            <Settings className="w-4 h-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive">
            <LogOut className="w-4 h-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
