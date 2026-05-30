/**
 * Shared AI-task-router types.
 *
 * `EvidenceSpan` was previously defined in index.ts, which forced verifier.ts,
 * detective-retrieval.ts, and faithfulness.ts to import the 4,231-line entrypoint
 * (with its top-level `Deno.serve`) just to get a type — blocking their unit tests.
 * Extracting it here breaks that cycle. index.ts re-exports it for backward compat.
 */
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
