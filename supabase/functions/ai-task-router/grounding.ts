/**
 * grounding.ts — self-contained grounding helpers (monolith split, stage 3b). Leaf module.
 * (DB-bound recordRagMetrics/recordAiAudit + envelope/redaction helpers are a separate stage.)
 */
import type { GroundingPolicy } from "./grounding-gate.ts";

export function resolveGroundingPolicy(
  taskType: string,
  pack: any = {}

export async function quickVerifyCitations(
  content: string,
  spans: any[],
): Promise<{ verified: string; warnings: string[] }

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
