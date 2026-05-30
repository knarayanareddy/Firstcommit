import { useMemo, useCallback } from "react";
import { HELP_ARTICLES, type HelpArticle, type HelpCategory } from "@/data/help-content";
import { useRole } from "@/hooks/useRole";

export function useHelpArticles() {
  const { packAccessLevel } = useRole();

  const visibleArticles = useMemo(() => {
    return HELP_ARTICLES.filter((article) => {
      if (article.audience.includes("all")) return true;
      if (packAccessLevel === "owner" || packAccessLevel === "admin") return true;
      if (packAccessLevel === "author" && !article.audience.every((a) => a === "admin")) return true;
      if (packAccessLevel === "learner" && article.audience.includes("learner")) return true;
      return false;
    });
  }, [packAccessLevel]);

  const searchArticles = useCallback(
    (query: string): HelpArticle[] => {
      if (!query || query.length < 2) return [];
      const q = query.toLowerCase();
      return visibleArticles.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)) ||
          a.content.toLowerCase().includes(q)
      );
    },
    [visibleArticles]
  );

  const getArticle = useCallback(
    (slug: string): HelpArticle | undefined => {
      return visibleArticles.find((a) => a.slug === slug);
    },
    [visibleArticles]
  );

  const getArticlesByCategory = useCallback(
    (category: HelpCategory): HelpArticle[] => {
      return visibleArticles.filter((a) => a.category === category);
    },
    [visibleArticles]
  );

  const getRelatedArticles = useCallback(
    (articleId: string): HelpArticle[] => {
      const article = HELP_ARTICLES.find((a) => a.id === articleId);
      if (!article?.relatedArticles) return [];
      return article.relatedArticles
        .map((id) => visibleArticles.find((a) => a.id === id))
        .filter(Boolean) as HelpArticle[];
    },
    [visibleArticles]
  );

  return { articles: visibleArticles, searchArticles, getArticle, getArticlesByCategory, getRelatedArticles };
}
