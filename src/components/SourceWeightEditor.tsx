import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Scale, Loader2 } from "lucide-react";
import { useSources } from "@/hooks/useSources";
import { useRole } from "@/hooks/useRole";

const WEIGHT_OPTIONS = [
  { label: "Critical Priority", value: 2.0, color: "text-rose-500", bg: "bg-rose-500/10" },
  { label: "High Priority", value: 1.5, color: "text-orange-500", bg: "bg-orange-500/10" },
  { label: "Normal", value: 1.0, color: "text-muted-foreground", bg: "bg-muted" },
  { label: "Low Priority", value: 0.5, color: "text-slate-400", bg: "bg-slate-400/10" },
];

export function SourceWeightEditor({ sourceId, currentWeight = 1.0 }: { sourceId: string; currentWeight?: number }) {
  const { updateSourceWeight } = useSources();
  const { hasPackPermission } = useRole();
  const [isUpdating, setIsUpdating] = useState(false);

  const activeOption = WEIGHT_OPTIONS.find(o => Math.abs(o.value - currentWeight) < 0.1) || WEIGHT_OPTIONS[2];

  const handleUpdate = async (weight: number) => {
    if (weight === currentWeight) return;
    setIsUpdating(true);
    try {
      await updateSourceWeight.mutateAsync({ sourceId, weight });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!hasPackPermission("author")) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${activeOption.bg} ${activeOption.color}`}>
        <Scale className="w-3 h-3" />
        Weight: {activeOption.label}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={`h-6 px-2 text-xs font-medium ${activeOption.bg} ${activeOption.color} hover:${activeOption.bg}`}>
          {isUpdating ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Scale className="w-3 h-3 mr-1.5" />}
          Weight: {activeOption.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {WEIGHT_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => handleUpdate(opt.value)}
            className={`text-xs ${opt.color} ${opt.value === currentWeight ? "bg-muted/50 font-medium" : ""}`}
          >
            {opt.label} ({opt.value.toFixed(1)}x)
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
