import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProposalCard } from "@/components/admin/ProposalCard";
import { GitPullRequest, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function ProposalsPage() {
  const { packId } = useParams<{ packId: string }>();
  const { user } = useAuth();

  const { data: proposals, isLoading, error, refetch } = useQuery({
    queryKey: ["proposals", packId],
    queryFn: async () => {
      if (!packId) return [];
      const { data, error } = await (supabase as any)
        .from("change_proposals")
        .select(`
          *,
          author:created_by ( email ),
          approver:approved_by ( email ),
          source:source_id ( label, source_uri, short_slug )
        `)
        .eq("pack_id", packId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!packId && !!user,
  });

  const { data: member } = useQuery({
    queryKey: ["pack-member", packId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pack_members")
        .select("access_level")
        .eq("pack_id", packId)
        .eq("user_id", user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!packId && !!user,
  });

  const isAuthor = ['author', 'admin'].includes(member?.access_level || '');

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/packs/${packId}`} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <GitPullRequest className="h-8 w-8 text-primary" />
              Change Proposals
            </h1>
          </div>
          
          <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border">
            {isAuthor ? "Authoring Mode" : "Viewer Mode"}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-in fade-in duration-500">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
            <p>Loading proposals...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-12 text-center text-destructive">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-medium mb-2">Error Loading Proposals</h2>
            <p className="max-w-md mx-auto mb-6">{(error as Error).message}</p>
          </div>
        ) : !proposals || proposals.length === 0 ? (
          <div className="bg-card border border-dashed rounded-xl p-12 text-center text-muted-foreground">
            <GitPullRequest className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-medium text-foreground mb-2">No Proposals Yet</h2>
            <p className="max-w-md mx-auto">Proposals created by AI or learners will appear here for author review and PR creation.</p>
          </div>
        ) : (
          <div className="grid gap-6 animate-in slide-in-from-bottom-4 duration-500">
            {proposals.map((proposal) => (
              <ProposalCard 
                key={proposal.id} 
                proposal={proposal} 
                isAuthor={isAuthor} 
                onUpdate={refetch}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
