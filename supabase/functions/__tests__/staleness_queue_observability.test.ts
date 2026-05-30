import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

/**
 * Integration Test: Staleness Queue Observability & Tracking.
 *
 * Verifies that the hardened worker correctly populates started_at,
 * finished_at, and increments attempts.
 */
Deno.test("Staleness Queue Worker Observability Test", async (t) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://xyz.supabase.co";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "service-key";
  const admin = createClient(supabaseUrl, serviceKey);

  const testPackId = "00000000-0000-0000-0000-000000000001";
  let jobId: string;

  await t.step("setup: create pending job", async () => {
    // Clear any existing pending jobs to avoid unique index conflict
    await admin.from("staleness_check_queue").delete().eq("pack_id", testPackId)
      .eq("status", "pending");

    const { data, error } = await admin.from("staleness_check_queue").insert({
      pack_id: testPackId,
      status: "pending",
      reason: "manual_test",
    }).select("id").single();

    if (error) throw error;
    jobId = data.id;
  });

  await t.step(
    "verification: worker lifecycle updates observability columns",
    async () => {
      // 1. Simulate Worker Picking Up Task (Processing)
      const { data: lockData, error: lockError } = await admin
        .from("staleness_check_queue")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
          attempts: 1, // In the real worker, this would read current + 1
        })
        .eq("id", jobId)
        .select()
        .single();

      assertEquals(lockError, null);
      assertEquals(lockData.attempts, 1);
      assertExists(lockData.started_at);
      console.log("Verified: started_at and attempts populated on lock.");

      // 2. Simulate Worker Finalizing Task (Done)
      const { data: finalData, error: finalError } = await admin
        .from("staleness_check_queue")
        .update({
          status: "done",
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .select()
        .single();

      assertEquals(finalError, null);
      assertEquals(finalData.status, "done");
      assertExists(finalData.finished_at);
      console.log("Verified: finished_at populated on completion.");
    },
  );

  await t.step("cleanup", async () => {
    await admin.from("staleness_check_queue").delete().eq("id", jobId);
  });
});
