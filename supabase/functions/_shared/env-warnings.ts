/**
 * env-warnings.ts — Rate-limited runtime warnings for missing environment variables.
 *
 * Usage:
 *   import { warnIfMissingEnv } from "../_shared/env-warnings.ts";
 *   warnIfMissingEnv("ROCKETBOARD_INTERNAL_SECRET", "github-webhook internal calls");
 *
 * Guarantees:
 *   - Warns at most ONCE per key per process (deduped via module-level Set)
 *   - NEVER prints secret values — only the key name and context
 */

const _warned = new Set<string>();

/**
 * Emit a structured console.warn if the given environment variable is not set.
 * Each (name, context) pair is warned about at most once per process lifetime.
 *
 * @param name     The environment variable name to check (e.g. "OPENAI_API_KEY")
 * @param context  A short description of why this var matters (e.g. "LLM calls in auto-remediate")
 * @returns        true if the variable IS set, false if missing
 */
export function warnIfMissingEnv(name: string, context: string): boolean {
  const value = Deno.env.get(name);
  if (value) return true;

  const dedupeKey = `${name}::${context}`;
  if (_warned.has(dedupeKey)) return false;

  _warned.add(dedupeKey);
  console.warn(
    JSON.stringify({
      level: "WARN",
      msg: "missing_env_var",
      env_var: name,
      context,
      hint: `Set ${name} in Supabase Dashboard → Edge Function Secrets`,
    }),
  );
  return false;
}

/**
 * Reset the warning set. Only use in tests.
 */
export function _resetWarnings(): void {
  _warned.clear();
}
