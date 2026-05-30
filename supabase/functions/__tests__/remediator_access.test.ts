import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Access Control Test: auto-remediate-module Pack Authorization.
 *
 * Verifies that the remediation drafting endpoint correctly distinguishes
 * between system triggers, authorized authors, and unauthorized users.
 */
Deno.test("auto-remediate-module Access Control Security Test", async (t) => {
  const functionUrl =
    "http://localhost:54321/functions/v1/auto-remediate-module";
  const internalSecret = Deno.env.get("ROCKETBOARD_INTERNAL_SECRET") ||
    "test_secret";
  const testPackId = "00000000-0000-0000-0000-000000000001";
  const dummyCompareUrl = "https://github.com/owner/repo/compare/base...head";

  await t.step("positive: proceeds on valid internal secret", async () => {
    const res = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "X-Rocketboard-Internal": internalSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pack_id: testPackId,
        compare_url: dummyCompareUrl,
        changed_files: ["README.md"],
      }),
    });

    // Auth should pass. Logic might fail (no diff), but not with 401/403.
    const isAuthorized = res.status !== 401 && res.status !== 403;
    assertEquals(isAuthorized, true);
    console.log("Verified: Internal secret bypasses user-role check.");
  });

  await t.step(
    "negative: 403 on valid user but NOT an author of the pack",
    async () => {
      const dummyUserJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.s0"; // Mock JWT

      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${dummyUserJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pack_id: testPackId,
          compare_url: dummyCompareUrl,
          changed_files: ["README.md"],
        }),
      });

      // The gate should catch that the user is not in the pack_members table as an author.
      assertEquals(res.status, 403);
      const body = await res.json();
      assertEquals(body.error, "forbidden");
      console.log("Verified: Unauthorized user receives 403 Forbidden.");
    },
  );
});
