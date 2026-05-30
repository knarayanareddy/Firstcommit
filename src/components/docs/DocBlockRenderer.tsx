import React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type DocBlock = {
  id: string; // the database id
  block_type: 'heading' | 'paragraph' | 'callout' | 'checklist' | 'code' | 'mermaid' | 'divider';
  payload: any;
};

// Generic Block Renderer mapping the parsed blocks to interactive UI
export function DocBlockRenderer({ block, onCheckToggle }: { block: DocBlock, onCheckToggle?: (id: string, checked: boolean) => void }) {
  switch (block.block_type) {
    case 'heading': {
      const isHero = block.payload.text?.toUpperCase() === block.payload.text;
      return (
        <h2 className={`font-bold text-foreground mt-8 mb-4 border-b pb-2 ${isHero ? 'text-2xl tracking-tight' : 'text-xl'}`}>
          {block.payload.text}
        </h2>
      );
    }
    
    case 'paragraph':
      return (
        <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed mb-6 font-medium">
          {block.payload.text}
        </p>
      );
      
    case 'divider':
      return <hr className="my-8 border-border" />;
      
    case 'callout': {
      let colors = "bg-muted text-foreground border-border";
      if (block.payload.variant === "warning") colors = "bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400";
      if (block.payload.variant === "tip") colors = "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400";
      return (
        <div className={`p-4 rounded-xl border my-6 ${colors}`}>
          <p className="font-semibold text-sm tracking-tight mb-1 uppercase">{block.payload.variant}</p>
          <div className="text-sm whitespace-pre-wrap">{block.payload.body}</div>
        </div>
      );
    }

    case 'checklist':
      return (
        <div className="bg-card border rounded-xl p-6 my-6 space-y-4 shadow-sm">
          {block.payload.items?.map((item: any) => (
            <div key={item.id} className="flex items-start space-x-3">
              <Checkbox 
                id={`chk-${item.id}`} 
                defaultChecked={item.defaultChecked}
                onCheckedChange={(checked) => {
                  if (onCheckToggle) onCheckToggle(item.id, checked as boolean);
                }}
                className="mt-1"
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor={`chk-${item.id}`} className="text-sm font-medium leading-normal peer-disabled:cursor-not-allowed peer-disabled:opacity-70 whitespace-pre-wrap cursor-pointer">
                  {item.text}
                </Label>
              </div>
            </div>
          ))}
        </div>
      );

    case 'code': {
      const handleCopy = () => {
        navigator.clipboard.writeText(block.payload.code);
        toast.success("Copied to clipboard");
      };
      
      return (
        <div className="relative my-6 group">
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 bg-background/50 hover:bg-background border rounded-md text-muted-foreground hover:text-foreground backdrop-blur-sm"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <pre className="bg-secondary/50 p-4 rounded-xl overflow-x-auto text-sm font-mono border text-foreground">
            <code>{block.payload.code}</code>
          </pre>
        </div>
      );
    }

    case 'mermaid':
      // Mermaid renderer placeholder for V1 (actual mermaid-react can be slotted here)
      return (
        <div className="p-6 bg-card border border-dashed rounded-xl my-6 flex flex-col items-center justify-center text-muted-foreground text-sm font-mono whitespace-pre-wrap">
          <span className="mb-2 font-semibold text-primary">MERMAID DIAGRAM</span>
          {block.payload.diagram}
        </div>
      );

    default:
      return null;
  }
}
