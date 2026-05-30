import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SetupChecklistProps {
  commands: string[];
  stepId: string;
  checkedCommands: Set<string>;
  onToggleCommand: (commandIndex: number) => void;
}

export function SetupChecklist({
  commands,
  stepId,
  checkedCommands,
  onToggleCommand,
}: SetupChecklistProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (command: string, index: number) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedIndex(index);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const commandKey = (index: number) => `${stepId}-cmd-${index}`;
  const completedCount = commands.filter((_, i) => checkedCommands.has(commandKey(i))).length;

  return (
    <div className="mt-4 bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
        <Terminal className="w-4 h-4" />
        <span>Run these commands:</span>
      </div>

      <div className="space-y-2">
        {commands.map((cmd, i) => {
          const key = commandKey(i);
          const isChecked = checkedCommands.has(key);
          const isCopied = copiedIndex === i;

          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md font-mono text-xs transition-colors",
                isChecked ? "bg-primary/5 text-muted-foreground" : "bg-muted/50"
              )}
            >
              <button
                onClick={() => onToggleCommand(i)}
                className={cn(
                  "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                  isChecked
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border hover:border-primary"
                )}
              >
                {isChecked && <Check className="w-3 h-3" />}
              </button>

              <code className={cn("flex-1 break-all", isChecked && "line-through opacity-60")}>
                {cmd}
              </code>

              <button
                onClick={() => handleCopy(cmd, i)}
                className={cn(
                  "p-1.5 rounded hover:bg-muted transition-colors shrink-0",
                  isCopied && "text-primary"
                )}
                title="Copy command"
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Progress: {completedCount}/{commands.length} commands run
      </div>
    </div>
  );
}

// Helper to extract shell commands from markdown code blocks
export function extractShellCommands(markdown: string): string[] {
  const commands: string[] = [];
  
  // Match bash/shell code blocks
  const codeBlockRegex = /```(?:bash|sh|shell|zsh)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const block = match[1].trim();
    // Split by newlines and filter out comments and empty lines
    const lines = block.split("\n").filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith("#");
    });
    commands.push(...lines);
  }

  return commands;
}
