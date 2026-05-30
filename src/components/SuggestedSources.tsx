import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePack } from "@/hooks/usePack";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, X, Cloud, FileText, Palette, FileJson, AlertTriangle, Video, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SourceSuggestion {
  type: string;
  label: string;
  reason: string;
  icon: React.ReactNode;
}

const DETECTION_PATTERNS: { pattern: RegExp; suggestion: SourceSuggestion }[] = [
  {
    pattern: /atlassian\.net|confluence/i,
    suggestion: {
      type: "confluence",
      label: "Confluence",
      reason: "Found Confluence URLs in your codebase",
      icon: <Cloud className="w-4 h-4" />,
    },
  },
  {
    pattern: /notion\.so/i,
    suggestion: {
      type: "notion",
      label: "Notion",
      reason: "Found Notion links in your codebase",
      icon: <FileText className="w-4 h-4" />,
    },
  },
  {
    pattern: /figma\.com/i,
    suggestion: {
      type: "figma",
      label: "Figma",
      reason: "Found Figma design links",
      icon: <Palette className="w-4 h-4" />,
    },
  },
  {
    pattern: /swagger|openapi/i,
    suggestion: {
      type: "openapi_spec",
      label: "OpenAPI Spec",
      reason: "Found API specification references",
      icon: <FileJson className="w-4 h-4" />,
    },
  },
  {
    pattern: /pagerduty/i,
    suggestion: {
      type: "pagerduty",
      label: "PagerDuty",
      reason: "Found PagerDuty references",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
  },
  {
    pattern: /loom\.com/i,
    suggestion: {
      type: "loom_video",
      label: "Loom Videos",
      reason: "Found Loom video links",
      icon: <Video className="w-4 h-4" />,
    },
  },
  {
    pattern: /slack\.com|#[a-z0-9-]+channel/i,
    suggestion: {
      type: "slack_channel",
      label: "Slack Channels",
      reason: "Found Slack references",
      icon: <MessageSquare className="w-4 h-4" />,
    },
  },
];

interface SuggestedSourcesProps {
  existingTypes: string[];
  onAddSource: (type: string) => void;
}

export function SuggestedSources({ existingTypes, onAddSource }: SuggestedSourcesProps) {
  const { currentPackId } = usePack();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [dismissedAll, setDismissedAll] = useState(false);

  // Load dismissed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`suggestedSources_dismissed_${currentPackId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      setDismissed(parsed.types || []);
      setDismissedAll(parsed.all || false);
    }
  }, [currentPackId]);

  const saveDismissed = (types: string[], all: boolean) => {
    localStorage.setItem(`suggestedSources_dismissed_${currentPackId}`, JSON.stringify({ types, all }));
  };

  // Fetch a sample of chunks to scan for tool references
  const { data: suggestions = [] } = useQuery({
    queryKey: ["source_suggestions", currentPackId],
    queryFn: async () => {
      if (!currentPackId) return [];

      // Get a sample of chunks from GitHub/document sources
      const { data: chunks } = await supabase
        .from("knowledge_chunks")
        .select("content, path")
        .eq("pack_id", currentPackId)
        .ilike("path", "repo:%")
        .limit(200);

      if (!chunks || chunks.length === 0) return [];

      // Scan chunks for tool references
      const found = new Map<string, SourceSuggestion>();
      const combinedContent = chunks.map(c => c.content).join("\n");

      for (const { pattern, suggestion } of DETECTION_PATTERNS) {
        if (pattern.test(combinedContent) && !existingTypes.includes(suggestion.type)) {
          found.set(suggestion.type, suggestion);
        }
      }

      return Array.from(found.values());
    },
    enabled: !!currentPackId,
    staleTime: 60000, // Cache for 1 minute
  });

  const visibleSuggestions = suggestions.filter(
    s => !dismissed.includes(s.type) && !existingTypes.includes(s.type)
  );

  if (dismissedAll || visibleSuggestions.length === 0) {
    return null;
  }

  const handleDismiss = (type: string) => {
    const newDismissed = [...dismissed, type];
    setDismissed(newDismissed);
    saveDismissed(newDismissed, false);
  };

  const handleDismissAll = () => {
    setDismissedAll(true);
    saveDismissed(dismissed, true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <Card className="border-primary/20 bg-primary/5 mb-6">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Lightbulb className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground mb-2">
                  We detected references to additional tools in your codebase
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Adding these sources would enrich your onboarding content.
                </p>
                <div className="flex flex-wrap gap-2">
                  {visibleSuggestions.map(s => (
                    <Button
                      key={s.type}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => onAddSource(s.type)}
                    >
                      {s.icon}
                      Add {s.label}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={handleDismissAll}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
