import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  aggregate,
  checkFaithfulness,
  type FaithfulnessResult,
  heuristicEntailment,
  tokenize,
} from "../ai-task-router/faithfulness.ts";

Deno.test("tokenize drops stopwords and short tokens", () => {
  assertEquals(tokenize("The login is in authService.ts"), [
    "login",
    "authservice",
  ]);
});

Deno.test("heuristicEntailment: supported claim scores high", () => {
  const ev = [
    "export function authenticate(token) { return verifyJwt(token); }",
  ];
  const s = heuristicEntailment("authenticate verifies the jwt token", ev);
  assert(s >= 0.5, `score ${s}`);
});

Deno.test("heuristicEntailment: unrelated claim scores low", () => {
  const ev = ["export function authenticate(token) {}"];
  const s = heuristicEntailment("the billing webhook retries three times", ev);
  assert(s < 0.34, `score ${s}`);
});

Deno.test("aggregate: empty => perfect, no failures", () => {
  const a = aggregate([], 0.6);
  assertEquals(a.faithfulness_score, 1);
  assertEquals(a.entailment_failures, 0);
});

Deno.test("aggregate: counts unsupported claims", () => {
  const results: FaithfulnessResult[] = [
    { claim: "a", supported: true, score: 0.9 },
    { claim: "b", supported: false, score: 0.2 },
  ];
  const a = aggregate(results, 0.6);
  assertEquals(a.entailment_failures, 1);
  assertEquals(a.unsupported_claims, ["b"]);
  assert(Math.abs(a.faithfulness_score - 0.55) < 1e-6);
});

Deno.test("checkFaithfulness: disabled by default is a no-op", async () => {
  const r = await checkFaithfulness([{ claim: "x", evidenceTexts: ["y"] }]);
  assertEquals(r.enabled, false);
  assertEquals(r.faithfulness_score, 1);
  assertEquals(r.results.length, 0);
});

Deno.test("checkFaithfulness: forced heuristic flags unsupported claim", async () => {
  const r = await checkFaithfulness(
    [
      {
        claim: "authenticate verifies the jwt token",
        evidenceTexts: [
          "function authenticate(token){ return verifyJwt(token); }",
        ],
      },
      {
        claim: "the scheduler purges stale ingestion jobs nightly",
        evidenceTexts: ["const x = 1;"],
      },
    ],
    { force: true, engine: "heuristic", threshold: 0.6 },
  );
  assertEquals(r.enabled, true);
  assertEquals(r.engine, "heuristic");
  assertEquals(r.entailment_failures, 1);
  assert(r.unsupported_claims[0].includes("scheduler"));
});
