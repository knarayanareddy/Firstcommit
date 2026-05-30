import { useState, useEffect, lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { GlobalSearch } from "@/components/GlobalSearch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PackProvider } from "@/hooks/usePack";
import { ThemeProvider } from "@/hooks/useTheme";
import { useUserOrgs } from "@/hooks/useUserOrgs";
import { usePacks } from "@/hooks/usePacks";
import { useAcceptInvites } from "@/hooks/useAcceptInvites";
import { useTour } from "@/hooks/useTour";
import { TourOverlay } from "@/components/TourOverlay";
const Index = lazy(() => import("./pages/Index"));
const Modules = lazy(() => import("./pages/Modules"));
const ModuleView = lazy(() => import("./pages/ModuleView"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const GlossaryPage = lazy(() => import("./pages/GlossaryPage"));
const PathsPage = lazy(() => import("./pages/PathsPage"));
const AskLeadPage = lazy(() => import("./pages/AskLeadPage"));
const PacksPage = lazy(() => import("./pages/PacksPage"));
const CreatePackPage = lazy(() => import("./pages/CreatePackPage"));
const PackMembersPage = lazy(() => import("./pages/PackMembersPage"));
const SourcesPage = lazy(() => import("./pages/SourcesPage"));
const PlanPage = lazy(() => import("./pages/PlanPage"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
const TemplateDetailPage = lazy(() => import("./pages/TemplateDetailPage"));
const OnboardingWizard = lazy(() => import("./pages/OnboardingWizard"));
const ReviewPage = lazy(() => import("./pages/ReviewPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const FeedbackPage = lazy(() => import("./pages/FeedbackPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const BookmarksPage = lazy(() => import("./pages/BookmarksPage"));
const TimelinePage = lazy(() => import("./pages/TimelinePage"));
const ContentHealthPage = lazy(() => import("./pages/ContentHealthPage"));
const QuizAnalyticsPage = lazy(() => import("./pages/QuizAnalyticsPage"));
const DiscussionsPage = lazy(() => import("./pages/DiscussionsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const SandboxModulePage = lazy(() => import("./pages/SandboxModulePage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const FaqSuggestionsPage = lazy(() => import("./pages/FaqSuggestionsPage"));
const RoadmapPage = lazy(() => import("./pages/RoadmapPage"));
const RoadmapBuilder = lazy(() => import("./pages/RoadmapBuilder"));
const TrustDashboard = lazy(() => import("./pages/TrustDashboard"));
const LifecycleSettings = lazy(() => import("./pages/LifecycleSettings"));
const RequestDrilldown = lazy(() => import("./pages/RequestDrilldown"));
const DocsLibraryPage = lazy(() => import("./pages/DocsLibraryPage"));
const DocDetailPage = lazy(() => import("./pages/DocDetailPage"));
const DocsAdminPage = lazy(() => import("./pages/DocsAdminPage"));
const ProposalsPage = lazy(() => import("./pages/admin/ProposalsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // was 0 -> refetch churn on every navigation
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Root route resolver: redirect based on org/pack membership */
function RootRedirect() {
  const { hasOrgs, isLoading: orgsLoading } = useUserOrgs();
  const { packs, isLoading: packsLoading } = usePacks();

  if (orgsLoading || packsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
      </div>
    );
  }

  if (!hasOrgs) return <Navigate to="/onboarding" replace />;
  if (packs.length === 0) return <Navigate to="/packs/new" replace />;
  if (packs.length === 1) return <Navigate to={`/packs/${packs[0].id}`} replace />;
  return <Navigate to="/packs" replace />;
}

/** Accept pending invites on auth */
function InviteAcceptor({ children }: { children: React.ReactNode }) {
  useAcceptInvites();
  return <>{children}</>;
}

function GlobalSearchShortcut() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Cmd+D / Ctrl+D: bookmark current content
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("bookmark-current"));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />;
}

function TourManager() {
  const { activeTour, completeTour } = useTour();
  return (
    <>
      {activeTour && (
        <TourOverlay
          tour={activeTour}
          onComplete={() => completeTour(activeTour.id)}
          onSkip={() => completeTour(activeTour.id)}
        />
      )}
    </>
  );
}

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PackProvider>
        <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineIndicator />
          <BrowserRouter>
            <GlobalSearchShortcut />
            <TourManager />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background dark"><div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" /></div>}>
            <Routes>
              <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute><InviteAcceptor><OnboardingWizard /></InviteAcceptor></ProtectedRoute>} />

              {/* Root redirect */}
              <Route path="/" element={<ProtectedRoute><InviteAcceptor><RootRedirect /></InviteAcceptor></ProtectedRoute>} />

              {/* Pack list & creation */}
              <Route path="/packs" element={<ProtectedRoute><InviteAcceptor><PacksPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/new" element={<ProtectedRoute><InviteAcceptor><CreatePackPage /></InviteAcceptor></ProtectedRoute>} />

              {/* Pack-scoped routes */}
              <Route path="/packs/:packId" element={<ProtectedRoute><InviteAcceptor><Index /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/modules" element={<ProtectedRoute><InviteAcceptor><Modules /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/modules/:moduleId" element={<ProtectedRoute><InviteAcceptor><ModuleView /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/glossary" element={<ProtectedRoute><InviteAcceptor><GlossaryPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/paths" element={<ProtectedRoute><InviteAcceptor><PathsPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/ask-lead" element={<ProtectedRoute><InviteAcceptor><AskLeadPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/sources" element={<ProtectedRoute><InviteAcceptor><SourcesPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/plan" element={<ProtectedRoute><InviteAcceptor><PlanPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/members" element={<ProtectedRoute><InviteAcceptor><PackMembersPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/review" element={<ProtectedRoute><InviteAcceptor><ReviewPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/analytics" element={<ProtectedRoute><InviteAcceptor><AnalyticsPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/feedback" element={<ProtectedRoute><InviteAcceptor><FeedbackPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/team" element={<ProtectedRoute><InviteAcceptor><TeamPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/bookmarks" element={<ProtectedRoute><InviteAcceptor><BookmarksPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/timeline" element={<ProtectedRoute><InviteAcceptor><TimelinePage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/health" element={<ProtectedRoute><InviteAcceptor><ContentHealthPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/quiz-analytics" element={<ProtectedRoute><InviteAcceptor><QuizAnalyticsPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/discussions" element={<ProtectedRoute><InviteAcceptor><DiscussionsPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/sandbox" element={<ProtectedRoute><InviteAcceptor><SandboxModulePage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/faq" element={<ProtectedRoute><InviteAcceptor><FaqPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/faq-suggestions" element={<ProtectedRoute><InviteAcceptor><FaqSuggestionsPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/roadmap" element={<ProtectedRoute><InviteAcceptor><RoadmapPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/roadmap-builder" element={<ProtectedRoute><InviteAcceptor><RoadmapBuilder /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/trust" element={<ProtectedRoute><InviteAcceptor><TrustDashboard /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/trust/requests/:requestId" element={<ProtectedRoute><InviteAcceptor><RequestDrilldown /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/settings/lifecycle" element={<ProtectedRoute><InviteAcceptor><LifecycleSettings /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/docs" element={<ProtectedRoute><InviteAcceptor><DocsLibraryPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/docs/:slug" element={<ProtectedRoute><InviteAcceptor><DocDetailPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/docs-admin" element={<ProtectedRoute><InviteAcceptor><DocsAdminPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/packs/:packId/admin/proposals" element={<ProtectedRoute><InviteAcceptor><ProposalsPage /></InviteAcceptor></ProtectedRoute>} />

              {/* Global routes */}
              <Route path="/settings" element={<ProtectedRoute><InviteAcceptor><SettingsPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/templates" element={<ProtectedRoute><InviteAcceptor><TemplatesPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/templates/:templateId" element={<ProtectedRoute><InviteAcceptor><TemplateDetailPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/help" element={<ProtectedRoute><InviteAcceptor><HelpPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/help/:category" element={<ProtectedRoute><InviteAcceptor><HelpPage /></InviteAcceptor></ProtectedRoute>} />
              <Route path="/help/:category/:slug" element={<ProtectedRoute><InviteAcceptor><HelpPage /></InviteAcceptor></ProtectedRoute>} />

              {/* Legacy flat routes — redirect to current pack */}
              <Route path="/modules" element={<ProtectedRoute><LegacyRedirect path="modules" /></ProtectedRoute>} />
              <Route path="/modules/:moduleId" element={<ProtectedRoute><LegacyRedirect path="modules" /></ProtectedRoute>} />
              <Route path="/glossary" element={<ProtectedRoute><LegacyRedirect path="glossary" /></ProtectedRoute>} />
              <Route path="/paths" element={<ProtectedRoute><LegacyRedirect path="paths" /></ProtectedRoute>} />
              <Route path="/ask-lead" element={<ProtectedRoute><LegacyRedirect path="ask-lead" /></ProtectedRoute>} />
              <Route path="/sources" element={<ProtectedRoute><LegacyRedirect path="sources" /></ProtectedRoute>} />
              <Route path="/plan" element={<ProtectedRoute><LegacyRedirect path="plan" /></ProtectedRoute>} />
              <Route path="/faq" element={<ProtectedRoute><LegacyRedirect path="faq" /></ProtectedRoute>} />
              <Route path="/faq-suggestions" element={<ProtectedRoute><LegacyRedirect path="faq-suggestions" /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
        </ThemeProvider>
      </PackProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

/** Redirect old flat routes to pack-scoped equivalents */
function LegacyRedirect({ path }: { path: string }) {
  const { packs, isLoading } = usePacks();
  if (isLoading) return null;
  const savedPackId = localStorage.getItem("rocketboard_current_pack");
  const packId = savedPackId || packs[0]?.id;
  if (!packId) return <Navigate to="/packs" replace />;
  return <Navigate to={`/packs/${packId}/${path}`} replace />;
}

export default App;
