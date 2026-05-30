import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  content: string | React.ReactNode;
  title?: string;
  learnMoreLink?: string;
  side?: "top" | "right" | "bottom" | "left";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: "max-w-[280px]",
  md: "max-w-[360px]",
  lg: "max-w-[440px]",
} as const;

function TooltipBody({ content, title, learnMoreLink }: Pick<HelpTooltipProps, "content" | "title" | "learnMoreLink">) {
  return (
    <div className="space-y-1.5">
      {title && <p className="font-semibold text-popover-foreground text-xs">{title}</p>}
      <div className="text-xs text-popover-foreground/90 leading-relaxed whitespace-pre-line">
        {content}
      </div>
      {learnMoreLink && (
        <a
          href={learnMoreLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
        >
          Learn more →
        </a>
      )}
    </div>
  );
}

export function HelpTooltip({
  content,
  title,
  learnMoreLink,
  side = "top",
  size = "sm",
  className,
}: HelpTooltipProps) {
  const isMobile = useIsMobile();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const iconButton = (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center shrink-0 text-muted-foreground/60 hover:text-muted-foreground transition-opacity duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-full",
        className,
      )}
      aria-label={`Help: ${title || "info"}`}
    >
      <HelpCircle className="w-3.5 h-3.5" />
    </button>
  );

  // Mobile: always popover (click)
  if (isMobile) {
    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>{iconButton}</PopoverTrigger>
        <PopoverContent
          side={side}
          className={cn("p-3", SIZE_MAP[size])}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <TooltipBody content={content} title={title} learnMoreLink={learnMoreLink} />
        </PopoverContent>
      </Popover>
    );
  }

  // Desktop: tooltip on hover + popover on click
  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>{iconButton}</PopoverTrigger>
        </TooltipTrigger>
        {!popoverOpen && (
          <TooltipContent
            side={side}
            className={cn("p-2.5", SIZE_MAP[size])}
          >
            <TooltipBody content={content} title={title} learnMoreLink={learnMoreLink} />
          </TooltipContent>
        )}
      </Tooltip>
      <PopoverContent
        side={side}
        className={cn("p-3", SIZE_MAP[size])}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <TooltipBody content={content} title={title} learnMoreLink={learnMoreLink} />
      </PopoverContent>
    </Popover>
  );
}
