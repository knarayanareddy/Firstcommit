import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeGroundingScore,
  evaluateGroundingGate,
  type GroundingAttemptMetrics,
  type GroundingPolicy,
} from "../ai-task-router/grounding-gate.ts";

const policy: GroundingPolicy = {
  min_score: 0.6,
  max_strip_rate: 0.3,
  min_citations: 1,
  max_unverified_claims: 0,
  mode: "retry_then_refuse",
  applies_to_tasks: ["chat"],
};

function metrics(p: Partial<GroundingAttemptMetrics> = {}): GroundingAttemptMetrics {
  return {
    strip_rate: 0,
    claims_total: 5,
    claims_stripped: 0,
    citations_found: 3,
    snippets_resolved: 2,
    evidence_count: 5,
    ...p,
  };
}

Deno.test("mode=off always passes", () => {
  const d = evaluateGroundingGate(metrics(), { ...policy, mode: "off" }, 1, 3);
  assert(d.ok);
  assertEquals(d.should_retry, false);
});

Deno.test("no evidence => hard refuse, no retry", () => {
  const d = evaluateGroundingGate(metrics({ evidence_count: 0 }), policy, 1, 3);
  assertEquals(d.ok, false);
  assertEquals(d.reason_code, "no_evidence");
  assertEquals(d.should_retry, false);
  assert(d.user_message && d.user_message.length > 0);
});

Deno.test("well-grounded answer passes", () => {
  const d = evaluateGroundingGate(metrics(), policy, 1, 3);
  assert(d.ok, `expected ok, got ${d.reason_code}`);
});

Deno.test("missing citations => retry while attempts remain", () => {
  const d = evaluateGroundingGate(metrics({ citations_found: 0 }), policy, 1, 3);
  assertEquals(d.ok, false);
  assertEquals(d.reason_code, "no_citations");
  assertEquals(d.should_retry, true);
});

Deno.test("missing citations on final attempt => refuse", () => {
  const d = evaluateGroundingGate(metrics({ citations_found: 0 }), policy, 3, 3);
  assertEquals(d.ok, false);
  assertEquals(d.should_retry, false);
});

Deno.test("high strip rate is flagged", () => {
  const d = evaluateGroundingGate(metrics({ strip_rate: 0.8 }), policy, 1, 3);
  assertEquals(d.ok, false);
  assertEquals(d.reason_code, "high_strip_rate");
});

Deno.test("invalid citations take priority", () => {
  const d = evaluateGroundingGate(
    metrics({ invalid_citations_found: true }),
    policy,
    1,
    3,
  );
  assertEquals(d.reason_code, "invalid_citations");
});

Deno.test("computeGroundingScore: clean answer ~1.0", () => {
  const s = computeGroundingScore(metrics(), policy);
  assert(s >= 0.9, `score ${s}`);
});

Deno.test("computeGroundingScore: heavy stripping lowers score", () => {
  const s = computeGroundingScore(metrics({ strip_rate: 0.5 }), policy);
  assert(s < 0.6, `score ${s}`);
});
