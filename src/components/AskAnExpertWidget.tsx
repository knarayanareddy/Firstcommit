import { useKnowledgeOwners } from "@/hooks/useKnowledgeOwners";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Users, Mail } from "lucide-react";

export function AskAnExpertWidget({ packId, moduleTitle, onHelpRequested }: { packId: string | null; moduleTitle: string; onHelpRequested?: () => void }) {
  const { data: owners, isLoading } = useKnowledgeOwners(packId);

  if (isLoading || !owners || owners.length === 0) return null;

  const handleContactClick = () => {
    if (onHelpRequested) onHelpRequested();
  };

  return (
    <Card className="mt-6 border-indigo-500/20 bg-indigo-500/5 overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-purple-500" />
      <CardContent className="p-5">
        <div className="flex items-start gap-4 flex-col sm:flex-row">
          <div className="p-3 bg-indigo-500/10 rounded-xl shrink-0">
            <Users className="w-6 h-6 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-1">
              Ask an Expert
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Stuck on this module? These team members are the most active maintainers of the underlying source code and documentation.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {owners.map((owner) => (
                <div key={owner.email} className="bg-background/50 border border-border/50 rounded-lg p-3 flex items-center justify-between gap-2 overflow-hidden hover:border-indigo-500/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8 shrink-0 border border-border">
                      <AvatarFallback className="bg-primary/5 text-xs text-primary font-medium">
                        {owner.email.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{owner.email.split('@')[0]}</p>
                      <p className="text-[10px] text-muted-foreground">Relevance Score: {Math.round(owner.score)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {owner.slackHandle && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" asChild onClick={handleContactClick}>
                        <a href={`slack://user?id=${owner.slackHandle}`} title={`Message ${owner.slackHandle} on Slack`}>
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                        </a>
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" asChild onClick={handleContactClick}>
                      <a 
                        href={`mailto:${owner.email}?subject=Question regarding module: ${encodeURIComponent(moduleTitle)}&body=Hi there,%0D%0A%0D%0AI was working through the "${encodeURIComponent(moduleTitle)}" module in RocketBoard and had a quick question...`} 
                        title="Send email"
                      >
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
