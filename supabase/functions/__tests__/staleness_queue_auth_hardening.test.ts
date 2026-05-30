import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Security Test: Staleness Queue Auth Hardening.
 *
 * Verifies that the endpoint rejects unauthorized requests and
 * requires the internal secret header.
 */
Deno.test("Staleness Queue Auth Security Test", async (t) => {
  const functionUrl =
    "http://localhost:54321/functions/v1/process-staleness-queue";
  const internalSecret = Deno.env.get("ROCKETBOARD_INTERNAL_SECRET") ||
    "test-secret";

  await t.step("negative: 401 on missing auth", async () => {
    const res = await fetch(functionUrl, {
      method: "POST",
    });

    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "unauthorized");
    console.log("Verified: Missing auth returns 401.");
  });

  await t.step("negative: 401 on invalid secret", async () => {
    const res = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "X-Rocketboard-Internal": "wrong-secret",
      },
    });

    assertEquals(res.status, 401);
    console.log("Verified: Invalid secret returns 401.");
  });

  await t.step("positive: proceeds with valid internal secret", async () => {
    // Note: We don't necessarily expect a 200 PROCESSED if there's no data,
    // but we expect to bypass the 401 auth gate.
    const res = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "X-Rocketboard-Internal": internalSecret,
      },
    });

    // It should not be 401. It could be 200 (success) or 500 (if DB unavailable in test env).
    const isAuthorized = res.status !== 401;
    assertEquals(isAuthorized, true);
    console.log(`Verified: Valid secret bypassed 401 (Status: ${res.status}).`);
  });
});
