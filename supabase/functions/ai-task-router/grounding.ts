/**
 * grounding.ts — self-contained grounding helpers (monolith split, stage 3b). Leaf module.
 * (DB-bound recordRagMetrics/recordAiAudit + envelope/redaction helpers are a separate stage.)
 */
import type { GroundingPolicy } from "./grounding-gate.ts";

export function resolveGroundingPolicy(
  taskType: string,
  pack: any = {},
): GroundingPolicy {
  // Use pack settings if available, otherwise fallback to environment variables
  const packPolicy = pack.grounding_policy || {};

  const minScore = packPolicy.min_score ??
    Number(Deno.env.get("GROUNDING_MIN_SCORE") || "0.80");
  const maxStripRate = packPolicy.max_strip_rate ??
    Number(Deno.env.get("STRIP_RATE_MAX") || "0.20");
  const minCitations = packPolicy.min_citations ??
    Number(Deno.env.get("MIN_CITATIONS") || "1");
  const maxUnverified = packPolicy.max_unverified_claims ??
    Number(Deno.env.get("MAX_UNVERIFIED_CLAIMS") || "0");
  const mode = packPolicy.mode ??
    (Deno.env.get("GROUNDING_GATE_MODE") || "retry_then_refuse");
  const appliesToTasks = packPolicy.applies_to_tasks ??
    (Deno.env.get("GROUNDING_GATE_APPLIES_TO_TASKS") ||
      "chat,global_chat,generate_module,refine_module,generate_quiz");

  const taskList = appliesToTasks.split(",").map((t: string) => t.trim());

  // If task isn't in the list, effectively turn it off for this task
  const finalMode = taskList.includes(taskType) ? mode : "off";

  return {
    min_score: minScore,
    max_strip_rate: maxStripRate,
    min_citations: minCitations,
    max_unverified_claims: maxUnverified,
    mode: finalMode as any,
    applies_to_tasks: taskList,
  };
}

export async function quickVerifyCitations(
  content: string,
  spans: any[],
): Promise<{ verified: string; warnings: string[] }> {
  // Use non-greedy (.+?) with a lookahead (?=:\d+-\d+\]) to stop at the LAST numeric boundary.
  // This allows multiple [SOURCE: ...] tags on a single line even if file paths contain colons (repo:...).
  // A greedy (.+) would consume multiple citations into a single match on the same line.
  const citationGlobalRegex =
    /\[SOURCE:\s*(.+?)(?=:\d+-\d+\])\s*:(\d+)-(\d+)\]/g;
  const citationSingleRegex =
    /\[SOURCE:\s*(.+?)(?=:\d+-\d+\])\s*:(\d+)-(\d+)\]/;
  const citations = content.match(citationGlobalRegex) || [];
  const warnings: string[] = [];
  let verified = content;

  for (const cit of citations) {
    const parts = cit.match(citationSingleRegex);
    if (!parts) continue;
    const [_, path, start, end] = parts;
    const exists = spans.some((s) =>
      s.path === path &&
      (s.line_start?.toString() === start ||
        s.start_line?.toString() === start || start === "?")
    );
    if (!exists) {
      warnings.push(`Hallucinated citation removed: ${cit}`);
      verified = verified.replace(
        cit,
        "[CITATION REMOVED: source not found in retrieval]",
      );
    }
  }
  return { verified, warnings };
}

export async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildEvidenceManifest(retrieval: any, sourceMap: any[] = []): any {
  const manifest: any = {
    citations: sourceMap.map((cit, idx) => ({
      badge: cit.badge || `S${idx + 1}`,
      chunk_ref: cit.chunk_ref,
      chunk_pk: cit.chunk_pk,
      stable_chunk_id: cit.stable_chunk_id,
      chunk_id: cit.stable_chunk_id || cit.chunk_id, // TEXT fallback
      path: cit.path || cit.filepath,
      start: cit.start || cit.line_start || cit.start_line,
      end: cit.end || cit.line_end || cit.end_line,
    })),
    spans_used: (retrieval.evidence_spans || []).map((s: any) => ({
      chunk_ref: s.chunk_ref,
      chunk_pk: s.chunk_pk,
      stable_chunk_id: s.stable_chunk_id,
      chunk_id: s.stable_chunk_id || s.chunk_id, // TEXT fallback
      path: s.path,
      start_line: s.line_start || s.start_line,
      end_line: s.line_end || s.end_line,
    })),
  };
  return manifest;
}
