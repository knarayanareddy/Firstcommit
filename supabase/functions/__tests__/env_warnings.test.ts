import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { _resetWarnings, warnIfMissingEnv } from "../_shared/env-warnings.ts";

Deno.test("warnIfMissingEnv — warns once per key+context, never prints value", () => {
  _resetWarnings();

  // Capture console.warn calls
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };

  try {
    // Set a test env var to verify "present" returns true
    Deno.env.set("__TEST_SECRET_EXISTS__", "supersecret");
    const result = warnIfMissingEnv("__TEST_SECRET_EXISTS__", "test-context");
    assertEquals(result, true, "should return true when env var is set");
    assertEquals(warnings.length, 0, "should not warn when env var is set");

    // Verify the value is NOT in any output
    for (const w of warnings) {
      assertEquals(
        w.includes("supersecret"),
        false,
        "must NEVER print secret values",
      );
    }

    // Clean up the test var
    Deno.env.delete("__TEST_SECRET_EXISTS__");

    // Now test missing var — should warn
    const result2 = warnIfMissingEnv("__MISSING_VAR__", "test-missing");
    assertEquals(result2, false, "should return false when env var is missing");
    assertEquals(warnings.length, 1, "should warn once for missing var");

    // Verify the warning is structured JSON with the key name
    const parsed = JSON.parse(warnings[0]);
    assertEquals(parsed.level, "WARN");
    assertEquals(parsed.env_var, "__MISSING_VAR__");
    assertEquals(parsed.context, "test-missing");
    assertEquals(parsed.msg, "missing_env_var");

    // Call again with SAME key+context — should NOT warn again (dedup)
    const result3 = warnIfMissingEnv("__MISSING_VAR__", "test-missing");
    assertEquals(result3, false, "still returns false");
    assertEquals(
      warnings.length,
      1,
      "should NOT warn twice for same key+context",
    );

    // Call with same key but DIFFERENT context — should warn again
    const result4 = warnIfMissingEnv("__MISSING_VAR__", "different-context");
    assertEquals(result4, false, "still returns false");
    assertEquals(
      warnings.length,
      2,
      "should warn for same key with different context",
    );
  } finally {
    console.warn = originalWarn;
    _resetWarnings();
    // Clean up env in case test failed mid-way
    try {
      Deno.env.delete("__TEST_SECRET_EXISTS__");
    } catch { /* ignore */ }
  }
});
