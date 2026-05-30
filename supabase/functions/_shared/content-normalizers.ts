/**
 * Shared content normalization utilities for RocketBoard ingestion.
 * Centralizes transformation logic for various sources into structured Markdown.
 */

/**
 * Confluence HTML to Markdown
 */
export function normalizeConfluenceHtmlToMarkdown(html: string): string {
  let text = html;
  // Headers
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n");
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n");
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n");
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n#### $1\n");
  // Code blocks
  text = text.replace(
    /<ac:structured-macro[^>]*ac:name="code"[^>]*>[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>[\s\S]*?<\/ac:structured-macro>/gi,
    "\n```\n$1\n```\n",
  );
  // Lists
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  // Paragraphs
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
  // Line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");
  // Bold/italic
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  // Images
  text = text.replace(
    /<ac:image[^>]*>[\s\S]*?<ri:attachment ri:filename="([^"]*)"[^>]*\/>[\s\S]*?<\/ac:image>/gi,
    "[image: $1]",
  );
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*\/?>/gi, "[image: $1]");
  text = text.replace(/<img[^>]*\/?>/gi, "[image]");
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "");
  // Clean up whitespace
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

/**
 * Notion Blocks to Markdown
 */
export function normalizeNotionBlocksToMarkdown(blocks: any[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    const type = block.type;
    switch (type) {
      case "paragraph":
        parts.push(richTextToPlain(block.paragraph?.rich_text) + "\n");
        break;
      case "heading_1":
        parts.push(`# ${richTextToPlain(block.heading_1?.rich_text)}\n`);
        break;
      case "heading_2":
        parts.push(`## ${richTextToPlain(block.heading_2?.rich_text)}\n`);
        break;
      case "heading_3":
        parts.push(`### ${richTextToPlain(block.heading_3?.rich_text)}\n`);
        break;
      case "bulleted_list_item":
        parts.push(
          `- ${richTextToPlain(block.bulleted_list_item?.rich_text)}\n`,
        );
        break;
      case "numbered_list_item":
        parts.push(
          `1. ${richTextToPlain(block.numbered_list_item?.rich_text)}\n`,
        );
        break;
      case "to_do":
        const checked = block.to_do?.checked ? "☑" : "☐";
        parts.push(`${checked} ${richTextToPlain(block.to_do?.rich_text)}\n`);
        break;
      case "code":
        const lang = block.code?.language || "";
        parts.push(
          `\`\`\`${lang}\n${richTextToPlain(block.code?.rich_text)}\n\`\`\`\n`,
        );
        break;
      case "quote":
        parts.push(`> ${richTextToPlain(block.quote?.rich_text)}\n`);
        break;
      case "callout":
        const icon = block.callout?.icon?.emoji || "💡";
        parts.push(`${icon} ${richTextToPlain(block.callout?.rich_text)}\n`);
        break;
      case "divider":
        parts.push("---\n");
        break;
      case "toggle":
        parts.push(`▸ ${richTextToPlain(block.toggle?.rich_text)}\n`);
        break;
      case "image":
        const caption = block.image?.caption
          ? richTextToPlain(block.image.caption)
          : "image";
        parts.push(`[image: ${caption}]\n`);
        break;
      case "bookmark":
        const url = block.bookmark?.url || "";
        parts.push(`[link: ${url}]\n`);
        break;
      case "table_row":
        const cells = (block.table_row?.cells || []).map((cell: any) =>
          richTextToPlain(cell)
        );
        parts.push(`| ${cells.join(" | ")} |\n`);
        break;
    }
  }
  return parts.join("").trim();
}

export function richTextToPlain(richText: any[]): string {
  if (!richText || !Array.isArray(richText)) return "";
  return richText.map((rt: any) => {
    let text = rt.plain_text || "";
    if (rt.annotations?.bold) text = `**${text}**`;
    if (rt.annotations?.italic) text = `*${text}*`;
    if (rt.annotations?.code) text = `\`${text}\``;
    if (rt.annotations?.strikethrough) text = `~~${text}~~`;
    return text;
  }).join("");
}

