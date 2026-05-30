/**
 * lifecycle-smoke.ts
 * 
 * Simple smoke test for Lifecycle Edge Functions.
 * Requires env vars: SUPABASE_URL, AUTHOR_JWT, CRON_AUTH_TOKEN, PACK_ID, SOURCE_ID
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const AUTHOR_JWT = process.env.AUTHOR_JWT;
const CRON_AUTH_TOKEN = process.env.CRON_AUTH_TOKEN;
const TEST_PACK_ID = process.env.PACK_ID;
const TEST_SOURCE_ID = process.env.SOURCE_ID;

if (!SUPABASE_URL || !AUTHOR_JWT || !CRON_AUTH_TOKEN || !TEST_PACK_ID || !TEST_SOURCE_ID) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

async function runSmokeTests() {
  console.log("🚀 Starting Lifecycle Smoke Tests...");

  // 1. Purge Source (Dry Run)
  console.log("\n[1] Testing Purge Source (Dry Run)...");
  const purgeDryResponse = await fetch(`${SUPABASE_URL}/functions/v1/purge-source`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AUTHOR_JWT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pack_id: TEST_PACK_ID,
      source_id: TEST_SOURCE_ID,
      mode: 'dry_run'
    })
  });
  
  const purgeDryData = await purgeDryResponse.json();
  console.log(`Status: ${purgeDryResponse.status}`);
  console.log(`Knowledge Chunks Found: ${purgeDryData.results?.knowledge_chunks ?? 0}`);
  
  if (!purgeDryResponse.ok) throw new Error("Purge Dry Run failed");

  // 2. Retention Job (Dry Run)
  console.log("\n[2] Testing Retention Job (Dry Run)...");
  const retentionDryResponse = await fetch(`${SUPABASE_URL}/functions/v1/lifecycle-retention-job`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CRON_AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pack_id: TEST_PACK_ID,
      dry_run: true
    })
  });

  const retentionDryData = await retentionDryResponse.json();
  console.log(`Status: ${retentionDryResponse.status}`);
  console.log(`Packs Processed: ${retentionDryData.processed_count ?? 0}`);
  
  if (!retentionDryResponse.ok) throw new Error("Retention Dry Run failed");

  console.log("\n✅ Lifecycle Smoke Tests Completed successfully (Dry Run Mode).");
}

runSmokeTests().catch(err => {
  console.error("\n❌ Smoke test failed:", err.message);
  process.exit(1);
});
