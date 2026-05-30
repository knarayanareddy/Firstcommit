import { createClient } from '@supabase/supabase-js';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// This script is a wrapper around run.ts that compares KG Enabled vs Disabled
// It assumes run.ts prints a predictable summary line or we parse its output.

const SUITE_PATH = 'suites/kg_v2_eval.yaml';

async function runWithEnv(env: Record<string, string>) {
    console.log(`\n>>> Group: ${env.KG_ENABLED === 'true' ? 'KG ENABLED' : 'KG DISABLED (BASELINE)'}`);
    
    // We can't easily change Edge Function env vars per-request from here 
    // WITHOUT either re-deploying or using a header that the function respects.
    // THE AI_TASK_ROUTER we modified READS from Deno.env.
    
    // HOWEVER, for EVAL purposes, we can modify the "detective_mode" flag in the envelope
    // OR if we added a bypass header. 
    
    // Let's assume for this eval script we use the 'detective_mode' toggle in the suite.
    // If KG_ENABLED=false, we will force detective_mode=false in a temp suite.
    
    const suite = yaml.load(fs.readFileSync(SUITE_PATH, 'utf8')) as any;
    suite.defaults.detective_mode = env.KG_ENABLED === 'true';
    
    const tempPath = `suites/temp_eval_${env.KG_ENABLED}.yaml`;
    fs.writeFileSync(tempPath, yaml.dump(suite));
    
    try {
        const output = execSync(`npx ts-node scripts/run.ts --suite ${tempPath}`, {
            env: { ...process.env, ...env },
            encoding: 'utf8'
        });
        console.log(output);
        return parseOutput(output);
    } finally {
        fs.unlinkSync(tempPath);
    }
}

function parseOutput(output: string) {
    const lines = output.split('\n');
    const results = {
        total: 0,
        passed: 0,
        avg_latency: 0,
        rerank_skipped_count: 0,
        total_latency: 0
    };
    
    for (const line of lines) {
        if (line.includes('✅ PASS') || line.includes('❌ FAIL')) {
            results.total++;
            if (line.includes('✅ PASS')) results.passed++;
            
            const latMatch = line.match(/Lat: (\d+)ms/);
            if (latMatch) {
                const lat = parseInt(latMatch[1]);
                results.total_latency += lat;
            }
            
            if (line.includes('rerank_skipped: true') || line.includes('Rerank Skipped: true')) {
                results.rerank_skipped_count++;
            }
        }
    }
    
    results.avg_latency = results.total > 0 ? results.total_latency / results.total : 0;
    return results;
}

async function main() {
    console.log("Starting KG Retrieval v2 Comparison Study...");
    
    const baseline = await runWithEnv({ KG_ENABLED: 'false' });
    const kgV2 = await runWithEnv({ KG_ENABLED: 'true' });
    
    console.log("\n" + "=".repeat(60));
    console.log("KG RETRIEVAL V2 EVALUATION REPORT");
    console.log("=".repeat(60));
    console.log(`| Metric                | Baseline (Hybrid) | KG v2 (Graph) | % Change |`);
    console.log(`|-----------------------|-------------------|---------------|----------|`);
    
    const latChange = ((kgV2.avg_latency - baseline.avg_latency) / baseline.avg_latency * 100).toFixed(1);
    const passChange = kgV2.passed - baseline.passed;
    
    console.log(`| Avg Latency (ms)      | ${baseline.avg_latency.toFixed(0).padStart(17)} | ${kgV2.avg_latency.toFixed(0).padStart(13)} | ${latChange.padStart(7)}% |`);
    console.log(`| Pass Rate             | ${(baseline.passed + '/' + baseline.total).padStart(17)} | ${(kgV2.passed + '/' + kgV2.total).padStart(13)} | ${passChange.toString().padStart(7)}  |`);
    console.log(`| Rerank Skip Rate      | ${(baseline.rerank_skipped_count + '/' + baseline.total).padStart(17)} | ${(kgV2.rerank_skipped_count + '/' + kgV2.total).padStart(13)} |          |`);
    console.log("=".repeat(60));
    
    if (kgV2.avg_latency < baseline.avg_latency) {
        console.log(`✨ SUCCESS: KG v2 reduced average latency by ${Math.abs(Number(latChange))}%`);
    } else {
        console.log(`⚠️ WARNING: KG v2 latency did not improve in this run.`);
    }
}

main();
