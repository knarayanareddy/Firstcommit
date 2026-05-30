/**
 * ai-task-router/utils/citation-mapper.ts
 *
 * Utility to map canonical citations [SOURCE: path:start-end] to UI badges [S1], [S2].
 * This ensures the audit text remains technical while the UI remains readable.
 */

export interface SourceMapEntry {
  badge: string;
  filepath: string;
  start: number;
  end: number;
  chunk_ref?: string;
  chunk_pk?: string;
  stable_chunk_id?: string | null;
  chunk_id?: string; // Legacy/TEXT alias
}

export interface CitationMappingResult {
  canonical_response: string;
  display_response: string;
  source_map: SourceMapEntry[];
}

/**
 * Parses canonical citations and generates a display-ready version with a mapping.
 */
export function canonicalizeCitations(
  originalText: string,
  spans: any[] = [],
): CitationMappingResult {
  // Use non-greedy (.+?) with a lookahead (?=:\d+-\d+\]) to stop at the LAST numeric boundary.
  // This allows multiple [SOURCE: ...] tags on a single line even if file paths contain colons (repo:...).
  // A greedy (.+) would consume multiple citations into a single match on the same line.
  const citationRegex = /\[SOURCE:\s*(.+?)(?=:\d+-\d+\])\s*:(\d+)-(\d+)\]/g;
  const sourceMap: SourceMapEntry[] = [];
  const map = new Map<string, string>();
  let badgeCounter = 1;

  const display_response = originalText.replace(
    citationRegex,
    (match, path, start, end) => {
      // Normalize filepath whitespace
      const normalizedPath = path.trim();
      const startLine = parseInt(start);
      const endLine = parseInt(end);
      const key = `${normalizedPath}:${startLine}-${endLine}`;

      if (!map.has(key)) {
        const badge = `S${badgeCounter++}`;
        map.set(key, badge);

        // Attempt to enrich with chunk_id from evidence spans
        const span = spans.find((s) => {
          const sStart = s.start_line ?? s.line_start;
          const sEnd = s.end_line ?? s.line_end;
          return (
            s.path === normalizedPath &&
            sStart !== undefined && sEnd !== undefined &&
            sStart <= startLine && sEnd >= endLine
          );
        });

        sourceMap.push({
          badge,
          filepath: normalizedPath,
          start: startLine,
          end: endLine,
          chunk_ref: span?.chunk_ref || span?.chunk_id || span?.span_id,
          chunk_pk: span?.chunk_pk,
          stable_chunk_id: span?.stable_chunk_id,
          chunk_id: span?.stable_chunk_id || span?.chunk_id, // Ensure legacy field is never UUID
        });
      }
      return `[${map.get(key)}]`;
    },
  );

  return {
    canonical_response: originalText,
    display_response,
    source_map: sourceMap,
  };
}
