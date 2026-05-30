import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Access Control Test: check-staleness Pack Authorization.
 *
 * Verifies that the endpoint correctly distinguishes between system
 * triggers, authorized authors, and unauthorized users.
 */
Deno.test("check-staleness Access Control Security Test", async (t) => {
  const functionUrl = "http://localhost:54321/functions/v1/check-staleness";
  const internalSecret = Deno.env.get("ROCKETBOARD_INTERNAL_SECRET") ||
    "test-secret";
  const testPackId = "00000000-0000-0000-0000-000000000001";

  await t.step("positive: 200 on valid internal secret", async () => {
    const res = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "X-Rocketboard-Internal": internalSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pack_id: testPackId }),
    });

    // Auth should pass. Result status depends on DB state, but not 401/403.
    const isAuthorized = res.status !== 401 && res.status !== 403;
    assertEquals(isAuthorized, true);
    console.log("Verified: Internal secret bypasses user-role check.");
  });

  await t.step(
    "negative: 403 on valid user but NOT an author of the pack",
    async () => {
      // We simulate a valid user JWT (using anon or a dummy JWT if available)
      // In this test environment, requirePackRole will fail if the user is not in pack_members.
      const dummyUserJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.s0"; // Mock JWT

      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${dummyUserJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pack_id: testPackId }),
      });

      // The gate should catch that the user is not in the pack_members table as an author.
      assertEquals(res.status, 403);
      const body = await res.json();
      assertEquals(body.error, "forbidden");
      console.log("Verified: User not in pack receives 403 Forbidden.");
    },
  );
});
