import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyClaims } from "../ai-task-router/verifier.ts";
import type { EvidenceSpan } from "../ai-task-router/types.ts";

// Now testable: verifier.ts imports EvidenceSpan from types.ts (not the Deno.serve entrypoint).

function span(p: Partial<EvidenceSpan> = {}): EvidenceSpan {
  return {
    span_id: "S1",
    chunk_ref: "c1",
    chunk_pk: "c1",
    stable_chunk_id: "c1",
    path: "src/auth.ts",
    text: "export function authenticate(token) { return verifyJwt(token); }",
    start_line: 1,
    end_line: 20,
    ...p,
  };
}

Deno.test("claim with a valid in-range citation is kept", async () => {
  const text = "- authenticate verifies the jwt token [SOURCE: src/auth.ts:1-5]";
  const r = await verifyClaims(text, [span()]);
  assert(r.verifiedText.includes("authenticate"), "kept claim text");
  assertEquals(r.claims_stripped, 0);
  assertEquals(r.strip_rate, 0);
});

Deno.test("technical claim with NO citation is stripped", async () => {
  const text = "- the function processData calls handler.run() on startup";
  const r = await verifyClaims(text, [span()]);
  assert(r.claims_stripped >= 1, "uncited technical claim should be stripped");
  assert(!r.verifiedText.includes("processData"), "stripped text removed");
});

Deno.test("citation with an out-of-range line span is stripped", async () => {
  const text = "- authenticate is defined here [SOURCE: src/auth.ts:50-60]";
  const r = await verifyClaims(text, [span({ start_line: 1, end_line: 5 })]);
  assert(r.claims_stripped >= 1, "out-of-range citation invalidates the claim");
});

Deno.test("citation to a different path is stripped", async () => {
  const text = "- handler.run dispatches events [SOURCE: src/other.ts:1-5]";
  const r = await verifyClaims(text, [span({ path: "src/auth.ts" })]);
  assert(r.claims_stripped >= 1, "path mismatch invalidates the claim");
});