/**
 * Slack Thread to Markdown
 */
export function normalizeSlackThreadToMarkdown(
  channelName: string,
  date: string,
  messages: any[],
  userCache: Record<string, string>,
): string {
  if (!messages || messages.length === 0) return "";

  const mainMsg = messages[0];
  const userName = userCache[mainMsg.user] || "[team member]";

  let content = "";
  if (messages.length > 1) {
    content = `# Thread in #${channelName} (${date})\n\n`;
    for (const msg of messages) {
      const u = userCache[msg.user] || "[team member]";
      content += `**${u}**: ${msg.text || ""}\n\n`;
    }
  } else {
    content = `# Message in #${channelName} (${date})\n\n**${userName}**: ${
      mainMsg.text || ""
    }\n`;
  }

  if (mainMsg.reactions?.length) {
    const reactions = mainMsg.reactions.map((r: any) =>
      `:${r.name}: (${r.count})`
    ).join(" ");
    content += `\nReactions: ${reactions}\n`;
  }

  return content.trim();
}

/**
 * Jira Issue to Markdown (ADF support)
 */
export function normalizeJiraIssueToMarkdown(issue: any): string {
  const fields = issue.fields;
  let content = `# ${issue.key}: ${fields.summary}\n\n`;
  content += `**Type**: ${fields.issuetype?.name || "Unknown"}\n`;
  content += `**Status**: ${fields.status?.name || "Unknown"}\n`;
  content += `**Priority**: ${fields.priority?.name || "None"}\n`;
  if (fields.labels?.length) {
    content += `**Labels**: ${fields.labels.join(", ")}\n`;
  }
  if (fields.components?.length) {
    content += `**Components**: ${
      fields.components.map((c: any) => c.name).join(", ")
    }\n`;
  }
  content += "\n";

  if (fields.description) {
    content += "## Description\n\n" + adfToText(fields.description) + "\n";
  }

  if (fields.comment?.comments?.length) {
    const recentComments = fields.comment.comments.slice(-5);
    content += "## Comments\n\n";
    for (const c of recentComments) {
      content += `**${c.author?.displayName || "Unknown"}**: ${
        adfToText(c.body)
      }\n\n`;
    }
  }
  return content.trim();
}

function adfToText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "heading") {
    const level = node.attrs?.level || 1;
    return "#".repeat(level) + " " +
      (node.content || []).map(adfToText).join("") + "\n\n";
  }
  if (node.type === "paragraph") {
    return (node.content || []).map(adfToText).join("") + "\n\n";
  }
  if (node.type === "bulletList") {
    return (node.content || []).map((c: any) => "- " + adfToText(c)).join(
      "\n",
    ) + "\n";
  }
  if (node.type === "orderedList") {
    return (node.content || []).map((c: any, i: number) =>
      `${i + 1}. ` + adfToText(c)
    ).join("\n") + "\n";
  }
  if (node.type === "listItem") {
    return (node.content || []).map(adfToText).join("").trim();
  }
  if (node.type === "codeBlock") {
    return "```\n" + (node.content || []).map(adfToText).join("") + "\n```\n\n";
  }
  if (node.content) return node.content.map(adfToText).join("");
  return "";
}

/**
 * URL HTML to Markdown
 */
export function normalizeUrlHtmlToMarkdown(html: string): string {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Convert headings
  cleaned = cleaned.replace(
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, level, content) => {
      const prefix = "#".repeat(parseInt(level));
      return `\n${prefix} ${content.replace(/<[^>]+>/g, "").trim()}\n`;
    },
  );

  cleaned = cleaned.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  cleaned = cleaned.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");
  cleaned = cleaned.replace(/<[^>]+>/g, "");
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}
