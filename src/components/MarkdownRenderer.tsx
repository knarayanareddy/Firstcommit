import ReactMarkdown from "react-markdown";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeCallout, CalloutType } from "@/components/CodeCallout";
import type { Components } from "react-markdown";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { Play, Sparkles } from "lucide-react";
import { CitationBadge } from "@/components/CitationBadge";
import { PackId, ChunkPK, StableChunkId, ChunkRef } from "@/types/brands";

interface MarkdownRendererProps {
  children: string;
  className?: string;
  onAction?: (slug: string) => boolean | void;
  referencedSpans?: { 
    span_id: string; 
    path: string; 
    chunk_ref: ChunkRef; 
    chunk_pk: ChunkPK; 
    stable_chunk_id: StableChunkId | null; 
    start_line?: number; 
    end_line?: number 
  }[];
  packId?: PackId | string;
}

// Parse custom callout syntax :::type[title]\n...\n::: and [ACTION: slug(label)] and citations [S1]
type Part = { 
  type: "text" | "callout" | "action" | "ui_action" | "step" | "card" | "citation"; 
  content: string; 
  calloutType?: CalloutType; 
  title?: string;
  actionSlug?: string;
  icon?: string;
  citationId?: string;
};

function parseMarkdown(markdown: string): Part[] {
  const parts: Part[] = [];
  
  // Regex for blocks: :::type[title]{icon}\n...\n:::
  // Regex for actions: [ACTION: slug(label)] or [UI_ACTION: slug(label)]
  // Regex for citations: [S1], [S2], [S3, S5] etc.
  const combinedRegex = /(?::::(setup|pattern|config|warning|step|card)(?:\[([^\]]*)\])?(?:{([^}]*)})?\n([\s\S]*?):::)|(?:\[(ACTION|UI_ACTION): ([^(\]]+)(?:\(([^)]+)\))?\])|(?:\[(S\d+(?:\s*,\s*S\d+)*)\])/g;
  
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: markdown.slice(lastIndex, match.index) });
    }
    
    if (match[1]) {
      // Block match (callout, step, or card)
      const type = match[1];
      if (type === "step" || type === "card") {
        parts.push({
          type: type as "step" | "card",
          title: match[2],
          icon: match[3],
          content: match[4].trim(),
        });
      } else {
        parts.push({
          type: "callout",
          calloutType: type as CalloutType,
          title: match[2],
          content: match[4].trim(),
        });
      }
    } else if (match[5]) {
      // Action or UI_ACTION match
      parts.push({
        type: match[5] === "UI_ACTION" ? "ui_action" : "action",
        actionSlug: match[6],
        content: match[7] || "Take Action",
      });
    } else if (match[8]) {
      // Citation match [S1] or [S1, S2]
      const ids = match[8].split(',').map(id => id.trim());
      ids.forEach(id => {
        parts.push({
          type: "citation",
          citationId: id,
          content: `[${id}]`,
        });
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < markdown.length) {
    parts.push({ type: "text", content: markdown.slice(lastIndex) });
  }
  
  return parts.length > 0 ? parts : [{ type: "text", content: markdown }];
}

const components: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match?.[1];
    const content = String(children).replace(/\n$/, "");

    if (lang === "mermaid") {
      return <MermaidDiagram code={content} />;
    }

    // Inline code (no language class and no newlines typically)
    if (!className) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    // Block code
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

export function MarkdownRenderer({ children, className, onAction, referencedSpans, packId: explicitPackId }: MarkdownRendererProps) {
  const parts = parseMarkdown(children);
  const navigate = useNavigate();
  const { packId: urlPackId } = useParams();
  const packId = (explicitPackId || urlPackId) as PackId | undefined;

  const handleAction = (slug: string) => {
    // Check if parent wants to handle it
    if (onAction && onAction(slug) === true) return;

    if (!packId) return;

    switch (slug) {
      case 'connect_github':
        navigate(`/packs/${packId}/sources?action=open_github_modal`);
        break;
      case 'generate_plan':
        navigate(`/packs/${packId}/plan?action=start_generation`);
        break;
      case 'open_sandbox':
        navigate(`/packs/${packId}/sandbox`);
        break;
      case 'navigate_plan':
        navigate(`/packs/${packId}/plan`);
        break;
      case 'navigate_sources':
        navigate(`/packs/${packId}/sources`);
        break;
      case 'open_help':
        navigate(`/help`);
        break;
      default:
        console.warn(`Unknown action slug: ${slug}`);
    }
  };
  
  return (
    <div className={className}>
      {parts.map((part, i) => {
        if (part.type === "citation" && part.citationId) {
          const span = referencedSpans?.find(s => s.span_id === part.citationId);
          if (!span) console.warn(`No span found for citation: ${part.citationId}`, referencedSpans);
          return (
            <CitationBadge
              key={i}
              spanId={part.citationId}
              path={span?.path}
              chunkRef={span?.chunk_ref}
              startLine={span?.start_line}
              endLine={span?.end_line}
              packId={packId}
            />
          );
        }
        if (part.type === "step") {
          return (
            <div key={i} className="flex gap-4 mb-6 relative group">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-sm font-bold text-primary group-hover:scale-110 transition-transform bg-background">
                  {part.icon || (i + 1)}
                </div>
                <div className="w-0.5 h-full bg-gradient-to-b from-primary/20 to-transparent mt-2" />
              </div>
              <div className="flex-1 pt-0.5">
                {part.title && <h4 className="text-base font-bold text-foreground mb-1 leading-none">{part.title}</h4>}
                <div className="text-sm text-muted-foreground leading-relaxed">
                  <ReactMarkdown components={components}>{part.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        }
        if (part.type === "card") {
          return (
            <div key={i} className="p-5 rounded-xl border border-border bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-primary/20 transition-all mb-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 text-3xl opacity-10 group-hover:opacity-20 transition-opacity grayscale group-hover:grayscale-0">
                {part.icon}
              </div>
              {part.title && <h4 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
                {part.icon && <span className="text-lg">{part.icon}</span>}
                {part.title}
              </h4>}
              <div className="text-sm text-muted-foreground leading-relaxed">
                <ReactMarkdown components={components}>{part.content}</ReactMarkdown>
              </div>
            </div>
          );
        }
        if (part.type === "callout" && part.calloutType) {
          return (
            <CodeCallout key={i} type={part.calloutType} title={part.title || ""}>
              <ReactMarkdown components={components}>{part.content}</ReactMarkdown>
            </CodeCallout>
          );
        }
        if ((part.type === "action" || part.type === "ui_action") && part.actionSlug) {
          return (
            <div key={i} className="my-4">
              <Button 
                onClick={() => handleAction(part.actionSlug!)}
                className={`gap-2 border-0 shadow-lg transition-all font-semibold ${
                  part.type === "ui_action" 
                    ? "bg-accent text-accent-foreground hover:bg-accent/80" 
                    : "gradient-primary text-primary-foreground hover:shadow-primary/20"
                }`}
              >
                {part.type === "ui_action" ? <Sparkles className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 fill-current" />}
                {part.content}
              </Button>
            </div>
          );
        }
        return (
          <ReactMarkdown key={i} components={components}>{part.content}</ReactMarkdown>
        );
      })}
    </div>
  );
}
