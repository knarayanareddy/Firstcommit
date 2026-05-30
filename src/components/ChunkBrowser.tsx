import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePack } from "@/hooks/usePack";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, Search, ChevronLeft, ChevronRight, Lock, FileCode } from "lucide-react";

const PAGE_SIZE = 20;

export function ChunkBrowser({ sourceId, sourceName }: { sourceId: string; sourceName: string }) {
  const { currentPackId } = usePack();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pathFilter, setPathFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["chunks_browse", sourceId, currentPackId, page, pathFilter],
    queryFn: async () => {
      let query = supabase
        .from("knowledge_chunks")
        .select("id, chunk_id, path, start_line, end_line, content, is_redacted", { count: "exact" })
        .eq("pack_id", currentPackId)
        .eq("source_id", sourceId)
        .order("path")
        .order("start_line")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (pathFilter.trim()) {
        query = query.ilike("path", `%${pathFilter.trim()}%`);
      }

      const { data: rows, error, count } = await query;
      if (error) throw error;
      return { rows: rows || [], total: count || 0 };
    },
    enabled: open && !!currentPackId,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
          <Database className="w-3 h-3" /> Browse Chunks
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" />
            Chunks: {sourceName}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter by path..."
              value={pathFilter}
              onChange={e => { setPathFilter(e.target.value); setPage(0); }}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Count */}
          <div className="text-xs text-muted-foreground">
            {data ? `${data.total} chunk${data.total !== 1 ? "s" : ""}` : "Loading..."}
          </div>

          {/* Chunk list */}
          <ScrollArea className="h-[calc(100vh-220px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading chunks...</div>
            ) : data?.rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No chunks found</div>
            ) : (
              <div className="space-y-2 pr-2">
                {data?.rows.map(chunk => (
                  <div key={chunk.id} className="bg-card border border-border rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs font-mono text-primary truncate flex-1">{chunk.path}</code>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        L{chunk.start_line}–{chunk.end_line}
                      </span>
                    </div>
                    {chunk.is_redacted && (
                      <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-500 border-yellow-500/20 gap-1">
                        <Lock className="w-2.5 h-2.5" /> Contains redacted content
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-3 font-mono whitespace-pre-wrap">
                      {chunk.content.slice(0, 200)}{chunk.content.length > 200 ? "…" : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button
                variant="ghost" size="sm" disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="gap-1 text-xs"
              >
                <ChevronLeft className="w-3 h-3" /> Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="ghost" size="sm" disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="gap-1 text-xs"
              >
                Next <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
