export interface EvidenceSpan {
  span_id: string;
  chunk_ref: string;
  chunk_pk: string;
  stable_chunk_id: string | null;
  chunk_id?: string; // Legacy
  path: string;
  text: string;
  start_line?: number;
  end_line?: number;
  line_start?: number; // Aliases for robustness
  line_end?: number;
  content?: string;
}

export interface Citation {
  path: string;
  start: number;
  end: number;
  raw: string;
}

/**
 * Extracts citations from text using the project's standard regex.
 */
export function extractCitations(text: string): Citation[] {
  // Use non-greedy (.+?) with a lookahead (?=:\d+-\d+\]) to stop at the LAST numeric boundary.
  const regex = /\[SOURCE:\s*(.+?)(?=:\d+-\d+\])\s*:(\d+)-(\d+)\]/g;
  const citations: Citation[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    citations.push({
      path: match[1].trim(),
      start: parseInt(match[2]),
      end: parseInt(match[3]),
      raw: match[0],
    });
  }
  return citations;
}

/**
 * Validates each citation against the provided evidence spans.
 * Returns a list of invalid citation strings found in the text.
 */
export function getInvalidCitations(
  text: string,
  spans: EvidenceSpan[],
): string[] {
  const citations = extractCitations(text);
  const invalidCitations: string[] = [];

  for (const cit of citations) {
    const isValid = spans.some((s) => {
      const matchPath = s.path === cit.path;
      const sStart = s.start_line ?? s.line_start ?? 0;
      const sEnd = s.end_line ?? s.line_end ?? 0;

      // Range check: citation must be contained within the span's range.
      const matchRange = sStart <= cit.start && sEnd >= cit.end;

      return matchPath && matchRange;
    });

    if (!isValid) {
      invalidCitations.push(cit.raw);
    }
  }

  return invalidCitations;
}
