/**
 * Language detection from file paths for syntax highlighting
 */

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // JavaScript/TypeScript
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  ".mjs": "javascript",
  ".cjs": "javascript",

  // Web
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".sass": "scss",
  ".less": "less",

  // Data formats
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".xml": "xml",

  // Markdown
  ".md": "markdown",
  ".mdx": "markdown",

  // Python
  ".py": "python",
  ".pyw": "python",
  ".pyx": "python",

  // Go
  ".go": "go",

  // Rust
  ".rs": "rust",

  // Java/Kotlin
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",

  // C/C++
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",

  // C#
  ".cs": "csharp",

  // Ruby
  ".rb": "ruby",
  ".rake": "ruby",
  ".gemspec": "ruby",

  // PHP
  ".php": "php",

  // Shell
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".fish": "bash",

  // SQL
  ".sql": "sql",

  // GraphQL
  ".graphql": "graphql",
  ".gql": "graphql",

  // Terraform/HCL
  ".tf": "hcl",
  ".tfvars": "hcl",

  // Docker
  ".dockerfile": "docker",

  // Swift
  ".swift": "swift",

  // Scala
  ".scala": "scala",

  // Elixir
  ".ex": "elixir",
  ".exs": "elixir",

  // Erlang
  ".erl": "erlang",

  // Haskell
  ".hs": "haskell",

  // Lua
  ".lua": "lua",

  // Perl
  ".pl": "perl",
  ".pm": "perl",

  // R
  ".r": "r",
  ".R": "r",

  // Dart
  ".dart": "dart",

  // Vue
  ".vue": "markup",

  // Svelte
  ".svelte": "markup",
};

const FILENAME_TO_LANGUAGE: Record<string, string> = {
  Dockerfile: "docker",
  "Dockerfile.dev": "docker",
  "Dockerfile.prod": "docker",
  Makefile: "makefile",
  Jenkinsfile: "groovy",
  Rakefile: "ruby",
  Gemfile: "ruby",
  Vagrantfile: "ruby",
  ".env": "bash",
  ".env.example": "bash",
  ".env.sample": "bash",
  ".gitignore": "git",
  ".dockerignore": "git",
  ".npmrc": "ini",
  ".yarnrc": "yaml",
  "package.json": "json",
  "tsconfig.json": "json",
  "docker-compose.yml": "yaml",
  "docker-compose.yaml": "yaml",
  ".gitlab-ci.yml": "yaml",
  ".travis.yml": "yaml",
  "cloudbuild.yaml": "yaml",
};

/**
 * Detect the programming language from a file path
 */
export function detectLanguage(path: string): string {
  // Extract filename from path
  const parts = path.split("/");
  const filename = parts[parts.length - 1] || "";

  // Check for exact filename match first
  if (FILENAME_TO_LANGUAGE[filename]) {
    return FILENAME_TO_LANGUAGE[filename];
  }

  // Check for Dockerfile variants
  if (filename.startsWith("Dockerfile")) {
    return "docker";
  }

  // Check for GitHub Actions workflows
  if (path.includes(".github/workflows/") && (filename.endsWith(".yml") || filename.endsWith(".yaml"))) {
    return "yaml";
  }

  // Extract extension
  const lastDot = filename.lastIndexOf(".");
  if (lastDot !== -1) {
    const ext = filename.slice(lastDot).toLowerCase();
    if (EXTENSION_TO_LANGUAGE[ext]) {
      return EXTENSION_TO_LANGUAGE[ext];
    }
  }

  // Default to plain text
  return "text";
}

/**
 * Check if a path represents a code file (vs documentation/config)
 */
export function isCodeFile(path: string): boolean {
  const lang = detectLanguage(path);
  const codeLanguages = [
    "typescript", "tsx", "javascript", "jsx",
    "python", "go", "rust", "java", "kotlin",
    "c", "cpp", "csharp", "ruby", "php",
    "swift", "scala", "elixir", "erlang", "haskell",
    "lua", "perl", "r", "dart",
  ];
  return codeLanguages.includes(lang);
}

/**
 * Check if content should be rendered as markdown instead of code
 */
export function isMarkdownContent(path: string): boolean {
  const lang = detectLanguage(path);
  return lang === "markdown";
}

/**
 * Get a display-friendly label for a source path prefix
 */
export function getSourceTypeFromPath(path: string): {
  type: string;
  icon: string;
  color: "blue" | "green" | "purple" | "orange" | "gray";
} {
  if (path.startsWith("repo:")) {
    return { type: "Code", icon: "🐙", color: "blue" };
  }
  if (path.startsWith("confluence:")) {
    return { type: "Confluence", icon: "🔵", color: "blue" };
  }
  if (path.startsWith("notion:")) {
    return { type: "Notion", icon: "📝", color: "gray" };
  }
  if (path.startsWith("gdrive:")) {
    return { type: "Google Drive", icon: "📁", color: "green" };
  }
  if (path.startsWith("sharepoint:")) {
    return { type: "SharePoint", icon: "📂", color: "blue" };
  }
  if (path.startsWith("jira:")) {
    return { type: "Jira", icon: "🔷", color: "blue" };
  }
  if (path.startsWith("linear:")) {
    return { type: "Linear", icon: "📐", color: "purple" };
  }
  if (path.startsWith("figma:")) {
    return { type: "Figma", icon: "🎨", color: "purple" };
  }
  if (path.startsWith("slack:")) {
    return { type: "Slack", icon: "💬", color: "gray" };
  }
  if (path.startsWith("loom:")) {
    return { type: "Loom", icon: "🎥", color: "purple" };
  }
  if (path.startsWith("pagerduty:")) {
    return { type: "PagerDuty", icon: "🚨", color: "orange" };
  }
  if (path.startsWith("openapi:")) {
    return { type: "OpenAPI", icon: "📋", color: "green" };
  }
  if (path.startsWith("postman:")) {
    return { type: "Postman", icon: "📮", color: "orange" };
  }
  if (path.startsWith("doc:")) {
    return { type: "Document", icon: "📄", color: "gray" };
  }
  return { type: "Source", icon: "📄", color: "gray" };
}
