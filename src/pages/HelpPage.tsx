import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useHelpArticles } from "@/hooks/useHelpArticles";
import { HELP_CATEGORY_META, type HelpCategory } from "@/data/help-content";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowLeft, ThumbsUp, ThumbsDown, Compass, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

const ALL_CATEGORIES: HelpCategory[] = [
  "getting-started", "sources", "content-creation", "learning",
  "collaboration", "settings", "troubleshooting", "keyboard-shortcuts", "whats-new",
  "vs-code-extension",
];

const POPULAR_SLUGS = [
  "six-phase-flow", "quick-start-learners", "citations-evidence",
  "access-levels", "ingestion-failed",
];

export default function HelpPage() {
  const { category, slug } = useParams<{ category?: string; slug?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { accessLevelLabel, packAccessLevel } = useRole();
  const { articles, searchArticles, getArticle, getArticlesByCategory, getRelatedArticles } = useHelpArticles();
  const [query, setQuery] = useState("");

  const searchResults = query.length >= 2 ? searchArticles(query) : [];

  // Article view
  if (slug) {
    const article = getArticle(slug);
    if (!article) {
      return (
        <DashboardLayout>
          <div className="max-w-3xl mx-auto py-12 text-center">
            <p className="text-muted-foreground">Article not found.</p>
            <Button variant="ghost" className="mt-4" onClick={() => navigate("/help")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Help Center
            </Button>
          </div>
        </DashboardLayout>
      );
    }

    const related = getRelatedArticles(article.id);
    const catMeta = HELP_CATEGORY_META[article.category];

    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
            <Link to="/help" className="hover:text-foreground transition-colors">❓ Help</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to={`/help/${article.category}`} className="hover:text-foreground transition-colors">
              {catMeta.label}
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">{article.title}</span>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="secondary" className="text-xs">
              {article.audience.includes("all") ? "All users" : article.audience.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(", ")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Updated {new Date(article.lastUpdated).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
          </div>

          {/* Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MarkdownRenderer>{article.content}</MarkdownRenderer>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">Related Articles</h3>
              <div className="space-y-2">
                {related.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/help/${r.category}/${r.slug}`)}
                    className="block w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <span className="text-sm text-foreground">📄 {r.title}</span>
                    <p className="text-xs text-muted-foreground">{r.summary}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}
          <ArticleFeedback articleId={article.id} userId={user?.id} />
        </div>
      </DashboardLayout>
    );
  }

  // Category view
  if (category) {
    const catMeta = HELP_CATEGORY_META[category as HelpCategory];
    const catArticles = getArticlesByCategory(category as HelpCategory);

    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
            <Link to="/help" className="hover:text-foreground transition-colors">❓ Help</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">{catMeta?.label || category}</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-6">
            {catMeta?.icon} {catMeta?.label}
          </h1>

          <div className="space-y-2">
            {catArticles.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/help/${a.category}/${a.slug}`)}
                className="block w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <span className="text-sm font-medium text-foreground">📄 {a.title}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{a.summary}</p>
              </button>
            ))}
            {catArticles.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No articles in this category for your role.</p>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Main help center view
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">❓ RocketBoard Help Center</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Showing articles for your role ({accessLevelLabel(packAccessLevel)}).
        </p>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles..."
            className="w-full bg-muted rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Search results */}
        {query.length >= 2 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </h2>
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/help/${a.category}/${a.slug}`)}
                    className="block w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{a.title}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {HELP_CATEGORY_META[a.category]?.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.summary}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No articles found. <button onClick={() => {}} className="text-primary hover:underline">Ask Mission Control</button> for help.
              </div>
            )}
          </div>
        )}

        {/* Categories grid */}
        {query.length < 2 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {ALL_CATEGORIES.map((cat) => {
                const meta = HELP_CATEGORY_META[cat];
                const count = getArticlesByCategory(cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => navigate(`/help/${cat}`)}
                    className="flex flex-col items-center gap-1 p-4 rounded-xl border border-border hover:bg-muted transition-colors text-center"
                  >
                    <span className="text-2xl">{meta.icon}</span>
                    <span className="text-sm font-medium text-foreground">{meta.label}</span>
                    <span className="text-[10px] text-muted-foreground">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Popular articles */}
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Popular Articles</h2>
            <div className="space-y-2 mb-8">
              {POPULAR_SLUGS.map((s) => {
                const a = articles.find((a) => a.slug === s);
                if (!a) return null;
                return (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/help/${a.category}/${a.slug}`)}
                    className="block w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">📄 {a.title}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.summary}</p>
                  </button>
                );
              })}
            </div>

            {/* CTA */}
            <div className="text-center py-6 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">Can't find what you need?</p>
              <Button variant="outline" size="sm" className="gap-2">
                <Compass className="w-4 h-4" /> Ask Mission Control
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function ArticleFeedback({ articleId, userId }: { articleId: string; userId?: string }) {
  const [submitted, setSubmitted] = useState(false);

  const submit = async (isHelpful: boolean) => {
    if (!userId) return;
    try {
      await supabase.from("help_feedback").insert({ user_id: userId, article_id: articleId, is_helpful: isHelpful });
      setSubmitted(true);
      toast.success("Thanks for your feedback!");
    } catch {
      toast.error("Failed to save feedback");
    }
  };

  if (submitted) {
    return <p className="text-xs text-muted-foreground mt-8 pt-6 border-t border-border text-center">Thanks for your feedback! 🎉</p>;
  }

  return (
    <div className="mt-8 pt-6 border-t border-border text-center">
      <p className="text-sm text-muted-foreground mb-2">Was this helpful?</p>
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => submit(true)}>
          <ThumbsUp className="w-3.5 h-3.5" /> Yes
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => submit(false)}>
          <ThumbsDown className="w-3.5 h-3.5" /> No
        </Button>
      </div>
    </div>
  );
}
