// @ts-nocheck
/**
 * rocketboard-mcp/redaction.ts
 *
 * Output redaction + hard capping for MCP tool outputs.
 * Re-uses the centralized _shared/secret-patterns.ts redactText function.
 *
 * SECURITY INVARIANTS:
 * - All text returned by tools MUST flow through redactAndCap
 * - Hard cap is enforced after redaction (to avoid attacker inflating output)
 * - Truncation is clearly marked with a TRUNCATED marker
 */

import { redactText } from "../_shared/secret-patterns.ts";

export const TRUNCATION_MARKER = "\n…[TRUNCATED]…";

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Redacts secrets and enforces a hard character cap.
 * Returns the redacted + truncated text and redaction metrics.
 */
export function redactAndCap(
  text: string,
  maxChars: number,
): {
  text: string;
  redacted: boolean;
  truncated: boolean;
  secretsFound: number;
} {
  if (!text) {
    return { text: "", redacted: false, truncated: false, secretsFound: 0 };
  }

  const result = redactText(text);
  const { redactedText, secretsFound } = result;

  const wasRedacted = secretsFound > 0;

  if (redactedText.length <= maxChars) {
    return {
      text: redactedText,
      redacted: wasRedacted,
      truncated: false,
      secretsFound,
    };
  }

  // Hard cap: truncate at maxChars (leaving room for the marker)
  const cutAt = maxChars - TRUNCATION_MARKER.length;
  const truncated = redactedText.slice(0, Math.max(0, cutAt)) +
    TRUNCATION_MARKER;
  return {
    text: truncated,
    redacted: wasRedacted,
    truncated: true,
    secretsFound,
  };
}

/**
 * Redacts and caps each element of an array, also enforcing a total char budget.
 * Items beyond the total budget are replaced with the truncation marker.
 */
export function redactAndCapArray(
  texts: string[],
  maxPerItem: number,
  totalMax: number,
): { items: string[]; totalChars: number; anyTruncated: boolean } {
  let totalChars = 0;
  const items: string[] = [];
  let anyTruncated = false;

  for (const text of texts) {
    if (totalChars >= totalMax) {
      items.push(TRUNCATION_MARKER);
      anyTruncated = true;
      break;
    }

    const remaining = totalMax - totalChars;
    const effectiveCap = Math.min(maxPerItem, remaining);
    const result = redactAndCap(text, effectiveCap);
    items.push(result.text);
    totalChars += result.text.length;
    if (result.truncated) anyTruncated = true;
  }

  return { items, totalChars, anyTruncated };
}

/**
 * Stitches multiple chunk texts (ordered by line_start) into a single document,
 * then redacts + caps the full result.
 */
export function stitchAndRedact(
  chunks: Array<{ content: string; line_start: number }>,
  maxChars: number,
): { text: string; truncated: boolean; secretsFound: number } {
  // Sort by line_start defensively
  const sorted = [...chunks].sort((a, b) => a.line_start - b.line_start);
  const combined = sorted.map((c) => c.content).join("\n");
  const result = redactAndCap(combined, maxChars);
  return {
    text: result.text,
    truncated: result.truncated,
    secretsFound: result.secretsFound,
  };
}
