import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { RoadmapItem, RoadmapItemStatus, useRoadmap } from "@/hooks/useRoadmap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Lock, 
  Play, 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  FileText, 
  HelpCircle, 
  Link as LinkIcon,
  CheckCircle,
  MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface RoadmapItemCardProps {
  item: RoadmapItem;
  packId: string;
  assignmentId: string;
}

const statusConfig: Record<RoadmapItemStatus, { label: string, color: string, icon: any }> = {
  blocked: { label: 'Locked', color: 'bg-muted text-muted-foreground', icon: Lock },
  available: { label: 'Up Next', color: 'bg-primary/10 text-primary border-primary/20', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Play },
  done: { label: 'Completed', color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: CheckCircle2 },
  skipped: { label: 'Skipped', color: 'bg-muted/50 text-muted-foreground/50 border-transparent', icon: MoreHorizontal },
};

export function RoadmapItemCard({ item, packId, assignmentId }: RoadmapItemCardProps) {
  const navigate = useNavigate();
  const { updateItemStatus } = useRoadmap();
  const status = item.current_status || 'available';
  const config = statusConfig[status];
  const Icon = config.icon;

  const handleAction = () => {
    if (status === 'blocked' || item.current_status === 'blocked') return;

    if (item.item_type === 'module' && item.module_id) {
       navigate(`/packs/${packId}/modules/${item.module_id}`);
    } else if (item.item_type === 'section' && item.module_id) {
       navigate(`/packs/${packId}/modules/${item.module_id}`); // Deep link would be better
    } else if (item.item_type === 'link' && item.url) {
       window.open(item.url, '_blank');
    }
    
    if (status === 'available') {
      updateItemStatus.mutate({ assignmentId, itemId: item.id, status: 'in_progress' });
    }
  };

  const markComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === 'blocked' || item.current_status === 'blocked') return;
    updateItemStatus.mutate({ assignmentId, itemId: item.id, status: 'done' });
  };

  return (
    <div 
      data-tour="roadmap-item-card"
      className={cn(
      "group relative bg-card border rounded-xl p-4 transition-all duration-300",
      status === 'blocked' ? "opacity-60 grayscale-[0.5]" : "hover:border-primary/50 hover:shadow-lg shadow-sm"
    )}>
      <div className="flex items-start justify-between mb-2">
        <Badge variant="outline" className={cn("text-[10px] uppercase font-bold py-0 h-5", config.color)}>
           <Icon className="w-2.5 h-2.5 mr-1" />
           {config.label}
        </Badge>
        
        {status !== 'done' && status !== 'blocked' && (
           <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={markComplete}
           >
             <CheckCircle className="w-4 h-4 text-muted-foreground hover:text-green-500" />
           </Button>
        )}
      </div>

      <h4 className="font-semibold text-sm mb-1 line-clamp-1">{item.title}</h4>
      {item.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{item.description}</p>}
      
      {status === 'blocked' && item.prerequisite_title && (
         <p className="text-[10px] text-amber-500 font-medium mb-3 flex items-center gap-1" data-tour="roadmap-lock">
            <Lock className="w-2.5 h-2.5" />
            Blocked by: {item.prerequisite_title}
         </p>
      )}

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          {item.item_type === 'module' && <FileText className="w-3 h-3 text-muted-foreground" />}
          {item.item_type === 'quiz' && <HelpCircle className="w-3 h-3 text-muted-foreground" />}
          {item.item_type === 'link' && <LinkIcon className="w-3 h-3 text-muted-foreground" />}
          <span className="text-[10px] text-muted-foreground capitalize font-medium">{item.item_type}</span>
        </div>

        {status !== 'blocked' && (
          <Button 
            variant="link" 
            size="sm" 
            className="h-auto p-0 text-primary text-xs font-semibold"
            onClick={handleAction}
          >
            {status === 'done' ? 'Revisit' : 'Start'}
            <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        )}
      </div>

      {status === 'blocked' && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-background/80 backdrop-blur-sm border rounded-full p-2 shadow-sm scale-90">
               <Lock className="w-4 h-4 text-muted-foreground" />
            </div>
         </div>
      )}
    </div>
  );
}
