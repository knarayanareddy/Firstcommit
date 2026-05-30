import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Search, Library, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

export default function DocsLibraryPage() {
  const { packId } = useParams<{ packId: string }>();

  const { data: docs, isLoading } = useQuery({
    queryKey: ["pack-docs", packId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pack_docs")
        .select(`
          id, slug, title, summary, category, tags, status, updated_at,
          pack_doc_progress (status)
        `)
        .eq("pack_id", packId)
        .eq("status", "published")
        .order("category", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!packId,
  });

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div data-tour="docs-library-header">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Library className="h-8 w-8 text-primary" />
              Docs Library
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Explore interactive technical documentation, architecture guides, and runbooks.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div data-tour="docs-search-bar" className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 bg-card" placeholder="Search docs..." />
            </div>
            <Link 
              to={`/packs/${packId}/docs-admin`}
              data-tour="docs-admin-link"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
              Manage
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-card border animate-pulse" />
            ))}
          </div>
        ) : docs?.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">No documentation found</h3>
            <p className="text-muted-foreground mt-1">This pack doesn't have any published docs yet.</p>
          </div>
        ) : (
          <div data-tour="docs-grid" className="space-y-10">
            {Array.from(new Set(docs?.map((d: any) => d.category || "General"))).map((category: any) => (
              <div key={category} className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground/90 border-b pb-2">{category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {docs?.filter((d: any) => (d.category || "General") === category).map((doc: any) => {
                    const progress = doc.pack_doc_progress?.[0]?.status;
                    return (
                      <Link 
                        key={doc.id} 
                        to={`/packs/${packId}/docs/${doc.slug}`}
                        className="group flex flex-col bg-card hover:bg-accent/30 border rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md hover:border-primary/30 relative"
                      >
                        {progress === 'done' && (
                          <div className="absolute top-4 right-4 text-green-500">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                        )}
                        <div className="p-5 flex-1 flex flex-col">
                          <h3 className="text-lg font-semibold text-foreground pr-8 group-hover:text-primary transition-colors">
                            {doc.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2 flex-1">
                            {doc.summary || "No summary provided."}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-4">
                            {doc.tags?.slice(0, 3).map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-xs font-normal">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
