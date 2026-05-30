# Phase 3 — Tests for the invariants + semantic grounding gate

Closes the two biggest assurance gaps from the review: the security/AI invariants had
**zero tests**, and "zero-hallucination" was only a *lexical* check.

## What landed (all additive; default behavior unchanged)

### 1. Grounding-gate unit tests
`supabase/functions/__tests__/grounding_gate.test.ts` — real `Deno.test` coverage of
`computeGroundingScore` and `evaluateGroundingGate`: no-evidence ⇒ hard refuse, missing
citations ⇒ retry-then-refuse, high strip-rate flagged, invalid citations prioritized,
clean answers pass. Run: `deno test supabase/functions/__tests__/`.

### 2. Semantic faithfulness gate (new module)
`supabase/functions/ai-task-router/faithfulness.ts` — verifies each cited claim is actually
**entailed** by its cited evidence, not just that the citation token exists.
- **Default OFF** (`FAITHFULNESS_CHECK !== "true"`) → no-op, zero behavior change.
- Engines via `FAITHFULNESS_ENGINE`: `heuristic` (offline token-entailment, deterministic),
  `nli` (cross-encoder endpoint such as nli-deberta-v3 via `NLI_ENDPOINT`), `llm` (LLM judge
  via the configured local/BYOK chat endpoint). All network calls use the SSRF-safe fetch.
- Threshold via `FAITHFULNESS_THRESHOLD` (default 0.6). Emits `faithfulness_score`,
  `entailment_failures`, `unsupported_claims`.
- Unit-tested in `__tests__/faithfulness.test.ts` (pure logic runs offline).

### 3. RLS regression test (pgTAP)
`supabase/tests/rls_tenant_isolation_test.sql` — asserts RLS is enabled on
`notifications` / `learner_badges` / `knowledge_chunks`, that `organizations` has **no**
`USING (true)` SELECT policy, and that `get_decrypted_byok_key` is not executable by
`authenticated`. Run: `supabase test db` (needs the `pgtap` extension).

### 4. Golden eval set
`rag-eval/seed/golden.jsonl` — committed Q/A with expected source files, `min_citations`,
and `min_faithfulness`, so the RAG harness can assert semantic groundedness, not just
structural counts.

## Wiring the gate into the pipeline (Phase 4)
The gate is intentionally not yet wired into the 4,231-line `ai-task-router/index.ts`, to
avoid an invasive edit to an untested monolith. It lands cleanly once Phase 4 extracts the
per-claim citation data from `verifier.ts`. Integration shape:

```ts
import { checkFaithfulness } from "./faithfulness.ts";
// after verifyClaims(...) produces verifiedText + the per-claim {claim, citedSpans}:
const report = await checkFaithfulness(citedClaims); // no-op unless FAITHFULNESS_CHECK=true
metrics.faithfulness_score = report.faithfulness_score;
metrics.entailment_failures = report.entailment_failures;
// optionally: feed report.entailment_failures into the grounding gate as additional strip signal.
```
This keeps the external response contract identical; faithfulness adds telemetry + an
optional stricter gate, it does not change the citation/span shape consumers depend on.

## New env
`FAITHFULNESS_CHECK` (default false), `FAITHFULNESS_ENGINE` (heuristic|nli|llm),
`FAITHFULNESS_THRESHOLD` (default 0.6), `NLI_ENDPOINT`, `NLI_HOST_SUFFIX`.
