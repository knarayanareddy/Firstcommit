import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

/**
 * scripts/smoke_staleness_pipeline.ts
 * 
 * E2E Smoke test for the staleness remediation subsystem.
 * Run this after 'supabase db reset' to ensure the pipeline is functional.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INTERNAL_SECRET = process.env.ROCKETBOARD_INTERNAL_SECRET || 'test-internal-secret';

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function runSmokeTest() {
  console.log('🚀 Starting Staleness Pipeline Smoke Test...');

  try {
    // 1. Setup Test Data
    const orgId = '00000000-0000-0000-0000-000000000001';
    const packId = '00000000-0000-0000-0000-000000000001';
    const userId = '00000000-0000-0000-0000-000000000001';
    const chunkId = 'chunk_smoke_001';
    const moduleKey = 'smoke_module_v1';

    console.log('   - Seeding test pack and user...');
    await supabase.from('organizations').upsert({ id: orgId, name: 'Smoke Test Org' });
    await supabase.from('packs').upsert({ id: packId, org_id: orgId, title: 'Smoke Test Pack' });
    await supabase.from('pack_members').upsert({ pack_id: packId, user_id: userId, access_level: 'author' });

    console.log('   - Seeding knowledge chunk...');
    await supabase.from('knowledge_chunks').upsert({
      pack_id: packId,
      org_id: orgId,
      chunk_id: chunkId,
      path: 'smoke_test.md',
      content: 'Original content',
      content_hash: 'hash_v1', // Initial hash
      start_line: 1,
      end_line: 10
    });

    // 2. Call record-content-freshness (Ledger Writing)
    console.log('   - Calling record-content-freshness...');
    const freshnessReq = await fetch(`${SUPABASE_URL}/functions/v1/record-content-freshness`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'X-Rocketboard-Internal': INTERNAL_SECRET
      },
      body: JSON.stringify({
        pack_id: packId,
        module_key: moduleKey,
        module_revision: 1,
        module_data: {
          sections: [
            {
              section_id: 'intro',
              citations: [{ chunk_id: chunkId }]
            }
          ]
        }
      })
    });

    if (!freshnessReq.ok) {
      const errorText = await freshnessReq.text();
      throw new Error(`record-content-freshness failed: ${freshnessReq.status} ${errorText}`);
    }

    const freshnessResult = await freshnessReq.json();
    console.log('   - Freshness ledger recorded:', freshnessResult);

    // Verify record exists in DB
    const { data: ledger, error: ledgerErr } = await supabase
      .from('content_freshness')
      .select('*')
      .eq('module_key', moduleKey)
      .single();
    
    if (ledgerErr || !ledger) throw new Error('Ledger record not found in DB');
    if (ledger.is_stale !== false) throw new Error('New record should not be stale');

    // 3. Mutate Chunk (Simulate change)
    console.log('   - Mutating chunk hash...');
    await supabase.from('knowledge_chunks')
      .update({ content_hash: 'hash_v2' })
      .eq('chunk_id', chunkId);

    // 4. Call check-staleness (Detection)
    console.log('   - Calling check-staleness...');
    const checkReq = await fetch(`${SUPABASE_URL}/functions/v1/check-staleness`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'X-Rocketboard-Internal': INTERNAL_SECRET
      },
      body: JSON.stringify({ pack_id: packId })
    });

    if (!checkReq.ok) {
      const errorText = await checkReq.text();
      throw new Error(`check-staleness failed: ${checkReq.status} ${errorText}`);
    }

    const checkResult = await checkReq.json();
    console.log('   - Check staleness result:', checkResult);

    // 5. Final Assertion
    console.log('   - Verifying staleness trigger...');
    const { data: finalLedger, error: finalErr } = await supabase
      .from('content_freshness')
      .select('is_stale')
      .eq('module_key', moduleKey)
      .single();

    if (finalErr || !finalLedger) throw new Error('Final ledger record not found');
    
    if (finalLedger.is_stale === true) {
      console.log('✅ SUCCESS: Staleness accurately detected and recorded.');
    } else {
      throw new Error('FAILED: Record is still marked as fresh after mutation.');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Smoke Test Failed:', err);
    process.exit(1);
  }
}

runSmokeTest();
