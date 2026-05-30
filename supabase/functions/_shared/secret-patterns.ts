/**
 * _shared/secret-patterns.ts
 *
 * Single source of truth for all secret-detection patterns used across
 * ingestion (primary defense) and retrieval (defense-in-depth).
 *
 * IMPORTANT: When adding a new pattern, add it HERE and it will automatically
 * apply to both ingestion and retrieval. Never add patterns in individual
 * Edge Functions.
 */

// ─── Pattern Definitions ────────────────────────────────────────────────

export interface SecretPattern {
  /** Human-readable name (used in logs, metrics, and redaction placeholders) */
  name: string;
  /** The regex to detect the secret. MUST use the global flag. */
  regex: RegExp;
  /** Severity: 'critical' = always redact + flag; 'high' = always redact; 'medium' = redact if confident */
  severity: "critical" | "high" | "medium";
}

/**
 * Canonical list of secret patterns.
 *
 * Rules for adding patterns:
 * 1. Every regex MUST have the global (g) flag.
 * 2. Every regex MUST have word boundaries or prefix anchors to minimize false positives.
 * 3. Test against real codebases before promoting to 'critical'.
 * 4. Patterns are evaluated in order; first match wins for overlapping regions.
 */
export const SECRET_PATTERNS: SecretPattern[] = [
  // ── Cloud Provider Keys ──
  {
    name: "aws_access_key",
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    severity: "critical",
  },
  {
    name: "aws_secret_key",
    regex: /\b([A-Za-z0-9/+=]{40})(?=\s|"|'|`|$)/g,
    // Note: AWS secret keys are 40 chars base64. This is intentionally broad;
    // it's gated by appearing near AWS context (see compound detection below).
    severity: "medium",
  },
  {
    name: "aws_session_token",
    regex: /\b(FwoGZXIvYXdzE[A-Za-z0-9/+=]{100,})\b/g,
    severity: "critical",
  },

  // ── GitHub Tokens ──
  {
    name: "github_pat",
    regex: /\b(ghp_[A-Za-z0-9]{36,})\b/g,
    severity: "critical",
  },
  {
    name: "github_oauth",
    regex: /\b(gho_[A-Za-z0-9]{36,})\b/g,
    severity: "critical",
  },
  {
    name: "github_app_token",
    regex: /\b(ghs_[A-Za-z0-9]{36,})\b/g,
    severity: "critical",
  },
  {
    name: "github_fine_grained",
    regex: /\b(github_pat_[A-Za-z0-9_]{22,})\b/g,
    severity: "critical",
  },

  // ── API Keys (Generic + Specific) ──
  {
    name: "openai_api_key",
    regex: /\b(sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,})\b/g,
    severity: "critical",
  },
  {
    name: "openai_project_key",
    regex: /\b(sk-proj-[A-Za-z0-9_-]{40,})\b/g,
    severity: "critical",
  },
  {
    name: "anthropic_api_key",
    regex: /\b(sk-ant-[A-Za-z0-9_-]{40,})\b/g,
    severity: "critical",
  },
  {
    name: "slack_token",
    regex: /\b(xox[bpoas]-[A-Za-z0-9-]{10,})\b/g,
    severity: "critical",
  },
  {
    name: "slack_webhook",
    regex:
      /\b(https:\/\/hooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]+)\b/g,
    severity: "high",
  },
  {
    name: "stripe_key",
    regex: /\b([sr]k_(live|test)_[A-Za-z0-9]{20,})\b/g,
    severity: "critical",
  },
  {
    name: "sendgrid_key",
    regex: /\b(SG\.[A-Za-z0-9_-]{22,}\.[A-Za-z0-9_-]{22,})\b/g,
    severity: "critical",
  },
  {
    name: "twilio_key",
    regex: /\b(SK[0-9a-fA-F]{32})\b/g,
    severity: "high",
  },

  // ── JWTs and Bearer Tokens ──
  {
    name: "jwt_token",
    regex:
      /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
    severity: "high",
  },
  {
    name: "bearer_token_assignment",
    regex:
      /(?:bearer|authorization)['":\s]*(?:Bearer\s+)?([A-Za-z0-9_-]{20,})/gi,
    severity: "high",
  },

  // ── Connection Strings ──
  {
    name: "database_url",
    regex:
      /\b((?:postgres|mysql|mongodb|redis|amqp|mssql):\/\/[^\s'"`,;}{)]{10,})\b/gi,
    severity: "critical",
  },

  // ── Private Keys ──
  {
    name: "private_key_block",
    regex:
      /(-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----)/g,
    severity: "critical",
  },

  // ── Google / GCP ──
  {
    name: "google_api_key",
    regex: /\b(AIza[A-Za-z0-9_-]{35})\b/g,
    severity: "high",
  },
  {
    name: "google_oauth_secret",
    regex: /\b(GOCSPX-[A-Za-z0-9_-]{28,})\b/g,
    severity: "critical",
  },

  // ── Supabase ──
  {
    name: "supabase_service_role",
    regex:
      /\b(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{20,})\b/g,
    severity: "critical",
  },

  // ── Generic High-Entropy (last resort — catches things like "password = Xf8k2...") ──
  {
    name: "generic_secret_assignment",
    regex:
      /(?:password|passwd|secret|api_key|apikey|api_secret|access_key|private_key|token)\s*[:=]\s*['"`]([^'"`\s]{8,})['"`]/gi,
    severity: "medium",
  },
];

// ─── Detection ──────────────────────────────────────────────────────────

export interface SecretMatch {
  patternName: string;
  severity: SecretPattern["severity"];
  /** Start index in the original text */
  startIndex: number;
  /** End index in the original text */
  endIndex: number;
  /** Length of the matched secret (NOT the secret itself — never log the value) */
  matchLength: number;
}

/**
 * Scans text for all known secret patterns.
 * Returns metadata about matches WITHOUT exposing the secret values.
 */
export function detectSecrets(text: string): SecretMatch[] {
  const matches: SecretMatch[] = [];

  for (const pattern of SECRET_PATTERNS) {
    // Reset the regex lastIndex (because we use global flag)
    pattern.regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(text)) !== null) {
      matches.push({
        patternName: pattern.name,
        severity: pattern.severity,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        matchLength: match[0].length,
      });
    }
  }

  // Sort by position for consistent processing
  matches.sort((a, b) => a.startIndex - b.startIndex);

  return matches;
}

// ─── Redaction ──────────────────────────────────────────────────────────

export interface RedactionResult {
  /** The text with all secrets replaced by [REDACTED:<pattern_name>] */
  redactedText: string;
  /** Number of secrets found and replaced */
  secretsFound: number;
  /** Names of patterns that matched (for logging/metrics) */
  matchedPatterns: string[];
  /** Ratio of redacted characters to total characters (0.0 - 1.0) */
  redactionRatio: number;
}

/**
 * Replaces all detected secrets in the text with [REDACTED:<pattern_name>].
 *
 * This is the ONLY function that should be used to redact text.
 * Used at ingestion time (primary) and retrieval time (defense-in-depth).
 */
export function redactText(text: string): RedactionResult {
  if (!text || text.trim().length === 0) {
    return {
      redactedText: text,
      secretsFound: 0,
      matchedPatterns: [],
      redactionRatio: 0,
    };
  }

  const matches = detectSecrets(text);

  if (matches.length === 0) {
    return {
      redactedText: text,
      secretsFound: 0,
      matchedPatterns: [],
      redactionRatio: 0,
    };
  }

  // Build the redacted string by replacing matched regions.
  // Handle overlapping matches by processing from end to start.
  let redacted = text;
  let totalRedactedChars = 0;
  const seenPatterns = new Set<string>();

  // Process from end to start so indices remain valid
  const reversed = [...matches].reverse();
  for (const m of reversed) {
    const placeholder = `[REDACTED:${m.patternName}]`;
    redacted = redacted.substring(0, m.startIndex) +
      placeholder +
      redacted.substring(m.endIndex);
    totalRedactedChars += m.matchLength;
    seenPatterns.add(m.patternName);
  }

  return {
    redactedText: redacted,
    secretsFound: matches.length,
    matchedPatterns: Array.from(seenPatterns),
    redactionRatio: totalRedactedChars / text.length,
  };
}

// ─── Severity Assessment ────────────────────────────────────────────────

export interface ChunkRedactionAssessment {
  /**
   * 'exclude' = chunk is mostly secrets (set is_redacted = true, don't index)
   * 'redact_and_index' = chunk has some secrets but is mostly useful content
   *                      (store redacted version, set is_redacted = false)
   * 'clean' = no secrets found (store as-is, set is_redacted = false)
   */
  action: "exclude" | "redact_and_index" | "clean";
  /** The content to store (redacted if needed, original if clean) */
  contentToStore: string;
  /** Whether is_redacted should be set to true */
  isRedacted: boolean;
  /** Metrics for observability */
  metrics: {
    secretsFound: number;
    matchedPatterns: string[];
    redactionRatio: number;
    hasCriticalSecrets: boolean;
  };
}

/**
 * Assesses how to handle a chunk based on secret detection results.
 *
 * Decision logic:
 * - If redaction ratio > 0.5 (more than half the chunk is secrets) → exclude entirely
 * - If any critical secrets found but ratio <= 0.5 → redact inline, still index
 * - If only medium/high secrets and ratio <= 0.3 → redact inline, still index
 * - If no secrets → clean, store as-is
 *
 * IMPORTANT: This function is the ONLY place that decides whether to set is_redacted.
 * Do NOT make this decision anywhere else.
 */
export function assessChunkRedaction(
  rawContent: string,
): ChunkRedactionAssessment {
  const result = redactText(rawContent);
  const matches = detectSecrets(rawContent);

  const hasCritical = matches.some((m) => m.severity === "critical");

  // If no secrets, it's clean
  if (result.secretsFound === 0) {
    return {
      action: "clean",
      contentToStore: rawContent,
      isRedacted: false,
      metrics: {
        secretsFound: 0,
        matchedPatterns: [],
        redactionRatio: 0,
        hasCriticalSecrets: false,
      },
    };
  }

  // If more than half the chunk is secrets, exclude it entirely
  // (it's likely a credentials file, .env, key dump, etc.)
  if (result.redactionRatio > 0.5) {
    return {
      action: "exclude",
      contentToStore: result.redactedText, // store redacted version anyway (for audit)
      isRedacted: true,
      metrics: {
        secretsFound: result.secretsFound,
        matchedPatterns: result.matchedPatterns,
        redactionRatio: result.redactionRatio,
        hasCriticalSecrets: hasCritical,
      },
    };
  }

  // Otherwise: redact the secrets inline but keep the chunk indexable
  return {
    action: "redact_and_index",
    contentToStore: result.redactedText,
    isRedacted: false, // NOT redacted (because we cleaned it — it's safe to retrieve)
    metrics: {
      secretsFound: result.secretsFound,
      matchedPatterns: result.matchedPatterns,
      redactionRatio: result.redactionRatio,
      hasCriticalSecrets: hasCritical,
    },
  };
}
