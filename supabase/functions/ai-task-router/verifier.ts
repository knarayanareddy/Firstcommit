import type { EvidenceSpan } from "./types.ts";

/**
 * Advanced grounding verification for RAG responses.
 * Implements Phase 4 of the Zero-Hallucination migration.
 */

export interface VerificationResult {
  verifiedContent: string;
  score: number; // 0.0 to 1.0
  warnings: string[];
  failedBlocks: string[];
}

/**
 * Extracts code blocks from markdown text.
 */
function extractCodeBlocks(text: string): string[] {
  const regex = /```[\s\S]*?```/g;
  return text.match(regex) || [];
}

/**
 * Checks if a code block is grounded in the provided evidence spans.
 * Per Phase 4: This performs sub-string matching and fuzzy verification.
 */
function isCodeGrounded(block: string, spans: EvidenceSpan[]): boolean {
  // Strip fences
  const lines = block.split("\n");
  if (lines.length < 2) return true; // Empty block
  const content = lines.slice(1, -1).join("\n").trim();

  if (!content) return true;

  // Check if this exact content exists in any of the evidence spans
  for (const span of spans) {
    if (span.text.includes(content)) return true;

    // Fuzzy/partial match for larger blocks (allow small changes like comments)
    // For now, strict line-by-line containment check for robustness
    const contentLines = content.split("\n").map((l) => l.trim()).filter((l) =>
      l.length > 5
    );
    if (contentLines.length === 0) continue;

    let matchedLines = 0;
    for (const line of contentLines) {
      if (span.text.includes(line)) matchedLines++;
    }

    if (matchedLines / contentLines.length > 0.8) return true;
  }

  return false;
}

/**
 * Segments markdown into semantic claims and enforces citation validity.
 * metrics: claims_total, claims_stripped, strip_rate.
 *
 * Segmentation strategy: split on bullet/list-item boundaries so that
 * each bullet point is ONE claim unit. A bullet ending with a valid
 * [SOURCE: ...] citation covers the entire bullet, preventing
 * sentence-level splitting from stripping multi-sentence bullets.
 */
export async function verifyClaims(text: string, spans: EvidenceSpan[]) {
  // Split on bullet boundaries only — each bullet is one claim unit.
  // The regex captures the delimiter so we can reconstruct the text.
  const claimUnits = text.split(/(\n- |\n\* |\n\d+\. )/);
  let claims_total = 0;
  let claims_stripped = 0;

  // Debug: log span paths available for matching
  console.log("[DEBUG verifyClaims] span count:", spans.length);
  if (spans.length > 0) {
    console.log(
      "[DEBUG verifyClaims] span[0] keys:",
      Object.keys(spans[0]).join(","),
    );
    console.log(
      "[DEBUG verifyClaims] span paths:",
      spans.map((s) =>
        `${s.path}:${s.start_line ?? s.line_start}-${s.end_line ?? s.line_end}`
      ).join(" | "),
    );
  }

  const verifiedParts = claimUnits.map((part, idx) => {
    // Skip delimiters and whitespace-only parts
    if (/^(\n- |\n\* |\n\d+\. |\s*)$/.test(part)) return part;

    // Skip very short non-technical fragments (headings, blank lines)
    if (part.trim().length < 10) return part;

    claims_total++;
    const citations = extractCitations(part); // Regex: [SOURCE: ...]
    const isTechnical =
      /[a-zA-Z0-9_]{3,}\.[a-zA-Z0-9_]{3,}|function|class|const|var/.test(part);

    console.log(
      `[DEBUG verifyClaims] claim[${idx}]: citations=${citations.length}, isTechnical=${isTechnical}, text=${
        part.substring(0, 80)
      }...`,
    );
    if (citations.length > 0) {
      console.log(
        `[DEBUG verifyClaims] citation paths:`,
        citations.map((c) => `${c.path}:${c.start}-${c.end}`).join(" | "),
      );
    }

    const validCitations = citations.filter((cit) => {
      const span = spans.find((s) => {
        const sPath = s.path === cit.path;
        const sStart = (s.start_line ?? s.line_start ?? 0) <= cit.start;
        const sEnd = (s.end_line ?? s.line_end ?? 0) >= cit.end;
        if (!sPath && s.path && cit.path) {
          // Log first mismatch for debugging
          console.log(
            `[DEBUG verifyClaims] path mismatch: span="${s.path}" vs cit="${cit.path}"`,
          );
        }
        return sPath && sStart && sEnd;
      });
      if (!span) {
        console.log(
          `[DEBUG verifyClaims] NO span match for citation ${cit.path}:${cit.start}-${cit.end}`,
        );
      }
      return !!span;
    });

    // Invariant: Invalid citation => remove ENTIRE claim unit
    if (
      (citations.length > 0 && validCitations.length !== citations.length) ||
      (!citations.length && isTechnical)
    ) {
      console.log(
        `[DEBUG verifyClaims] STRIPPING claim[${idx}]: citations=${citations.length}, valid=${validCitations.length}, isTechnical=${isTechnical}`,
      );
      claims_stripped++;
      return null;
    }
    return part;
  });

  const strip_rate = claims_total > 0 ? claims_stripped / claims_total : 0;
  // NOTE: Hard throw removed. Grounding gate in index.ts now handles retries/refusals.

  const rawJoined = verifiedParts.filter(Boolean).join("");
  const verifiedText = cleanupDanglingListMarkers(rawJoined);

  return { verifiedText, claims_total, claims_stripped, strip_rate };
}

function cleanupDanglingListMarkers(md: string): string {
  return md
    .replace(/\n- (?=\n|$)/g, "") // Remove empty bullets
    .replace(/\n\d+\. (?=\n|$)/g, "") // Remove empty numbers
    .replace(/\n{3,}/g, "\n\n"); // Collapse 3+ lines to 2
}

function extractCitations(
  text: string,
): { path: string; start: number; end: number }[] {
  // Use non-greedy (.+?) with a lookahead (?=:\d+-\d+\]) to stop at the LAST numeric boundary.
  // This allows multiple [SOURCE: ...] tags on a single line even if file paths contain colons (repo:...).
  // A greedy (.+) would consume multiple citations into a single match on the same line.
  const regex = /\[SOURCE:\s*(.+?)(?=:\d+-\d+\])\s*:(\d+)-(\d+)\]/g;
  const citations = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    citations.push({
      path: match[1].trim(),
      start: parseInt(match[2]),
      end: parseInt(match[3]),
    });
  }
  return citations;
}

export async function verifyGroundedness(
  response: string,
  spans: EvidenceSpan[],
): Promise<VerificationResult> {
  // Legacy function - we can either keep it or redirect it to verifyClaims
  const { verifiedText, claims_stripped } = await verifyClaims(response, spans);
  return {
    verifiedContent: verifiedText,
    score: claims_stripped === 0 ? 1.0 : 0.5, // Rough legacy mapping
    warnings: claims_stripped > 0
      ? ["Some unverified claims were removed."]
      : [],
    failedBlocks: [],
  };
}
