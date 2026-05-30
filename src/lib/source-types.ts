export type SourceCategory = "code" | "documentation" | "project" | "design" | "api";

export interface SourceTypeDefinition {
  key: string;
  label: string;
  description: string;
  category: SourceCategory;
  available: boolean;
}

export const SOURCE_TYPES: SourceTypeDefinition[] = [
  {
    key: "github_repo",
    label: "GitHub Repository",
    description: "Import code, configs, and documentation",
    category: "code",
    available: true,
  },
  {
    key: "confluence",
    label: "Confluence",
    description: "Wiki pages from Atlassian Confluence",
    category: "documentation",
    available: true,
  },
  {
    key: "notion",
    label: "Notion",
    description: "Pages & databases from Notion",
    category: "documentation",
    available: true,
  },
  {
    key: "google_drive",
    label: "Google Drive",
    description: "Docs, sheets & files",
    category: "documentation",
    available: true,
  },
  {
    key: "sharepoint",
    label: "SharePoint",
    description: "Documents from Microsoft SharePoint",
    category: "documentation",
    available: true,
  },
  {
    key: "jira",
    label: "Jira",
    description: "Issues, epics & workflows",
    category: "project",
    available: true,
  },
  {
    key: "linear",
    label: "Linear",
    description: "Issues, projects & cycles",
    category: "project",
    available: true,
  },
  {
    key: "openapi_spec",
    label: "OpenAPI / Swagger",
    description: "API specification files",
    category: "api",
    available: true,
  },
  {
    key: "postman_collection",
    label: "Postman Collection",
    description: "API request collections",
    category: "api",
    available: true,
  },
  {
    key: "figma",
    label: "Figma",
    description: "Design files & components",
    category: "design",
    available: true,
  },
  {
    key: "document",
    label: "Document",
    description: "Paste text content directly",
    category: "documentation",
    available: true,
  },
  {
    key: "slack_channel",
    label: "Slack Channel",
    description: "Channel messages & threads",
    category: "project",
    available: false,
  },
  {
    key: "loom_video",
    label: "Loom Video",
    description: "Video transcripts",
    category: "documentation",
    available: false,
  },
];

export function getSourceType(key: string): SourceTypeDefinition | undefined {
  return SOURCE_TYPES.find((s) => s.key === key);
}
