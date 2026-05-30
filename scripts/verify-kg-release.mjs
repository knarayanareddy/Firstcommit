#!/usr/bin/env node
/**
 * scripts/verify-kg-release.mjs
 *
 * Release verification for KG Retrieval v2 on main.
 * Queries rag_metrics for the most recent row and checks acceptance criteria.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/verify-kg-release.mjs
 *
 * Optional: pass --trace-id <uuid> to filter by a specific request_id.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TRACE_ID = process.argv.includes("--trace-id")
  ? process.argv[process.argv.indexOf("--trace-id") + 1]
  : null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌ Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function queryRagMetrics() {
  let query = supabase
    .from("rag_metrics")
    .select(
      "created_at,kg_enabled,kg_added_spans,kg_definition_hits,kg_reference_hits,kg_time_ms,rerank_skipped,rerank_skip_reason,expanded_chunks_added,request_id"
    )
    .order("created_at", { ascending: false })
    .limit(1);

  if (TRACE_ID) {
    query = query.eq("request_id", TRACE_ID);
  }

  const { data, error } = await query;

  if (error) {
    console.error("❌ Failed to query rag_metrics:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.error("❌ No rows found in rag_metrics. Run a query first.");
    process.exit(1);
  }

  return data[0];
}

function redact(row) {
  return { ...row, request_id: row.request_id ? "[REDACTED]" : null };
}

function checkAcceptanceCriteria(row) {
  const checks = [
    {
      name: "kg_enabled = true",
      pass: row.kg_enabled === true,
      value: row.kg_enabled,
    },
    {
      name: "kg_added_spans > 0",
      pass: (row.kg_added_spans ?? 0) > 0,
      value: row.kg_added_spans,
    },
    {
      name: "kg_definition_hits >= 1",
      pass: (row.kg_definition_hits ?? 0) >= 1,
      value: row.kg_definition_hits,
    },
    {
      name: "kg_reference_hits >= 1",
      pass: (row.kg_reference_hits ?? 0) >= 1,
      value: row.kg_reference_hits,
    },
    {
      name: "rerank_skipped = true",
      pass: row.rerank_skipped === true,
      value: row.rerank_skipped,
    },
    {
      name: "rerank_skip_reason = 'graph_confident'",
      pass: row.rerank_skip_reason === "graph_confident",
      value: row.rerank_skip_reason,
    },
  ];

  return checks;
}

async function main() {
  console.log("=".repeat(60));
  console.log("KG Retrieval v2 — Release Verification");
  console.log("=".repeat(60));
  if (TRACE_ID) console.log(`Filtering by trace_id: ${TRACE_ID}`);

  const row = await queryRagMetrics();
  const displayed = redact(row);

  console.log("\n📊 rag_metrics row (latest):");
  console.table(displayed);

  console.log("\n✅ Acceptance Criteria:");
  const checks = checkAcceptanceCriteria(row);
  let allPassed = true;
  for (const c of checks) {
    const icon = c.pass ? "✅" : "❌";
    console.log(`  ${icon} ${c.name} — got: ${JSON.stringify(c.value)}`);
    if (!c.pass) allPassed = false;
  }

  if (!row.rerank_skipped) {
    console.log("\n⚠️  rerank_skipped is false. Possible reasons:");
    if ((row.kg_definition_hits ?? 0) < 1)
      console.log("   - kg_definition_hits < 1 (query didn't find a definition)");
    if ((row.kg_reference_hits ?? 0) < 1)
      console.log("   - kg_reference_hits < 1 (query didn't find a reference)");
    // We don't have span_count here but note the possibility
    console.log("   - OR total evidence spans > 12 (skip policy not met)");
  }

  console.log("\n" + "=".repeat(60));
  if (allPassed) {
    console.log("🚀 RELEASE VERIFICATION PASSED — KG v2 is working on main.");
  } else {
    console.log(
      "❌ RELEASE VERIFICATION FAILED — see above for failing checks."
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
