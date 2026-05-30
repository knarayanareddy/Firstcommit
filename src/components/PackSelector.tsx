import { ChevronDown, Package, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePacks } from "@/hooks/usePacks";
import { usePack } from "@/hooks/usePack";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PackSelector({ collapsed }: { collapsed?: boolean }) {
  const { packs } = usePacks();
  const { currentPack, setPack } = usePack();
  const navigate = useNavigate();

  const handleSelect = (pack: any) => {
    setPack(pack);
    navigate(`/packs/${pack.id}`);
  };

  if (collapsed) {
    return (
      <div className="px-2 py-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Package className="w-4 h-4 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors text-left">
          <Package className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground truncate flex-1">
            {currentPack?.title ?? "Select Pack"}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {packs.map((pack) => (
          <DropdownMenuItem
            key={pack.id}
            onClick={() => handleSelect(pack)}
            className={pack.id === currentPack?.id ? "bg-accent" : ""}
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{pack.title}</span>
              {pack.description && (
                <span className="text-xs text-muted-foreground truncate">{pack.description}</span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/packs")}>
          <Package className="w-3.5 h-3.5 mr-2" />
          All Packs
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/packs/new")}>
          <Plus className="w-3.5 h-3.5 mr-2" />
          Create New Pack
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
