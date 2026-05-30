/**
 * grounding-gate.ts
 *
 * Implements strict "Grounding SLO Gate" logic.
 * Responses must meet minimum grounding criteria or the router must retry/refuse.
 */

export type GroundingAttemptMetrics = {
  grounding_score?: number; // computed if not provided
  strip_rate: number;
  claims_total: number;
  claims_stripped: number;
  citations_found: number;
  citations_verified?: number; // count of valid unique badges
  snippets_resolved: number;
  evidence_count: number;
  invalid_citations_found?: boolean;
  invalid_citations_list?: string[];
  source_map?: any[];
  warnings?: string[];
};

export type GroundingPolicy = {
  min_score: number;
  max_strip_rate: number;
  min_citations: number;
  max_unverified_claims: number;
  mode: "off" | "retry_then_refuse" | "refuse" | "retry_only";
  applies_to_tasks: string[]; // CSV parsed
};

export type GroundingDecision = {
  ok: boolean;
  should_retry: boolean;
  reason_code:
    | "ok"
    | "low_grounding"
    | "high_strip_rate"
    | "no_citations"
    | "no_evidence"
    | "too_many_unverified"
    | "invalid_citations"
    | "policy_refuse";
  user_message?: string; // only for refuse
};

/**
 * Deterministically computes a grounding score from metrics.
 * Range: 0.0 to 1.0
 */
export function computeGroundingScore(
  metrics: GroundingAttemptMetrics,
  policy: GroundingPolicy,
): number {
  if (metrics.grounding_score !== undefined) return metrics.grounding_score;

  let base = 1.0;

  // 1. Strip rate penalty (heavy)
  base -= Math.min(1, metrics.strip_rate * 1.5);

  // 2. Missing citations penalty
  const citationShortfall = Math.max(
    0,
    policy.min_citations - metrics.citations_found,
  );
  base -= Math.min(1, citationShortfall * 0.2);

  // 3. No snippets if evidence is code
  if (
    metrics.evidence_count > 0 && metrics.snippets_resolved === 0 &&
    metrics.claims_total > 5
  ) {
    base -= 0.3;
  }

  return Math.max(0, Math.min(1, base));
}

/**
 * Core gate evaluation logic.
 */
export function evaluateGroundingGate(
  metrics: GroundingAttemptMetrics,
  policy: GroundingPolicy,
  attempt: number,
  maxAttempts: number,
): GroundingDecision {
  if (policy.mode === "off") {
    return { ok: true, should_retry: false, reason_code: "ok" };
  }

  // A. No evidence is an automatic refusal
  if (metrics.evidence_count === 0) {
    return {
      ok: false,
      should_retry: false,
      reason_code: "no_evidence",
      user_message:
        "I couldn't find any relevant code or documentation to provide a grounded answer. Please ensure your sources are indexed.",
    };
  }

  let failedReason: GroundingDecision["reason_code"] | null = null;

  // B. Check citations
  if (metrics.citations_found < policy.min_citations) {
    failedReason = "no_citations";
  }

  // C. Check strip rate
  if (metrics.strip_rate > policy.max_strip_rate) {
    failedReason = "high_strip_rate";
  }

  // C2. Check for Hallucinated / Out-of-evidence citations (priority over strip rate to avoid score inflation)
  if (metrics.invalid_citations_found) {
    failedReason = "invalid_citations";
  }

  // D. Check score
  const score = computeGroundingScore(metrics, policy);
  if (score < policy.min_score && !failedReason) {
    failedReason = "low_grounding";
  }

  if (!failedReason) {
    return { ok: true, should_retry: false, reason_code: "ok" };
  }

  // Decide if we should retry or refuse
  const canRetry =
    (policy.mode === "retry_then_refuse" || policy.mode === "retry_only") &&
    attempt < maxAttempts;

  if (canRetry) {
    return { ok: false, should_retry: true, reason_code: failedReason };
  } else {
    // Refuse
    return {
      ok: false,
      should_retry: false,
      reason_code: failedReason,
      user_message: "Insufficient evidence to provide a confident answer.",
    };
  }
}

/**
 * Gets the Grounding Retry Directive prompt enhancement.
 */
export function getRetryDirective(
  reason: GroundingDecision["reason_code"],
): string {
  const base = "\n\n[STRICT GROUNDING RETRY DIRECTIVE]:\n";
  const rules = [
    "- You MUST cite every technical claim with [SOURCE: filepath:start-end].",
    "- If you cannot cite a claim, do NOT make it. Say 'I don't know based on current sources'.",
    "- Prefer fewer claims/shorter response if it means 100% grounding.",
    "- Ensure every [SNIPPET] has a matching [SOURCE] citation within 300 characters above it.",
  ];

  if (reason === "no_citations") {
    rules.push(
      "- Your previous response had 0 citations. You MUST output exactly 5 bullets using the template below.",
    );
    rules.push("- Each bullet MUST end with a copied ALLOWED SOURCE TOKEN.");
    rules.push("\nRESPONSE TEMPLATE (MUST FOLLOW EXACTLY):");
    rules.push(
      "- <one sentence claim> [SOURCE: <copy one allowed token exactly>]",
    );
    rules.push(
      "- <one sentence claim> [SOURCE: <copy one allowed token exactly>]",
    );
    rules.push(
      "- <one sentence claim> [SOURCE: <copy one allowed token exactly>]",
    );
    rules.push(
      "- <one sentence claim> [SOURCE: <copy one allowed token exactly>]",
    );
    rules.push(
      "- <one sentence claim> [SOURCE: <copy one allowed token exactly>]",
    );
  } else if (reason === "high_strip_rate") {
    rules.push(
      "- Your previous response had too many hallucinated or unverified claims which were stripped.",
      "- REWRITE using the One-Sentence-Per-Bullet contract: Each bullet must be exactly one sentence ending with its own citation [SOURCE: ...].",
      "- Split multi-sentence thoughts into separate bullets to ensure every claim unit is cited.",
    );
  } else if (reason === "invalid_citations") {
    rules.push(
      "- You cited a SOURCE not in the allowlist. Only copy tokens from the ALLOWED SOURCE TOKENS section.",
    );
  }

  return base + rules.join("\n") + "\n\nPLEASE RE-GENERATE.";
}
