import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoadmap, RoadmapItem, RoadmapItemStatus } from "@/hooks/useRoadmap";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, GraduationCap, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function RoadmapPage() {
  const { packId } = useParams();
  const { assignments, isLoading, externalProgress, progress } = useRoadmap();

  // Combine raw assignment data with progress & external signals
  const processedRoadmap = useMemo(() => {
    if (!assignments.length) return [];

    return (assignments as any[]).map(assignment => {
      const items = (assignment.playlist?.items || []) as RoadmapItem[];
      
      const processedItems = items.map(item => {
        // 1. Get explicit db progress
        const dbProgress = (progress as any[]).find(p => p.item_id === item.id);
        let status: RoadmapItemStatus = (dbProgress?.status as RoadmapItemStatus) || 'available';

        // 2. Override with external signals (Automatic Detection)
        if (status !== 'done' && externalProgress) {
          if (item.item_type === 'section' && item.section_id) {
            const isRead = externalProgress.userProgress.some(p => 
              p.section_id === item.section_id && p.is_read
            );
            if (isRead) status = 'done';
          } 
          else if (item.item_type === 'module' && item.module_id) {
             const hasScore = externalProgress.quizScores.some(s => s.module_id === item.module_id);
             if (hasScore) status = 'done';
          }
        }

        // 3. Resolve prerequisite title for "Blocked by" messaging
        const dependency = ((assignment as any).playlist?.items || []).find((i: any) => 
          ((assignment as any).playlist?.dependencies || []).some((d: any) => d.item_id === item.id && d.depends_on_item_id === i.id)
        );

        return {
          ...item,
          current_status: status,
          prerequisite_title: dependency?.title
        };
      });

      return {
        ...assignment,
        items: processedItems,
      };
    });
  }, [assignments, progress, externalProgress]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto space-y-8">
          <Skeleton className="h-12 w-64 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-[400px] rounded-xl" />
            <Skeleton className="h-[400px] rounded-xl" />
            <Skeleton className="h-[400px] rounded-xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const activeAssignment = processedRoadmap[0] as any; // v1: focus on primary assignment

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-6" data-tour="roadmap-header">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Onboarding Roadmap</h1>
              <p className="text-muted-foreground mt-1">
                Track your journey through our codebase and platform.
              </p>
            </div>
          </div>
        </div>
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] h-5 uppercase tracking-wider">
                Active Program
              </Badge>
              {activeAssignment?.playlist?.required && (
                 <Badge variant="outline" className="text-[10px] h-5 border-yellow-500/20 text-yellow-500 bg-yellow-500/5">
                   Required
                 </Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
              {activeAssignment?.playlist?.title || "Your Roadmap"}
              <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              {activeAssignment?.playlist?.description || "Follow this structured journey to master the codebase and excel in your role."}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-2xl border border-border/50">
             <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
             </div>
             <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Assigned By / Mentor</p>
                <p className="text-sm font-semibold">{activeAssignment?.playlist?.owner_display_name || "Engineering Lead"}</p>
             </div>
          </div>
        </header>
        
        {activeAssignment ? (
          <div className="space-y-12">
             <RoadmapTimeline 
                items={activeAssignment.items} 
                packId={packId || ''} 
                assignmentId={activeAssignment.id} 
             />
             
             <div className="p-8 rounded-3xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                   <h3 className="text-lg font-semibold flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-primary" />
                      Ready for graduation?
                   </h3>
                   <p className="text-sm text-muted-foreground">Complete all Day 1-90 items to unlock your mastery badge.</p>
                </div>
                {/* Visual completion progress */}
             </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-20 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
               <Sparkles className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No Program Assigned</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              You haven't been assigned to a structured onboarding program yet. 
              Contact your lead or explore available modules in the Modules tab.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
