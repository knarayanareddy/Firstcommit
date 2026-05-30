export interface CitationValidation {
  spanId: string;
  valid: boolean;
  warnings: string[];
}

export interface CitationValidationResult {
  valid: boolean;
  warnings: string[];
  citations: CitationValidation[];
}

export function validateCitations(
  citations: any[],
  evidenceSpans: any[]
): CitationValidationResult {
  if (!citations?.length) {
    return { valid: true, warnings: [], citations: [] };
  }

  const spanIndex = new Map<string, any>();
  for (const span of evidenceSpans || []) {
    if (span.span_id) spanIndex.set(span.span_id, span);
  }

  const allWarnings: string[] = [];
  const results: CitationValidation[] = [];

  for (const citation of citations) {
    const cw: string[] = [];
    const spanId = citation.span_id || citation.spanId;

    if (!spanId) {
      cw.push("Citation missing span_id");
      results.push({ spanId: "unknown", valid: false, warnings: cw });
      allWarnings.push(...cw);
      continue;
    }

    const evidenceSpan = spanIndex.get(spanId);
    if (!evidenceSpan) {
      cw.push(`Citation span_id "${spanId}" not found in evidence spans`);
      results.push({ spanId, valid: false, warnings: cw });
      allWarnings.push(...cw);
      continue;
    }

    // Check field matches if provided
    if (citation.path && evidenceSpan.path && citation.path !== evidenceSpan.path) {
      cw.push(`Citation path "${citation.path}" doesn't match evidence path "${evidenceSpan.path}"`);
    }
    if (citation.chunk_id && evidenceSpan.chunk_id && citation.chunk_id !== evidenceSpan.chunk_id) {
      cw.push(`Citation chunk_id mismatch for span "${spanId}"`);
    }
    if (citation.start_line != null && evidenceSpan.start_line != null && citation.start_line !== evidenceSpan.start_line) {
      cw.push(`Citation start_line mismatch for span "${spanId}"`);
    }
    if (citation.end_line != null && evidenceSpan.end_line != null && citation.end_line !== evidenceSpan.end_line) {
      cw.push(`Citation end_line mismatch for span "${spanId}"`);
    }

    const isValid = cw.length === 0;
    results.push({ spanId, valid: isValid, warnings: cw });
    allWarnings.push(...cw);
  }

  return {
    valid: allWarnings.length === 0,
    warnings: allWarnings,
    citations: results,
  };
}
