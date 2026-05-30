#!/bin/bash
set -e

# Staleness Pipeline Smoke Test (CI)
# 
# Verifies the end-to-end staleness remediation subsystem:
# 1. Reset Database
# 2. Seed minimal Pack/Chunks
# 3. Create Freshness Ledger
# 4. Simulate Drift (Code Change)
# 5. Verify Staleness Detection
# 6. Verify Permission (Unauthorized rejection)

echo "🚀 Starting Staleness Pipeline Smoke Test..."

# Check requirements
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: supabase CLI not found."
    exit 1
fi

if [ -z "$ROCKETBOARD_INTERNAL_SECRET" ]; then
    echo "⚠️ Warning: ROCKETBOARD_INTERNAL_SECRET not set. Using 'test_secret' fallback."
    export ROCKETBOARD_INTERNAL_SECRET="test_secret"
fi

# 1. Reset local database
echo "🔄 Resetting local Supabase..."
supabase db reset --local

# 2. Seed Data
echo "🌱 Seeding test data..."
TEST_PACK_ID="00000000-0000-0000-0000-000000000001"
TEST_CHUNK_ID="11111111-1111-1111-1111-111111111111"

supabase db execute "
INSERT INTO public.packs (id, title, description, pack_version) 
VALUES ('$TEST_PACK_ID', 'Smoke Test Pack', 'Testing staleness pipeline...', 1) 
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.knowledge_chunks (chunk_id, pack_id, content, content_hash, path) 
VALUES ('$TEST_CHUNK_ID', '$TEST_PACK_ID', 'export const test = 1;', 'hash_v1', 'src/test.ts')
ON CONFLICT (chunk_id) DO NOTHING;
"

# 3. Create Freshness Ledger Entry
echo "📝 Recording initial freshness ledger..."
MOCK_MODULE_DATA='{
  "sections": [{
    "section_id": "sec_1",
    "citations": [{"chunk_id": "'$TEST_CHUNK_ID'"}]
  }]
}'

RECORD_RESP=$(curl -s -X POST "http://localhost:54321/functions/v1/record-content-freshness" \
  -H "X-Rocketboard-Internal: $ROCKETBOARD_INTERNAL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "pack_id": "'$TEST_PACK_ID'",
    "module_key": "smoke-test-module",
    "module_data": '$MOCK_MODULE_DATA'
  }')

TRACKED_COUNT=$(echo $RECORD_RESP | grep -o '"tracked_sections":[0-9]*' | grep -o '[0-9]*')

if [ "$TRACKED_COUNT" != "1" ]; then
    echo "❌ Error: Failed to record freshness ledger. Response: $RECORD_RESP"
    exit 1
fi
echo "✅ Ledger entry created."

# 4. Simulate Drift
echo "⚡ Simulating codebase change (hash mutation)..."
supabase db execute "UPDATE public.knowledge_chunks SET content_hash = 'hash_v2' WHERE chunk_id = '$TEST_CHUNK_ID';"

# 5. Verify Staleness Detection
echo "🔍 Running staleness audit..."
AUDIT_RESP=$(curl -s -X POST "http://localhost:54321/functions/v1/check-staleness" \
  -H "X-Rocketboard-Internal: $ROCKETBOARD_INTERNAL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"pack_id": "'$TEST_PACK_ID'"}')

STALE_COUNT=$(echo $AUDIT_RESP | grep -o '"stale_count":[0-9]*' | grep -o '[0-9]*')

if [ "$STALE_COUNT" -gt "0" ]; then
    echo "✅ Staleness detected successfully! (count: $STALE_COUNT)"
else
    echo "❌ Error: Audit failed to detect staleness. Response: $AUDIT_RESP"
    exit 1
fi

# 6. Verify Permission (Unauthorized rejection)
echo "🛡️ Verifying unauthorized rejection..."
AUTH_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:54321/functions/v1/check-staleness" \
  -H "Content-Type: application/json" \
  -d '{"pack_id": "'$TEST_PACK_ID'"}')

if [ "$AUTH_RESP" == "401" ] || [ "$AUTH_RESP" == "403" ]; then
    echo "✅ Unauthorized access correctly rejected (Status: $AUTH_RESP)."
else
    echo "❌ Error: Unauthorized request was not rejected (Status: $AUTH_RESP)."
    exit 1
fi

echo "🎉 Smoke test PASSED successfully!"
exit 0
