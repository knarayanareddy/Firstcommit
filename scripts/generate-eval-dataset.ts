/**
 * Phase 6: RAG Evaluation Dataset Generator
 * 
 * This script samples historical queries from the `rag_metrics` table 
 * and prepares a dataset for benchmarking the Zero-Hallucination RAG pipeline.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function generateEvalDataset() {
  console.log("🚀 Sampling RAG metrics for evaluation dataset...");

  // 1. Pull metrics with low grounding scores or high attempt counts
  const { data, error } = await supabase
    .from("rag_metrics")
    .select("query, task_type, grounding_score, attempts, request_id, created_at")
    .or("grounding_score.lt.0.7,attempts.gt.1")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching metrics:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.log("✅ No problematic queries found. The RAG system is performing optimally.");
    return;
  }

  console.log(`📊 Found ${data.length} candidate queries for the evaluation dataset.`);

  // 2. Format into a JSONL structure suitable for batch testing
  const dataset = data.map((row) => ({
    input: row.query,
    expected_task: row.task_type,
    metadata: {
      historical_grounding_score: row.grounding_score,
      historical_attempts: row.attempts,
      request_id: row.request_id,
    },
  }));

  // 3. Write to a local file
  const filename = `./rags_eval_dataset_${new Date().toISOString().split('T')[0]}.jsonl`;
  await Deno.writeTextFile(filename, dataset.map(d => JSON.stringify(d)).join('\n'));

  console.log(`✅ Evaluation dataset generated: ${filename}`);
  console.log(`   Use this file with the 'scripts/run-benchmarks.ts' to verify system improvements.`);
}

generateEvalDataset();
