import { ReactNode } from "react";
import { Zap, Puzzle, Settings, AlertTriangle, ExternalLink } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import { detectLanguage } from "@/lib/language-detect";
import { buildSourceLink } from "@/lib/source-link-builder";
import { cn } from "@/lib/utils";

export type CalloutType = "setup" | "pattern" | "config" | "warning";

interface CodeCalloutProps {
  type: CalloutType;
  title: string;
  children: ReactNode;
  sourcePath?: string;
  sourceLines?: string;
  sourceUrl?: string;
  onViewSource?: () => void;
}

const calloutConfig: Record<CalloutType, {
  icon: typeof Zap;
  label: string;
  borderClass: string;
  bgClass: string;
  iconClass: string;
  labelClass: string;
}> = {
  setup: {
    icon: Zap,
    label: "SETUP REQUIRED",
    borderClass: "border-l-blue-500",
    bgClass: "bg-blue-500/5",
    iconClass: "text-blue-500",
    labelClass: "text-blue-600 dark:text-blue-400",
  },
  pattern: {
    icon: Puzzle,
    label: "PATTERN",
    borderClass: "border-l-purple-500",
    bgClass: "bg-purple-500/5",
    iconClass: "text-purple-500",
    labelClass: "text-purple-600 dark:text-purple-400",
  },
  config: {
    icon: Settings,
    label: "CONFIGURATION",
    borderClass: "border-l-muted-foreground",
    bgClass: "bg-muted/30",
    iconClass: "text-muted-foreground",
    labelClass: "text-muted-foreground",
  },
  warning: {
    icon: AlertTriangle,
    label: "GOTCHA",
    borderClass: "border-l-amber-500",
    bgClass: "bg-amber-500/5",
    iconClass: "text-amber-500",
    labelClass: "text-amber-600 dark:text-amber-400",
  },
};

export function CodeCallout({
  type,
  title,
  children,
  sourcePath,
  sourceLines,
  sourceUrl,
  onViewSource,
}: CodeCalloutProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;

  const effectiveSourceUrl = sourceUrl || (sourcePath ? buildSourceLink(sourcePath, 1, 1) : null);

  return (
    <div
      className={cn(
        "rounded-lg border-l-4 p-4 my-4",
        config.borderClass,
        config.bgClass
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", config.iconClass)} />
        <span className={cn("text-xs font-bold uppercase tracking-wide", config.labelClass)}>
          {config.label}
        </span>
        {title && title !== config.label && (
          <span className="text-sm font-medium text-foreground">— {title}</span>
        )}
      </div>

      <div className="text-sm text-foreground/90 prose prose-sm dark:prose-invert max-w-none [&_pre]:my-2 [&_pre]:rounded-md [&_code]:text-xs">
        {children}
      </div>

      {(sourcePath || effectiveSourceUrl) && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50 text-xs text-muted-foreground">
          <span>📄 Source: {sourcePath}{sourceLines && ` (${sourceLines})`}</span>
          {effectiveSourceUrl && (
            <a
              href={effectiveSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              View <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {onViewSource && (
            <button
              onClick={onViewSource}
              className="text-primary hover:underline"
            >
              View →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Helper to render code block inside callout with syntax highlighting
interface CodeBlockProps {
  code: string;
  language?: string;
  filepath?: string;
}

export function CalloutCodeBlock({ code, language = "typescript", filepath }: CodeBlockProps) {
  const lang = detectLanguage(filepath || `.${language}`);

  return (
    <div className="my-2">
      {filepath && (
        <div className="text-[10px] text-muted-foreground font-mono mb-1">
          {filepath}
        </div>
      )}
      <Highlight theme={themes.nightOwl} code={code.trim()} language={lang as any}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(className, "text-xs p-3 rounded-md overflow-x-auto")}
            style={style}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
