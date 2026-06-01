import type { EvidenceSpan } from "./types.ts";
import { checkFaithfulness, isFaithfulnessEnabled } from "./faithfulness.ts";

/**
 * Advanced grounding verification for RAG responses.
 *
 * Stage 2 of the grounding pipeline. Two layers:
 *  1. LEXICAL (always on): every technical claim must carry a [SOURCE: path:start-end]
 *     citation whose path + line-range exists in the retrieved evidence spans, or the
 *     whole claim unit is stripped.
 *  2. SEMANTIC (opt-in via FAITHFULNESS_CHECK): each kept, cited claim is additionally
 *     checked for ENTAILMENT against its cited evidence (see faithfulness.ts). Claims the
 *     evidence does not support are stripped too. Default OFF => behavior unchanged.
 */

export interface VerificationResult {
  verifiedContent: string;
  score: number; // 0.0 to 1.0
  warnings: string[];
  failedBlocks: string[];
}

/** Extracts fenced code blocks from markdown text. */
function extractCodeBlocks(text: string): string[] {
  const regex = /```[\s\S]*?```/g;
  return text.match(regex) || [];
}

/** Substring/fuzzy check that a code block is present in the evidence spans. */
function isCodeGrounded(block: string, spans: EvidenceSpan[]): boolean {
  const lines = block.split("\n");
  if (lines.length < 2) return true;
  const content = lines.slice(1, -1).join("\n").trim();
  if (!content) return true;
  for (const span of spans) {
    if (span.text.includes(content)) return true;
    const contentLines = content.split("\n").map((l) => l.trim()).filter((l) => l.length > 5);
    if (contentLines.length === 0) continue;
    let matchedLines = 0;
    for (const line of contentLines) if (span.text.includes(line)) matchedLines++;
    if (matchedLines / contentLines.length > 0.8) return true;
  }
  return false;
}

interface ClaimMatch {
  partPos: number; // index into verifiedParts
  claim: string; // claim text with citations stripped
  evidenceTexts: string[]; // text of the spans the claim cited
}

/**
 * Segments markdown into claim units (one per bullet/list item), enforces citation
 * validity, and (optionally) semantic faithfulness. Returns grounding metrics.
 */
export async function verifyClaims(text: string, spans: EvidenceSpan[]) {
  // Split on bullet boundaries; the delimiters are captured so we can reconstruct the text.
  const claimUnits = text.split(/(\n- |\n\* |\n\d+\. )/);
  let claims_total = 0;
  let claims_stripped = 0;

  const verifiedParts: (string | null)[] = [];
  const keptCited: ClaimMatch[] = []; // kept claims with valid citations -> faithfulness candidates

  claimUnits.forEach((part) => {
    // Pass through delimiters, whitespace, and very short fragments unchanged.
    if (/^(\n- |\n\* |\n\d+\. |\s*)$/.test(part) || part.trim().length < 10) {
      verifiedParts.push(part);
      return;
    }

    claims_total++;
    const citations = extractCitations(part);
    const isTechnical =
      /[a-zA-Z0-9_]{3,}\.[a-zA-Z0-9_]{3,}|function|class|const|var/.test(part);

    const matchedSpans: EvidenceSpan[] = [];
    const validCitations = citations.filter((cit) => {
      const span = spans.find((s) =>
        s.path === cit.path &&
        (s.start_line ?? s.line_start ?? 0) <= cit.start &&
        (s.end_line ?? s.line_end ?? 0) >= cit.end
      );
      if (span) matchedSpans.push(span);
      return !!span;
    });

    // Invariant: any invalid citation, or an uncited technical claim => strip the whole unit.
    if (
      (citations.length > 0 && validCitations.length !== citations.length) ||
      (!citations.length && isTechnical)
    ) {
      claims_stripped++;
      verifiedParts.push(null);
      return;
    }

    // Kept. Queue cited claims for the optional semantic faithfulness pass.
    if (validCitations.length > 0) {
      keptCited.push({
        partPos: verifiedParts.length,
        claim: part.replace(/\[SOURCE:[^\]]*\]/g, "").trim(),
        evidenceTexts: matchedSpans.map((s) => s.text ?? (s as { content?: string }).content ?? ""),
      });
    }
    verifiedParts.push(part);
  });

  // ── Stage 2b: semantic faithfulness (opt-in; default OFF is a no-op) ──────────
  let faithfulness_score = 1;
  let entailment_failures = 0;
  if (isFaithfulnessEnabled() && keptCited.length > 0) {
    const report = await checkFaithfulness(
      keptCited.map((k) => ({ claim: k.claim, evidenceTexts: k.evidenceTexts })),
    );
    faithfulness_score = report.faithfulness_score;
    report.results.forEach((res, i) => {
      if (!res.supported) {
        const pos = keptCited[i].partPos;
        if (verifiedParts[pos] != null) {
          verifiedParts[pos] = null; // strip claims the evidence does not entail
          claims_stripped++;
          entailment_failures++;
        }
      }
    });
  }

  const strip_rate = claims_total > 0 ? claims_stripped / claims_total : 0;
  const rawJoined = verifiedParts.filter(Boolean).join("");
  const verifiedText = cleanupDanglingListMarkers(rawJoined);

  return {
    verifiedText,
    claims_total,
    claims_stripped,
    strip_rate,
    faithfulness_score, // 1 when the gate is off
    entailment_failures, // 0 when the gate is off
  };
}

function cleanupDanglingListMarkers(md: string): string {
  return md
    .replace(/\n- (?=\n|$)/g, "")
    .replace(/\n\d+\. (?=\n|$)/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function extractCitations(
  text: string,
): { path: string; start: number; end: number }[] {
  // Non-greedy (.+?) with a lookahead to stop at the LAST numeric boundary, so multiple
  // [SOURCE: ...] tags on one line parse correctly even when paths contain colons.
  const regex = /\[SOURCE:\s*(.+?)(?=:\d+-\d+\])\s*:(\d+)-(\d+)\]/g;
  const citations: { path: string; start: number; end: number }[] = [];
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
  const { verifiedText, claims_stripped } = await verifyClaims(response, spans);
  return {
    verifiedContent: verifiedText,
    score: claims_stripped === 0 ? 1.0 : 0.5,
    warnings: claims_stripped > 0 ? ["Some unverified claims were removed."] : [],
    failedBlocks: [],
  };
}

// Retained for callers/tests that check code-block grounding directly.
export { extractCodeBlocks, isCodeGrounded };
