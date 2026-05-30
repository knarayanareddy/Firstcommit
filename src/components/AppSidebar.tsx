import { useState, useRef, useEffect } from "react";
import { Rocket, BookOpen, BarChart3, Settings, ChevronRight, LogOut, BookText, Route, MessageSquareMore, Package, Shield, ShieldCheck, Database, Map, Layout, Globe, Plus, CheckCircle2, Search, MessageCircle, Users, Bookmark, Calendar, Activity, BrainCircuit, HelpCircle, Lightbulb, MapPin, RotateCcw, Layers } from "lucide-react";
import { useTour } from "@/hooks/useTour";
import { TourOverlay } from "@/components/TourOverlay";
import { useFaqSuggestions } from "@/hooks/useFaqSuggestions";
import { useState as useStateSidebar } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBookmarks } from "@/hooks/useBookmarks";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle, ThemeToggleCompact } from "@/components/ThemeToggle";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { PackSelector } from "@/components/PackSelector";
import { useAudiencePrefs } from "@/hooks/useAudiencePrefs";
import { usePack } from "@/hooks/usePack";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationBell";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const roleBadgeColors: Record<string, string> = {
  owner: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  admin: "bg-red-500/15 text-red-400 border-red-500/30",
  author: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  learner: "bg-green-500/15 text-green-400 border-green-500/30",
  read_only: "bg-muted text-muted-foreground border-border",
};

const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "�文" },
  { code: "ko", label: "한�어" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];

