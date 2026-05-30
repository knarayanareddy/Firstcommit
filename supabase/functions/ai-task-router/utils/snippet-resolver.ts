import { EvidenceSpan } from "../index.ts";

/**
 * Resolves [SNIPPET: ...] tags into exact source code.
 * Enforces spatial coupling (SOURCE within 300 chars above).
 */
export function resolveSnippets(text: string, spans: EvidenceSpan[]) {
  const snippetRegex =
    /\[SNIPPET:\s*(.+?)(?=:\d+-\d+\s*\|)\s*:(\d+)-(\d+)\s*\|\s*lang=(.*?)\s*\]/g;
  let snippets_resolved = 0;

  const finalMarkdown = text.replace(
    snippetRegex,
    (match, path, startStr, endStr, lang, offset) => {
      const start = parseInt(startStr);
      const end = parseInt(endStr);
      const normalizedPath = path.trim();

      // Structural Rule: Proximity Check (300 char lookback)
      const lookback = text.slice(Math.max(0, offset - 300), offset);
      if (!lookback.includes(`[SOURCE: ${normalizedPath}:${start}-${end}]`)) {
        return `\n> [!CAUTION]\n> Removed unresolved code snippet (no matching SOURCE citation nearby).\n`;
      }

      if (
        end - start > 250
      ) {
        return `\n> [!CAUTION]\n> Removed snippet: Range too large (>250 lines).\n`;
      }

      const span = spans.find((s) => {
        const sPath = s.path === normalizedPath;
        const sStart = (s.start_line ?? s.line_start ?? 0) <= start;
        const sEnd = (s.end_line ?? s.line_end ?? 0) >= end;
        return sPath && sStart && sEnd;
      });
      if (
        !span
      ) {
        return `\n> [!CAUTION]\n> Removed unresolved code snippet: ${normalizedPath} (not in evidence).\n`;
      }

      const spanText = span.text ?? span.content ?? "";
      const lines = spanText.split("\n");
      const spanStart = span.start_line ?? span.line_start ?? 0;
      const startIdx = Math.max(0, start - spanStart);
      const endIdx = Math.min(lines.length - 1, end - spanStart);

      if (
        startIdx > endIdx
      ) {
        return `\n> [!CAUTION]\n> Removed unresolved snippet: Index out of bounds.\n`;
      }

      const extracted = lines.slice(startIdx, endIdx + 1).join("\n");
      snippets_resolved++;

      return "\n```" + lang.trim() + "\n// SOURCE: " + normalizedPath + ":" +
        start + "-" + end + "\n" + extracted + "\n```\n";
    },
  );

  return { finalMarkdown, snippets_resolved };
}
