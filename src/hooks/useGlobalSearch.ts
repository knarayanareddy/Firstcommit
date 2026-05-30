import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePack } from "@/hooks/usePack";
import { useAuth } from "@/hooks/useAuth";

const RECENT_KEY = "rocketboard_recent_searches";
const MAX_RECENT = 5;

export type SearchFilter = "modules" | "glossary" | "notes" | "chatHistory" | "sourceChunks";

export interface SearchResults {
  modules: Array<{
    moduleKey: string;
    moduleTitle: string;
    sectionId: string | null;
    sectionHeading: string | null;
    snippet: string;
  }>;
  glossary: Array<{ term: string; definition: string; snippet: string }>;
  notes: Array<{ moduleId: string; sectionId: string; snippet: string }>;
  chatHistory: Array<{ moduleId: string; content: string; role: string; snippet: string }>;
  sourceChunks: Array<{ chunkId: string; path: string; snippet: string }>;
}

const emptyResults: SearchResults = {
  modules: [],
  glossary: [],
  notes: [],
  chatHistory: [],
  sourceChunks: [],
};

export function useGlobalSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const { currentPackId } = usePack();
  const { user } = useAuth();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const { data: results = emptyResults, isLoading, error } = useQuery({
    queryKey: ["global-search", currentPackId, debouncedQuery, filters],
    queryFn: async () => {
      if (!debouncedQuery || !currentPackId) return emptyResults;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return emptyResults;

      const res = await supabase.functions.invoke("search-content", {
        body: {
          pack_id: currentPackId,
          query: debouncedQuery,
          filters: filters.length > 0 ? filters : undefined,
          limit: 10,
        },
      });
      if (res.error) throw res.error;
      return res.data as SearchResults;
    },
    enabled: !!debouncedQuery && debouncedQuery.length >= 2 && !!currentPackId && !!user,
    staleTime: 30_000,
  });

  const totalResults =
    results.modules.length +
    results.glossary.length +
    results.notes.length +
    results.chatHistory.length +
    results.sourceChunks.length;

  // Recent searches
  const getRecentSearches = useCallback((): string[] => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch { return []; }
  }, []);

  const saveRecentSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    const recent = getRecentSearches().filter((s) => s !== q.trim());
    recent.unshift(q.trim());
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  }, [getRecentSearches]);

  const clearRecentSearches = useCallback(() => {
    localStorage.removeItem(RECENT_KEY);
  }, []);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    results,
    isLoading,
    error,
    totalResults,
    getRecentSearches,
    saveRecentSearch,
    clearRecentSearches,
  };
}
