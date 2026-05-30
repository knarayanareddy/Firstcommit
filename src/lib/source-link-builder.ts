/**
 * Build links to original source locations
 */

export interface SourceLinkOptions {
  metadata?: {
    source_url?: string;
    file_id?: string;
    page_id?: string;
    page_url?: string;
    video_url?: string;
    service_id?: string;
    base_url?: string;
    file_key?: string;
  };
}

/**
 * Build a link to the original source from a chunk path
 * Returns null if no link can be constructed
 */
export function buildSourceLink(
  path: string,
  startLine?: number,
  endLine?: number,
  options?: SourceLinkOptions
): string | null {
  const metadata = options?.metadata;

  // If we have a stored source_url, use it directly
  if (metadata?.source_url) {
    let url = metadata.source_url;
    // Add line numbers for GitHub
    if (url.includes("github.com") && startLine != null) {
      url += `#L${startLine}`;
      if (endLine != null && endLine !== startLine) {
        url += `-L${endLine}`;
      }
    }
    return url;
  }

  // Parse the path prefix
  if (path.startsWith("repo:")) {
    // Format: repo:owner/repo/filepath
    const repoPath = path.slice(5); // Remove "repo:"
    const parts = repoPath.split("/");
    if (parts.length >= 3) {
      const owner = parts[0];
      const repo = parts[1];
      const filePath = parts.slice(2).join("/");
      let url = `https://github.com/${owner}/${repo}/blob/main/${filePath}`;
      if (startLine != null) {
        url += `#L${startLine}`;
        if (endLine != null && endLine !== startLine) {
          url += `-L${endLine}`;
        }
      }
      return url;
    }
  }

  if (path.startsWith("confluence:")) {
    // If we have a page_url from metadata, use it
    if (metadata?.page_url) {
      return metadata.page_url;
    }
    // Otherwise we can't construct a reliable URL without page ID
    return null;
  }

  if (path.startsWith("notion:")) {
    if (metadata?.page_url) {
      return metadata.page_url;
    }
    return null;
  }

  if (path.startsWith("gdrive:") || path.startsWith("sharepoint:")) {
    if (metadata?.source_url || metadata?.file_id) {
      return metadata.source_url || `https://drive.google.com/file/d/${metadata.file_id}`;
    }
    return null;
  }

  if (path.startsWith("jira:")) {
    // Format: jira:PROJECT/ISSUE-123
    const jiraPath = path.slice(5);
    const parts = jiraPath.split("/");
    if (parts.length >= 2 && metadata?.base_url) {
      const issueKey = parts[1];
      return `${metadata.base_url}/browse/${issueKey}`;
    }
    return null;
  }

  if (path.startsWith("linear:")) {
    // Linear doesn't have public issue URLs without workspace
    return null;
  }

  if (path.startsWith("figma:")) {
    if (metadata?.file_key) {
      return `https://www.figma.com/file/${metadata.file_key}`;
    }
    if (metadata?.source_url) {
      return metadata.source_url;
    }
    return null;
  }

  if (path.startsWith("slack:")) {
    // Slack messages don't have stable public links
    return null;
  }

  if (path.startsWith("loom:")) {
    if (metadata?.video_url) {
      return metadata.video_url;
    }
    return null;
  }

  if (path.startsWith("pagerduty:")) {
    if (metadata?.service_id) {
      return `https://app.pagerduty.com/services/${metadata.service_id}`;
    }
    return null;
  }

  if (path.startsWith("openapi:") || path.startsWith("postman:")) {
    if (metadata?.source_url) {
      return metadata.source_url;
    }
    return null;
  }

  return null;
}

/**
 * Parse a path into breadcrumb segments
 */
export function parsePathToBreadcrumbs(path: string): string[] {
  // Remove the source prefix
  let cleanPath = path;
  const colonIndex = path.indexOf(":");
  if (colonIndex !== -1) {
    cleanPath = path.slice(colonIndex + 1);
  }

  return cleanPath.split("/").filter(Boolean);
}

/**
 * Get a short display name from a full path
 */
export function getShortFileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}
