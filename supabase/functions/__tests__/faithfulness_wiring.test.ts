import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyClaims } from "../ai-task-router/verifier.ts";
import type { EvidenceSpan } from "../ai-task-router/types.ts";

// Verifies the faithfulness gate is wired into verifyClaims: OFF = no behavior change,
// ON = cited-but-unentailed claims are stripped (folded into strip_rate).

function span(text: string): EvidenceSpan {
  return {
    span_id: "S1", chunk_ref: "c1", chunk_pk: "c1", stable_chunk_id: "c1",
    path: "src/x.ts", text, start_line: 1, end_line: 50,
  };
}

Deno.test("gate OFF (default): cited-but-unfaithful claim is kept", async () => {
  Deno.env.delete("FAITHFULNESS_CHECK");
  const text = "- the scheduler retries failed jobs every night [SOURCE: src/x.ts:1-5]";
  const r = await verifyClaims(text, [span("export const a = 1;")]);
  assertEquals(r.entailment_failures, 0);
  assert(r.verifiedText.includes("scheduler"));
});

Deno.test("gate ON (heuristic): unentailed cited claim is stripped", async () => {
  Deno.env.set("FAITHFULNESS_CHECK", "true");
  Deno.env.set("FAITHFULNESS_ENGINE", "heuristic");
  Deno.env.set("FAITHFULNESS_THRESHOLD", "0.6");
  try {
    const text = "- the scheduler retries failed jobs every night [SOURCE: src/x.ts:1-5]";
    const r = await verifyClaims(text, [span("export const a = 1;")]);
    assert(r.entailment_failures >= 1, "unentailed claim should be stripped");
    assert(!r.verifiedText.includes("scheduler"));
    assert(r.strip_rate > 0);
  } finally {
    Deno.env.delete("FAITHFULNESS_CHECK");
  }
});

Deno.test("gate ON (heuristic): entailed cited claim is kept", async () => {
  Deno.env.set("FAITHFULNESS_CHECK", "true");
  Deno.env.set("FAITHFULNESS_ENGINE", "heuristic");
  try {
    const text = "- authenticate verifies the jwt token [SOURCE: src/x.ts:1-5]";
    const r = await verifyClaims(text, [
      span("function authenticate verifies the jwt token here"),
    ]);
    assertEquals(r.entailment_failures, 0);
    assert(r.verifiedText.includes("authenticate"));
  } finally {
    Deno.env.delete("FAITHFULNESS_CHECK");
  }
});
