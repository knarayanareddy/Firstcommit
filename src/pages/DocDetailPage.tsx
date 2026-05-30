import React, { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BookOpen, MessageSquare, CheckCircle2, Circle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DocBlockRenderer, DocBlock } from "@/components/docs/DocBlockRenderer";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function DocDetailPage() {
  const { packId, slug } = useParams<{ packId: string, slug: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch Doc Metadata
  const { data: doc, isLoading: docLoading } = useQuery({
    queryKey: ["pack-doc", packId, slug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pack_docs")
        .select(`*, pack_doc_progress(*)`)
        .eq("pack_id", packId)
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!packId && !!slug,
  });

  // Fetch Blocks
  const { data: blocks, isLoading: blocksLoading } = useQuery({
    queryKey: ["pack-doc-blocks", doc?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pack_doc_blocks")
        .select("*")
        .eq("doc_id", doc.id)
        .order("block_order", { ascending: true });
      if (error) throw error;
      return data as DocBlock[];
    },
    enabled: !!doc?.id,
  });

  // TOC generation
  const headings = blocks?.filter((b: DocBlock) => b.block_type === 'heading') || [];

  // Progress tracking
  const progress = doc?.pack_doc_progress?.find((p: any) => p.user_id === user?.id);
  const isDone = progress?.status === 'done';

  const toggleDoneMutation = useMutation({
    mutationFn: async (markAsDone: boolean) => {
      const newStatus = markAsDone ? 'done' : 'in_progress';
      if (progress) {
        return (supabase as any)
          .from("pack_doc_progress")
          .update({ status: newStatus, completed_at: markAsDone ? new Date().toISOString() : null })
          .eq("id", progress.id);
      } else {
        return (supabase as any)
          .from("pack_doc_progress")
          .insert({
            doc_id: doc.id,
            pack_id: packId,
            user_id: user?.id,
            status: newStatus,
            completed_at: markAsDone ? new Date().toISOString() : null
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pack-doc", packId, slug] });
      queryClient.invalidateQueries({ queryKey: ["pack-docs", packId] });
      toast.success(isDone ? "Marked as in progress" : "Marked as done!");
    }
  });

  const handleOpenContextualChat = () => {
    window.dispatchEvent(new CustomEvent("open-global-chat", {
      detail: { initialPrompt: `Can you explain the conceptual details of the document "${doc?.title}"?` }
    }));
  };

  if (docLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-96 items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!doc) {
    return (
      <DashboardLayout>
         <div className="max-w-4xl mx-auto py-24 text-center">
           <h2 className="text-2xl font-bold">Document not found</h2>
           <Link to={`/packs/${packId}/docs`} className="text-primary hover:underline mt-4 inline-block">Return to Library</Link>
         </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-8 px-4 flex flex-col lg:flex-row gap-12">
        
        {/* Main Content */}
        <div className="flex-1 space-y-8 min-w-0">
          <Link to={`/packs/${packId}/docs`} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
            <ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
            Back to Library
          </Link>
          
          <header className="space-y-6 pb-6 border-b">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground bg-clip-text">
                {doc.title}
              </h1>
              <div className="flex items-center gap-2 shrink-0">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleOpenContextualChat}
                  className="bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Ask Rocket
                </Button>
                <Button 
                  variant={isDone ? "secondary" : "default"}
                  size="sm"
                  onClick={() => toggleDoneMutation.mutate(!isDone)}
                  className="w-32"
                >
                  {isDone ? (
                    <><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> Done</>
                  ) : (
                    <><Circle className="w-4 h-4 mr-2" /> Mark Done</>
                  )}
                </Button>
              </div>
            </div>
            {doc.summary && (
              <p className="text-xl text-muted-foreground leading-relaxed">
                {doc.summary}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 bg-accent px-2.5 py-1 rounded-full text-foreground/80 font-medium border border-border/50">
                <BookOpen className="h-4 w-4 text-primary" />
                {doc.category || "Technical Document"}
              </span>
              <span>•</span>
              <span>Updated {new Date(doc.updated_at).toLocaleDateString()}</span>
            </div>
          </header>

          <div className="prose prose-neutral dark:prose-invert max-w-none pb-24">
            {blocksLoading ? (
              <div className="space-y-4 animate-pulse pt-4">
                <div className="h-8 bg-muted rounded w-1/3"></div>
                <div className="h-24 bg-muted rounded"></div>
                <div className="h-24 bg-muted rounded"></div>
              </div>
            ) : blocks?.length === 0 ? (
              <p className="text-muted-foreground italic">This document is empty.</p>
            ) : (
              blocks?.map((block: DocBlock) => (
                <DocBlockRenderer key={block.id} block={block} />
              ))
            )}
          </div>
        </div>

        {/* Right Rail: TOC */}
        <div className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-24 border-l border-border pl-6 space-y-4">
            <h4 className="font-semibold text-sm tracking-widest text-muted-foreground uppercase">On this page</h4>
            <ul className="space-y-3 text-sm">
              {headings.length === 0 && (
                <li className="text-muted-foreground opacity-50">No headings</li>
              )}
              {headings.map((h: any, i: number) => (
                <li key={i}>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors line-clamp-2 leading-tight">
                    {h.payload?.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
