import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Highlight, themes } from "prism-react-renderer";
import { Check, X, GitPullRequest, ExternalLink, User, Calendar, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ProposalCardProps {
  proposal: any;
  isAuthor: boolean;
  onUpdate: () => void;
}

export function ProposalCard({ proposal, isAuthor, onUpdate }: ProposalCardProps) {
  const [loading, setLoading] = useState(false);

  const handleStatusUpdate = async (newStatus: string) => {
    setLoading(true);
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'approved') {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");
        updates.approved_by = user.id;
        updates.approved_at = new Date().toISOString();
      }

      const { error } = await (supabase as any)
        .from("change_proposals")
        .update(updates)
        .eq("id", proposal.id);

      if (error) throw error;
      toast.success(`Proposal ${newStatus}`);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPR = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-github-pr", {
        body: { 
          pack_id: proposal.pack_id, 
          proposal_id: proposal.id 
        }
      });

      if (error) throw error;
      toast.success("GitHub Pull Request created successfully!");
      onUpdate();
    } catch (err: any) {
      toast.error(`PR Creation Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    draft: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    approved: "bg-green-500/10 text-green-500 border-green-500/20",
    pr_opened: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <Card className="overflow-hidden border-border bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-bold">{proposal.title}</CardTitle>
              <Badge className={cn("capitalize px-2 py-0", statusColors[proposal.status as keyof typeof statusColors])}>
                {proposal.status.replace('_', ' ')}
              </Badge>
            </div>
            <CardDescription className="text-sm line-clamp-2 italic">
              {proposal.description || "No description provided."}
            </CardDescription>
          </div>
          
          <div className="flex flex-col items-end gap-1 text-[10px] text-muted-foreground uppercase font-medium">
             <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {proposal.source?.short_slug || 'Root'}
             </div>
             <div className="flex items-center gap-1">
                <GitPullRequest className="h-3 w-3" />
                {proposal.proposal_type}
             </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs p-3 rounded-lg bg-muted/30 border border-border/50">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3.5 w-3.5 text-primary/70" />
              <span>Created: </span>
              <span className="text-foreground font-medium">{proposal.author?.email || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary/70" />
              <span>Date: </span>
              <span className="text-foreground font-medium">{format(new Date(proposal.created_at), "MMM d, yyyy")}</span>
            </div>
          </div>
          {proposal.approved_at && (
            <div className="space-y-2 border-t md:border-t-0 md:border-l border-border/50 pt-2 md:pt-0 md:pl-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-green-500" />
                <span>Approved by: </span>
                <span className="text-foreground font-medium">{proposal.approver?.email || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-green-500" />
                <span>Approved: </span>
                <span className="text-foreground font-medium">{format(new Date(proposal.approved_at), "MMM d, yyyy")}</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-zinc-950 overflow-hidden">
          <div className="bg-zinc-900 px-3 py-1.5 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Unified Patch</span>
            <FileText className="h-3.5 w-3.5 text-zinc-500" />
          </div>
          <Highlight theme={themes.nightOwl} code={proposal.patch_unified} language="diff">
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre className={cn(className, "text-xs p-4 overflow-x-auto max-h-[300px] scrollbar-thin scrollbar-thumb-zinc-800")} style={{...style, background: 'transparent'}}>
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line, key: i })} className={cn(
                    "table-row",
                    line[0]?.content.startsWith('+') && "bg-green-500/10 text-green-400",
                    line[0]?.content.startsWith('-') && "bg-red-500/10 text-red-400"
                  )}>
                    <span className="table-cell pr-4 opacity-30 select-none text-right w-8">{i + 1}</span>
                    <span className="table-cell">
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token, key })} />
                      ))}
                    </span>
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
      </CardContent>

      {isAuthor && (
        <CardFooter className="bg-muted/30 border-t py-3 flex justify-end gap-2">
          {proposal.status === 'draft' && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                onClick={() => handleStatusUpdate('rejected')}
                disabled={loading}
              >
                <X className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button 
                size="sm" 
                className="bg-primary hover:bg-primary/90"
                onClick={() => handleStatusUpdate('approved')}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="mr-2 h-4 w-4" />} 
                Approve Proposal
              </Button>
            </>
          )}
          
          {proposal.status === 'approved' && (
            <Button 
              size="sm" 
              className="bg-primary hover:bg-primary/90"
              onClick={handleOpenPR}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitPullRequest className="mr-2 h-4 w-4" />}
              Create GitHub PR
            </Button>
          )}

          {proposal.status === 'pr_opened' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open(proposal.pr_url, "_blank")}
              className="text-primary hover:text-primary hover:bg-primary/5"
            >
              <ExternalLink className="mr-2 h-4 w-4" /> View PR on GitHub
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
