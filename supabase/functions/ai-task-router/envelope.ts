// @ts-nocheck
/**
 * envelope.ts — request-envelope preprocessing, secret redaction, input
 * sanitization, and the module section-index builder (monolith split, stage 3c-ii).
 *
 * Leaf module: depends only on ./responses.ts and the shared secret-patterns /
 * supabase-clients utilities — never on index.ts, so there is no import cycle.
 *
 * Carries @ts-nocheck (like ai-call.ts / persistence.ts) because buildSectionIndex
 * uses the untyped Supabase query builder and these helpers operate on the `any`
 * request envelope. Tightening these types is tracked under the P1 "TS strict" work.
 */
import { redactText as sharedRedactText } from "../_shared/secret-patterns.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { structuredError } from "./responses.ts";

/**
 * Structural Code Enforcement: Block unauthorized repo code fences.
 */
export function enforceNoDirectCode(text: string): string {
  const blocks = text.match(/```(\w+)?\n([\s\S]*?)```/g) || [];
  for (const block of blocks) {
    const firstLine = block.split("\n")[1] || "";
    if (
      firstLine.includes("// PSEUDOCODE") || firstLine.includes("# PSEUDOCODE")
    ) continue;
    if (firstLine.includes("// SOURCE:")) continue;

    // Violation of the snippet contract
    throw new Error(
      "UNAUTHORIZED_CODE_BLOCK: You must not write actual repository code directly. Use [SNIPPET: filepath:start-end | lang=...] instead.",
    );
  }
  return text;
}

// ─── SECRET REDACTION (shared with ingestion) ───
export function redactText(
  text: string,
): { text: string; wasRedacted: boolean } {
  const result = sharedRedactText(text);
  return { text: result.redactedText, wasRedacted: result.secretsFound > 0 };
}

export function redactSpans(
  spans: any[],
): { spans: any[]; warnings: string[] } {
  const warnings: string[] = [];
  const redacted = spans.map((s: any) => {
    if (!s.text) return s;
    const { text, wasRedacted } = redactText(s.text);
    if (wasRedacted) {
      warnings.push(
        `Secret pattern detected in span ${s.span_id} and redacted before AI processing.`,
      );
      console.warn(
        `[SECOND-PASS REDACTION] Secret found in span ${s.span_id}, path: ${s.path}`,
      );
    }
    return { ...s, text };
  });
  return { spans: redacted, warnings };
}

// ─── INPUT SANITIZATION (graceful truncation) ───
export function sanitizeInputs(envelope: any): { warnings: string[] } {
  const warnings: string[] = [];

  // a. author_instruction ≤ 2000 chars — hard reject
  const authorInstruction = envelope.context?.author_instruction;
  if (authorInstruction && authorInstruction.length > 2000) {
    // This is a hard limit — reject
    throw {
      hard_error: true,
      code: "invalid_input",
      message: "author_instruction exceeds maximum length of 2000 characters.",
    };
  }

  // b/c. evidence_spans: truncate to 50, then trim total text to 100k
  const spans = envelope.retrieval?.evidence_spans;
  if (spans) {
    if (spans.length > 50) {
      envelope.retrieval.evidence_spans = spans.slice(0, 50);
      warnings.push(`Evidence truncated: ${spans.length} spans reduced to 50.`);
    }
    let totalText = 0;
    const kept: any[] = [];
    for (const s of envelope.retrieval.evidence_spans) {
      const len = s.text?.length || 0;
      if (totalText + len > 100000) {
        warnings.push(
          `Evidence truncated: total text exceeded 100,000 characters. ${
            envelope.retrieval.evidence_spans.length - kept.length
          } span(s) dropped.`,
        );
        break;
      }
      totalText += len;
      kept.push(s);
    }
    envelope.retrieval.evidence_spans = kept;
  }

  // d. conversation messages: keep last 50
  const messages = envelope.context?.conversation?.messages;
  if (messages && messages.length > 50) {
    const original = messages.length;
    envelope.context.conversation.messages = messages.slice(-50);
    warnings.push(
      `Conversation truncated: ${original} messages reduced to last 50.`,
    );
  }

  // e. Per-message content ≤ 5000 chars
  if (envelope.context?.conversation?.messages) {
    for (const msg of envelope.context.conversation.messages) {
      if (msg.content && msg.content.length > 5000) {
        msg.content = msg.content.slice(0, 5000) + "...[truncated]";
      }
    }
  }

  return { warnings };
}

export function preprocessEnvelope(
  envelope: any,
  headers: Record<string, string>,
): { envelope: any; warnings: string[] } | Response {
  const warnings: string[] = [];

  // Sanitize inputs (graceful truncation)
  try {
    const sanitizeResult = sanitizeInputs(envelope);
    warnings.push(...sanitizeResult.warnings);
  } catch (e: any) {
    if (e.hard_error) {
      const requestId = envelope.task?.request_id || "unknown";
      return structuredError(
        requestId,
        e.code || "invalid_input",
        e.message,
        headers,
      );
    }
    throw e;
  }

  // Second-pass redaction on evidence spans
  if (envelope.retrieval?.evidence_spans?.length) {
    const { spans, warnings: redactWarnings } = redactSpans(
      envelope.retrieval.evidence_spans,
    );
    envelope.retrieval.evidence_spans = spans;
    warnings.push(...redactWarnings);
  }

  return { envelope, warnings };
}

// ─── SECTION INDEX BUILDER ───
export async function buildSectionIndex(
  packId: string,
  moduleKey: string | null,
  maxEntries: number,
): Promise<string> {
  if (!packId) return "";
  try {
    const sb = createServiceClient();
    let q = sb
      .from("generated_modules")
      .select("module_key, module_data")
      .eq("pack_id", packId)
      .eq("status", "published");
    if (moduleKey) q = q.eq("module_key", moduleKey);
    const { data } = await q.limit(20);
    if (!data || data.length === 0) return "";
    const lines: string[] = [];
    for (const row of data) {
      // module_data is the module object directly — no extra .module wrapper
      const sections: any[] = (row.module_data as any)?.sections || [];
      for (
        const sec of sections.slice(
          0,
          Math.ceil(maxEntries / (data.length || 1)),
        )
      ) {
        const summary = (sec.markdown || "").replace(/[#\n]/g, " ").slice(
          0,
          180,
        ).trim();
        lines.push(
          `- module_key: ${row.module_key} | section_id: ${sec.section_id} | heading: "${sec.heading}" | summary: ${summary}`,
        );
        if (lines.length >= maxEntries) break;
      }
      if (lines.length >= maxEntries) break;
    }
    if (lines.length === 0) return "";
    return `\n## Module Section Index (use for referenced_sections)\nWhen your answer maps to one of these sections, include it in referenced_sections.\n${
      lines.join("\n")
    }\n`;
  } catch (e) {
    console.warn("[buildSectionIndex] failed:", e);
    return "";
  }
}
