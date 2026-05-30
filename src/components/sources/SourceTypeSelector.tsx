import { Github, FileText, Database, Cloud, FolderOpen, Share2, Palette, Box, ClipboardList, Ticket, FileJson, MessageSquare, Video, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type SourceType = 
  | "github_repo" 
  | "document" 
  | "confluence" 
  | "notion" 
  | "google_drive" 
  | "sharepoint"
  | "openapi_spec"
  | "postman_collection"
  | "jira"
  | "linear"
  | "figma"
  | "slack_channel"
  | "loom_video"
  | "pagerduty";

interface SourceTypeOption {
  type: SourceType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  available: boolean;
  category: "code" | "documentation" | "project" | "design" | "api" | "ops";
}

const SOURCE_TYPES: SourceTypeOption[] = [
  {
    type: "github_repo",
    label: "GitHub",
    description: "Repository",
    icon: <Github className="w-6 h-6" />,
    color: "bg-gray-800 text-white",
    available: true,
    category: "code",
  },
  {
    type: "confluence",
    label: "Confluence",
    description: "Wiki pages",
    icon: <Cloud className="w-6 h-6" />,
    color: "bg-blue-600 text-white",
    available: true,
    category: "documentation",
  },
  {
    type: "notion",
    label: "Notion",
    description: "Pages & databases",
    icon: <FileText className="w-6 h-6" />,
    color: "bg-gray-900 text-white",
    available: true,
    category: "documentation",
  },
  {
    type: "google_drive",
    label: "Google Drive",
    description: "Docs & files",
    icon: <FolderOpen className="w-6 h-6" />,
    color: "bg-yellow-500 text-gray-900",
    available: true,
    category: "documentation",
  },
  {
    type: "sharepoint",
    label: "SharePoint",
    description: "Documents",
    icon: <Share2 className="w-6 h-6" />,
    color: "bg-blue-500 text-white",
    available: true,
    category: "documentation",
  },
  {
    type: "slack_channel",
    label: "Slack",
    description: "Channel history",
    icon: <MessageSquare className="w-6 h-6" />,
    color: "bg-[#4A154B] text-white",
    available: true,
    category: "project",
  },
  {
    type: "jira",
    label: "Jira",
    description: "Issues & epics",
    icon: <Ticket className="w-6 h-6" />,
    color: "bg-blue-600 text-white",
    available: true,
    category: "project",
  },
  {
    type: "linear",
    label: "Linear",
    description: "Issues & projects",
    icon: <ClipboardList className="w-6 h-6" />,
    color: "bg-indigo-600 text-white",
    available: true,
    category: "project",
  },
  {
    type: "openapi_spec",
    label: "OpenAPI",
    description: "API specs",
    icon: <FileJson className="w-6 h-6" />,
    color: "bg-green-600 text-white",
    available: true,
    category: "api",
  },
  {
    type: "postman_collection",
    label: "Postman",
    description: "API collections",
    icon: <Box className="w-6 h-6" />,
    color: "bg-orange-500 text-white",
    available: true,
    category: "api",
  },
  {
    type: "figma",
    label: "Figma",
    description: "Design files",
    icon: <Palette className="w-6 h-6" />,
    color: "bg-purple-600 text-white",
    available: true,
    category: "design",
  },
  {
    type: "loom_video",
    label: "Loom / Video",
    description: "Transcripts",
    icon: <Video className="w-6 h-6" />,
    color: "bg-purple-500 text-white",
    available: true,
    category: "documentation",
  },
  {
    type: "pagerduty",
    label: "PagerDuty",
    description: "Services & on-call",
    icon: <AlertTriangle className="w-6 h-6" />,
    color: "bg-green-600 text-white",
    available: true,
    category: "ops",
  },
  {
    type: "document",
    label: "Document",
    description: "Paste content",
    icon: <Database className="w-6 h-6" />,
    color: "bg-primary text-primary-foreground",
    available: true,
    category: "documentation",
  },
];

interface SourceTypeSelectorProps {
  onSelect: (type: SourceType) => void;
}

export function SourceTypeSelector({ onSelect }: SourceTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
      {SOURCE_TYPES.map((option, i) => (
        <motion.button
          key={option.type}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.02 }}
          onClick={() => option.available && onSelect(option.type)}
          disabled={!option.available}
          className={cn(
            "relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all",
            option.available
              ? "border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              : "border-border/50 opacity-50 cursor-not-allowed"
          )}
        >
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-1.5", option.color)}>
            {option.icon}
          </div>
          <span className="text-sm font-medium text-foreground">{option.label}</span>
          <span className="text-[10px] text-muted-foreground">{option.description}</span>
          {!option.available && (
            <span className="absolute top-1.5 right-1.5 text-[9px] bg-muted px-1 py-0.5 rounded">
              Soon
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}

export function getSourceTypeIcon(type: string) {
  switch (type) {
    case "github_repo":
      return <Github className="w-4 h-4" />;
    case "confluence":
      return <Cloud className="w-4 h-4 text-blue-500" />;
    case "notion":
      return <FileText className="w-4 h-4" />;
    case "google_drive":
      return <FolderOpen className="w-4 h-4 text-yellow-500" />;
    case "sharepoint":
      return <Share2 className="w-4 h-4 text-blue-400" />;
    case "slack_channel":
      return <MessageSquare className="w-4 h-4 text-[#4A154B]" />;
    case "jira":
      return <Ticket className="w-4 h-4 text-blue-500" />;
    case "linear":
      return <ClipboardList className="w-4 h-4 text-indigo-500" />;
    case "openapi_spec":
      return <FileJson className="w-4 h-4 text-green-500" />;
    case "postman_collection":
      return <Box className="w-4 h-4 text-orange-500" />;
    case "figma":
      return <Palette className="w-4 h-4 text-purple-500" />;
    case "loom_video":
      return <Video className="w-4 h-4 text-purple-500" />;
    case "pagerduty":
      return <AlertTriangle className="w-4 h-4 text-green-500" />;
    case "document":
      return <Database className="w-4 h-4" />;
    default:
      return <Database className="w-4 h-4" />;
  }
}

export function getSourceTypeLabel(type: string) {
  switch (type) {
    case "github_repo":
      return "GitHub Repository";
    case "confluence":
      return "Confluence";
    case "notion":
      return "Notion";
    case "google_drive":
      return "Google Drive";
    case "sharepoint":
      return "SharePoint";
    case "slack_channel":
      return "Slack Channel";
    case "jira":
      return "Jira";
    case "linear":
      return "Linear";
    case "openapi_spec":
      return "OpenAPI / Swagger";
    case "postman_collection":
      return "Postman Collection";
    case "figma":
      return "Figma";
    case "loom_video":
      return "Loom / Video";
    case "pagerduty":
      return "PagerDuty";
    case "document":
      return "Document";
    default:
      return type;
  }
}
