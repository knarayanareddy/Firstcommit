/**
 * faithfulness.ts — Semantic grounding gate (Phase 3).
 *
 * The existing verifier (verifier.ts) is LEXICAL: it confirms a [SOURCE: path:line]
 * citation token exists in the allowed evidence spans. It does NOT confirm the cited
 * span actually SUPPORTS the sentence. This module adds that semantic check, so the
 * "grounded / zero-hallucination" guarantee becomes defensible.
 *
 * Design notes:
 *  - ADDITIVE + DEFAULT-OFF: enabled only when FAITHFULNESS_CHECK === "true". When off,
 *    callers get a no-op report and behavior is identical to today.
 *  - Self-contained (no import from index.ts) so it is unit-testable in isolation.
 *  - Three engines via FAITHFULNESS_ENGINE: "heuristic" (offline, deterministic; default
 *    when no model configured), "nli" (cross-encoder entailment endpoint, e.g.
 *    nli-deberta-v3), "llm" (LLM judge via the configured local/BYOK chat endpoint).
 *  - Network calls go through the SSRF-safe fetch.
 */
import { safeFetch } from "../_shared/external-url-policy.ts";

export interface ClaimEvidence {
  claim: string;
  evidenceTexts: string[];
}

export interface FaithfulnessResult {
  claim: string;
  supported: boolean;
  score: number; // 0..1 entailment confidence
  reason?: string;
}

export interface FaithfulnessReport {
  enabled: boolean;
  engine: string;
  threshold: number;
  results: FaithfulnessResult[];
  faithfulness_score: number; // mean score across claims (1 when no claims)
  entailment_failures: number;
  unsupported_claims: string[];
}

export function isFaithfulnessEnabled(): boolean {
  return (Deno.env.get("FAITHFULNESS_CHECK") || "").toLowerCase() === "true";
}

export function faithfulnessThreshold(): number {
  const t = Number(Deno.env.get("FAITHFULNESS_THRESHOLD"));
  return Number.isFinite(t) && t > 0 && t <= 1 ? t : 0.6;
}

// ─── Pure helpers (unit-tested) ───────────────────────────────────────────────

const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "were", "to", "of", "and", "or", "in",
  "on", "for", "with", "that", "this", "it", "as", "by", "be", "at", "from",
]);

export function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9_]+/g) || []).filter(
    (t) => t.length > 2 && !STOP.has(t),
  );
}

/**
 * Deterministic, offline entailment proxy: fraction of the claim's salient tokens
 * that appear in the evidence. Not a substitute for real NLI, but a safe default and
 * a fast pre-filter. Returns 0..1.
 */
export function heuristicEntailment(claim: string, evidenceTexts: string[]): number {
  const claimTokens = tokenize(claim);
  if (claimTokens.length === 0) return 1; // nothing technical to support
  const evidence = new Set(tokenize(evidenceTexts.join("\n")));
  if (evidence.size === 0) return 0;
  let hit = 0;
  for (const t of claimTokens) if (evidence.has(t)) hit++;
  return hit / claimTokens.length;
}

/**
 * Pure aggregation of per-claim results against a threshold.
 */
export function aggregate(
  results: FaithfulnessResult[],
  threshold: number,
): { faithfulness_score: number; entailment_failures: number; unsupported_claims: string[] } {
  if (results.length === 0) {
    return { faithfulness_score: 1, entailment_failures: 0, unsupported_claims: [] };
  }
  const unsupported = results.filter((r) => !r.supported).map((r) => r.claim);
  const mean = results.reduce((a, r) => a + r.score, 0) / results.length;
  return {
    faithfulness_score: Number(mean.toFixed(4)),
    entailment_failures: unsupported.length,
    unsupported_claims: unsupported,
  };
}

// ─── Engines ──────────────────────────────────────────────────────────────────

async function nliEntailment(claim: string, evidence: string): Promise<number> {
  const endpoint = Deno.env.get("NLI_ENDPOINT");
  if (!endpoint) return heuristicEntailment(claim, [evidence]);
  try {
    const res = await safeFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ premise: evidence, hypothesis: claim }),
    }, {
      allowHttp: false,
      allowAnyHost: false,
      allowedHostSuffixes: (Deno.env.get("NLI_HOST_SUFFIX") || "").split(",").filter(Boolean),
      allowPrivateHosts: [Deno.env.get("LOCAL_LLM_HOST") || "ollama"],
    });
    if (!res.ok) return heuristicEntailment(claim, [evidence]);
    const data = await res.json();
    // Expect { entailment: 0..1 } or { label, score }
    if (typeof data.entailment === "number") return data.entailment;
    if (data.label === "entailment" && typeof data.score === "number") return data.score;
    return heuristicEntailment(claim, [evidence]);
  } catch (_e) {
    return heuristicEntailment(claim, [evidence]);
  }
}

async function llmJudge(claim: string, evidence: string): Promise<number> {
  const base = Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1";
  const model = Deno.env.get("DEFAULT_LLM_MODEL") || Deno.env.get("OLLAMA_MODEL") || "llama3";
  const apiKey = Deno.env.get("LOCAL_LLM_API_KEY") || Deno.env.get("OLLAMA_API_KEY") || "ollama";
  const prompt =
    `Evidence:\n"""${evidence.slice(0, 4000)}"""\n\nClaim: "${claim}"\n\n` +
    `Does the evidence SUPPORT the claim? Reply with strict JSON: ` +
    `{"supported": true|false, "confidence": 0.0-1.0}. No prose.`;
  try {
    const res = await safeFetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a strict factual entailment judge." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    }, { allowHttp: true, allowPrivateHosts: [Deno.env.get("LOCAL_LLM_HOST") || "ollama"] });
    if (!res.ok) return heuristicEntailment(claim, [evidence]);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    if (typeof parsed.confidence === "number") {
      return parsed.supported === false ? Math.min(parsed.confidence, 0.49) : parsed.confidence;
    }
    return heuristicEntailment(claim, [evidence]);
  } catch (_e) {
    return heuristicEntailment(claim, [evidence]);
  }
}

async function scoreClaim(c: ClaimEvidence, engine: string): Promise<number> {
  const evidence = c.evidenceTexts.join("\n");
  if (engine === "nli") return nliEntailment(c.claim, evidence);
  if (engine === "llm") return llmJudge(c.claim, evidence);
  return heuristicEntailment(c.claim, c.evidenceTexts);
}

/**
 * Evaluate faithfulness for a set of cited claims. No-op (enabled:false, score 1) when
 * FAITHFULNESS_CHECK is not "true".
 */
export async function checkFaithfulness(
  claims: ClaimEvidence[],
  opts: { engine?: string; threshold?: number; force?: boolean } = {},
): Promise<FaithfulnessReport> {
  const enabled = opts.force ?? isFaithfulnessEnabled();
  const engine = (opts.engine || Deno.env.get("FAITHFULNESS_ENGINE") || "heuristic").toLowerCase();
  const threshold = opts.threshold ?? faithfulnessThreshold();

  if (!enabled) {
    return {
      enabled: false, engine, threshold, results: [],
      faithfulness_score: 1, entailment_failures: 0, unsupported_claims: [],
    };
  }

  const results: FaithfulnessResult[] = [];
  for (const c of claims) {
    const score = await scoreClaim(c, engine);
    results.push({ claim: c.claim, supported: score >= threshold, score: Number(score.toFixed(4)) });
  }
  const agg = aggregate(results, threshold);
  return { enabled: true, engine, threshold, results, ...agg };
}