function QuickAccessBookmarks({ packPrefix }: { packPrefix: string }) {
  const { bookmarks } = useBookmarks();
  const navigate = useNavigate();
  const recent = bookmarks.slice(0, 3);
  if (recent.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-xs tracking-widest">
        🔖 Quick Access
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="px-3 space-y-1">
          {recent.map((b) => (
            <button
              key={b.id}
              className="w-full text-left px-2 py-1.5 rounded text-xs text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors truncate"
              onClick={() => {
                switch (b.bookmark_type) {
                  case "module_section":
                  case "exercise": {
                    const [modKey] = b.reference_key.split(":");
                    navigate(`${packPrefix}/modules/${modKey}`);
                    break;
                  }
                  case "glossary_term": navigate(`${packPrefix}/glossary`); break;
                  case "path_step": navigate(`${packPrefix}/paths`); break;
                  case "ask_lead_question": navigate(`${packPrefix}/ask-lead`); break;
                  default: break;
                }
              }}
            >
              {b.label ?? b.reference_key}
            </button>
          ))}
          <button
            className="w-full text-left px-2 py-1 text-[10px] text-sidebar-foreground/50 hover:text-sidebar-accent-foreground transition-colors"
            onClick={() => navigate(`${packPrefix}/bookmarks`)}
          >
            View all ({bookmarks.length}) →
          </button>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { signOut, user } = useAuth();
  const { packAccessLevel, accessLevelLabel, hasPackPermission } = useRole();
  const { outputLanguage, audience, depth, glossaryDensity, learnerRole, experienceLevel, mermaidEnabled, updatePrefs } = useAudiencePrefs();
  const { currentPackId, currentPack } = usePack();
  const { suggestions } = useFaqSuggestions();
  const [langOpen, setLangOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [langOpen]);

  const isEnglishOnly = currentPack?.language_mode === "english";

  // Build pack-scoped nav items dynamically
  const packPrefix = `/packs/${currentPackId}`;

  type NavItem = {
    title: string;
    url: string;
    icon: typeof BarChart3;
    minLevel: "read_only" | "learner" | "author" | "admin" | "owner";
    end: boolean;
    badge?: number;
  };

  type NavSection = {
    label: string;
    items: NavItem[];
  };

  const navSections: NavSection[] = [
    {
      label: "Your Onboarding",
      items: [
        { title: "Dashboard", url: packPrefix, icon: BarChart3, minLevel: "read_only", end: true },
        { title: "Roadmap", url: `${packPrefix}/roadmap`, icon: Map, minLevel: "learner", end: false },
        { title: "My Timeline", url: `${packPrefix}/timeline`, icon: Calendar, minLevel: "read_only", end: false },
        { title: "Paths", url: `${packPrefix}/paths`, icon: Route, minLevel: "read_only", end: false },
        { title: "Modules", url: `${packPrefix}/modules`, icon: BookOpen, minLevel: "read_only", end: false },
      ],
    },
    {
      label: "Explore",
      items: [
        { title: "Docs Library", url: `${packPrefix}/docs`, icon: BookOpen, minLevel: "read_only", end: false },
        { title: "Glossary", url: `${packPrefix}/glossary`, icon: BookText, minLevel: "read_only", end: false },
        { title: "FAQ", url: `${packPrefix}/faq`, icon: HelpCircle, minLevel: "read_only", end: false },
        { title: "Ask Your Lead", url: `${packPrefix}/ask-lead`, icon: MessageSquareMore, minLevel: "read_only", end: false },
        { title: "Team", url: `${packPrefix}/team`, icon: Users, minLevel: "read_only", end: false },
        { title: "Discussions", url: `${packPrefix}/discussions`, icon: MessageCircle, minLevel: "read_only", end: false },
        { title: "Saved", url: `${packPrefix}/bookmarks`, icon: Bookmark, minLevel: "read_only", end: false },
      ],
    },
    {
      label: "Content Studio",
      items: [
        { title: "Docs Admin", url: `${packPrefix}/docs-admin`, icon: Database, minLevel: "author", end: false },
        { title: "Sources", url: `${packPrefix}/sources`, icon: Database, minLevel: "author", end: false },
        { title: "Plan", url: `${packPrefix}/plan`, icon: Map, minLevel: "author", end: false },
        { title: "Roadmap Builder", url: `${packPrefix}/roadmap-builder`, icon: Layers, minLevel: "author", end: false },
        { title: "Review", url: `${packPrefix}/review`, icon: CheckCircle2, minLevel: "author", end: false },
        { title: "Content Health", url: `${packPrefix}/health`, icon: Activity, minLevel: "author", end: false },
        { title: "Templates", url: "/templates", icon: Layout, minLevel: "admin", end: false },
      ],
    },
    {
      label: "Insights",
      items: [
        { title: "Analytics", url: `${packPrefix}/analytics`, icon: BarChart3, minLevel: "admin", end: false },
        { title: "Quiz Analytics", url: `${packPrefix}/quiz-analytics`, icon: BrainCircuit, minLevel: "author", end: false },
        { title: "Feedback", url: `${packPrefix}/feedback`, icon: MessageCircle, minLevel: "author", end: false },
        {
          title: "FAQ Suggestions",
          url: `${packPrefix}/faq-suggestions`,
          icon: Lightbulb,
          minLevel: "author",
          end: false,
          badge: suggestions.length > 0 ? suggestions.length : undefined,
        },
        { title: "Trust & Quality", url: `${packPrefix}/trust`, icon: ShieldCheck, minLevel: "author", end: false },
        { title: "Members", url: `${packPrefix}/members`, icon: Shield, minLevel: "admin", end: false },
      ],
    },
    {
      label: "System",
      items: [
        { title: "Data Lifecycle", url: `${packPrefix}/settings/lifecycle`, icon: Database, minLevel: "admin", end: false },
        { title: "Settings", url: "/settings", icon: Settings, minLevel: "read_only", end: false },
      ],
    },
  ];

  const handleLanguageChange = (code: string) => {
    if (isEnglishOnly) {
      toast.info("This pack is configured for English only.");
      setLangOpen(false);
      return;
    }
    updatePrefs.mutate({
      audience,
      depth,
      glossary_density: glossaryDensity,
      learner_role: learnerRole,
      experience_level: experienceLevel,
      output_language: code,
      mermaid_enabled: mermaidEnabled,
    });
    setLangOpen(false);
    const label = LANG_OPTIONS.find(l => l.code === code)?.label || code;
    toast.success(`Language changed to ${label}. New AI responses will use this language.`);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
          <Rocket className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight text-sidebar-accent-foreground">
            RocketBoard
          </span>
        )}
      </div>

      {/* Pack Selector */}
      <div className="px-3 pb-3">
        <PackSelector collapsed={collapsed} />
      </div>

      {/* Search button */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Search className="w-4 h-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <kbd className="hidden sm:inline text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
            </>
          )}
        </button>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <SidebarContent data-tour="sidebar-nav">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => {
            // Feature flag check
            if (item.title === "Roadmap" || item.title === "Roadmap Builder") {
              if (!currentPack?.roadmap_enabled) return false;
            }
            return hasPackPermission(item.minLevel);
          });
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-xs tracking-widest">
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.end}
                          onClick={() => { if (isMobile) setOpenMobile(false); }}
                          className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent min-h-[44px]"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                        >
                          <item.icon className="w-4 h-4 shrink-0" />
                          {!collapsed && <span className="flex-1">{item.title}</span>}
                          {!collapsed && item.badge && (
                            <span className="ml-auto inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                              {item.badge}
                            </span>
                          )}
                          {!collapsed && !item.badge && location.pathname === item.url && (
                            <ChevronRight className="w-3 h-3 ml-auto text-sidebar-primary" />
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {/* Quick Access Bookmarks */}
        {!collapsed && <QuickAccessBookmarks packPrefix={packPrefix} />}
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        {/* Notifications */}
        <div className="flex items-center justify-center gap-2">
          <NotificationBell />
          {/* Help menu */}
          <HelpMenu collapsed={collapsed} />
        </div>
        
        {!collapsed && user && (
          <div className="space-y-1">
            <div className="text-xs text-sidebar-foreground/60 truncate">
              {user.email}
            </div>
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${roleBadgeColors[packAccessLevel] ?? roleBadgeColors.read_only}`}>
              <Shield className="w-2.5 h-2.5" />
              {accessLevelLabel(packAccessLevel)}
            </span>
          </div>
        )}
        {/* Theme mode toggle */}
        {collapsed ? (
          <ThemeToggleCompact />
        ) : (
          <ThemeToggle />
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          {!collapsed && <span>Sign out</span>}
        </button>
        {!collapsed && (
          <div className="flex items-center justify-between text-xs text-sidebar-foreground/30 font-mono">
            <span>v4.0 • RocketBoard</span>
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1 text-sidebar-foreground/50 hover:text-sidebar-accent-foreground transition-colors cursor-pointer"
              >
                <Globe className="w-3 h-3" />
                {outputLanguage.toUpperCase()}
              </button>
              {langOpen && (
                <div className="absolute bottom-full right-0 mb-1 w-36 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
                  {LANG_OPTIONS.map(l => (
                    <button
                      key={l.code}
                      onClick={() => handleLanguageChange(l.code)}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-accent ${outputLanguage === l.code ? "text-primary font-medium" : "text-popover-foreground"}`}
                    >
                      {l.label} <span className="text-muted-foreground ml-1">({l.code.toUpperCase()})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function HelpMenu({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const { getCurrentPageTour, startTour, resetAllTours } = useTour();
  const pageTour = getCurrentPageTour();
  const [shortcutsOpen, setShortcutsOpen] = useStateSidebar(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          {pageTour && (
            <DropdownMenuItem onClick={() => startTour(pageTour.id)}>
              <MapPin className="w-4 h-4 mr-2" /> Retake Page Tour
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => navigate("/help")}>
            <BookOpen className="w-4 h-4 mr-2" /> Help Center
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
            ⌨️ <span className="ml-2">Keyboard Shortcuts</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { resetAllTours(); toast.success("All tours reset. They'll show again on next visit."); }}>
            <RotateCcw className="w-4 h-4 mr-2" /> Reset All Tours
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Keyboard shortcuts modal */}
      {shortcutsOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/70 backdrop-blur-sm" onClick={() => setShortcutsOpen(false)}>
          <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-[380px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-foreground mb-4">⌨️ Keyboard Shortcuts</h3>
            <div className="space-y-2 text-sm">
              {[
                ["Cmd/Ctrl + S", "Trigger Platform Content Sync"],
                ["Cmd/Ctrl + K", "Search"],
                ["Cmd/Ctrl + D", "Bookmark current content"],
                ["Escape", "Close overlay/modal"],
                ["Arrow keys", "Navigate tour steps"],
                ["?", "Show keyboard shortcuts"],
              ].map(([key, desc]) => (
                <div key={key} className="flex justify-between">
                  <kbd className="text-xs font-mono bg-muted px-2 py-0.5 rounded border border-border text-muted-foreground">{key}</kbd>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShortcutsOpen(false)} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
