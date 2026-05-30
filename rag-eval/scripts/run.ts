import { createClient } from '@supabase/supabase-js';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { crypto } from 'node:crypto';

const DEBUG = process.env.RAG_EVAL_DEBUG === 'true';

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.RAG_EVAL_SUPABASE_URL;
const ANON_KEY = process.env.RAG_EVAL_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.RAG_EVAL_SUPABASE_SERVICE_ROLE_KEY;
const USER_EMAIL = process.env.RAG_EVAL_USER_EMAIL;
const USER_PASSWORD = process.env.RAG_EVAL_USER_PASSWORD;
const PACK_ID = process.env.RAG_EVAL_PACK_ID;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY || !USER_EMAIL || !USER_PASSWORD || !PACK_ID) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

const RETRIEVE_SPANS_URL = `${SUPABASE_URL}/functions/v1/retrieve-spans`;
const AI_TASK_ROUTER_URL = `${SUPABASE_URL}/functions/v1/ai-task-router`;

// --- TYPES ---
interface Thresholds {
  min_citations?: number;
  max_strip_rate?: number;
  max_attempts?: number;
  min_unique_files?: number;
  max_latency_ms?: number;
  expanded_chunks_added_min?: number;
}

interface TestCase {
  id: string;
  name: string;
  query: string;
  task_type?: string;
  max_spans?: number;
  detective_mode?: boolean;
  must_pass_gate?: boolean;
  thresholds?: Thresholds;
}

interface Suite {
  version: number;
  defaults: {
    task_type: string;
    max_spans: number;
    detective_mode: boolean;
    must_pass_gate: boolean;
    thresholds: Thresholds;
  };
  tests: TestCase[];
}

// --- UTILS ---
function mergeThresholds(defaults: Thresholds, overrides: Thresholds = {}): Thresholds {
  return { ...defaults, ...overrides };
}

async function runTest(test: TestCase, suiteDefaults: Suite['defaults'], jwt: string, serviceClient: any) {
  const settings = {
    ...suiteDefaults,
    ...test,
    thresholds: mergeThresholds(suiteDefaults.thresholds, test.thresholds)
  };

  const requestId = crypto.randomUUID();
  console.log(`[RUN ] ${test.id}: "${test.name}" (Request ID: ${requestId})`);

  const startTime = Date.now();

  try {
    // 1. Retrieve Spans
    const spansResp = await fetch(RETRIEVE_SPANS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pack_id: PACK_ID,
        query: test.query,
        max_spans: settings.max_spans
      })
    });

    if (!spansResp.ok) throw new Error(`Retrieve spans failed: ${spansResp.status}`);
    const { spans = [] } = await spansResp.json();

    // 2. Call AI Task Router
    const routerStartTime = Date.now();
    const routerResp = await fetch(AI_TASK_ROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        task: { 
            type: settings.task_type, 
            request_id: requestId, 
            timestamp_iso: new Date().toISOString() 
        },
        pack: { pack_id: PACK_ID },
        context: { 
            conversation: { 
                messages: [{ role: "user", content: test.query }] 
            } 
        },
        retrieval: { 
            query: test.query, 
            detective_mode: settings.detective_mode, 
            evidence_spans: spans 
        },
        limits: { max_chat_words: 350 }
      })
    });

    const latency_ms = Date.now() - routerStartTime;
    const routerData = await routerResp.json();

    // 3. Poll rag_metrics
    let metrics: any = null;
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const { data, error } = await serviceClient
            .from('rag_metrics')
            .select('*')
            .eq('request_id', requestId)
            .maybeSingle();
        
        if (data) {
            metrics = data;
            break;
        }
    }

    if (!metrics) {
        throw new Error("Metrics not found in rag_metrics after polling.");
    }

    // 4. Assertions
    const errors: string[] = [];
    
    // Core Decision
    const gate_passed = metrics.grounding_gate_passed;
    const gate_reason = metrics.grounding_gate_reason;
    
    if (settings.must_pass_gate) {
        if (!gate_passed) {
            errors.push(`Gate FAILED (Reason: ${gate_reason})`);
        }
    } else {
        // For intentionally unknown, we expect a refusal or insufficient evidence
        if (gate_passed) {
            errors.push("Expected gate REFUSAL but it passed.");
        }
    }

    // Metrics Assertions
    const citations_found = metrics.citations_found ?? (routerData.source_map?.length || 0);
    const unique_files = metrics.unique_files_count ?? 0;
    const strip_rate = metrics.strip_rate ?? 0;
    const attempts = metrics.attempts ?? 1;

    if (settings.must_pass_gate) {
        if (settings.thresholds.min_citations && citations_found < settings.thresholds.min_citations) {
            errors.push(`Citations found (${citations_found}) < min (${settings.thresholds.min_citations})`);
        }
        if (settings.thresholds.max_strip_rate && strip_rate > settings.thresholds.max_strip_rate) {
            errors.push(`Strip rate (${strip_rate.toFixed(2)}) > max (${settings.thresholds.max_strip_rate})`);
        }
        if (settings.thresholds.min_unique_files && unique_files < settings.thresholds.min_unique_files) {
            errors.push(`Unique files (${unique_files}) < min (${settings.thresholds.min_unique_files})`);
        }
    }

    if (settings.thresholds.max_attempts && attempts > settings.thresholds.max_attempts) {
        errors.push(`Attempts (${attempts}) > max (${settings.thresholds.max_attempts})`);
    }

    if (settings.thresholds.max_latency_ms && latency_ms > settings.thresholds.max_latency_ms) {
        errors.push(`Latency (${latency_ms}ms) > max (${settings.thresholds.max_latency_ms}ms)`);
    }

    // Detective Loop Assertions
    if (settings.detective_mode && settings.thresholds.expanded_chunks_added_min) {
        const expanded = metrics.expanded_chunks_added ?? 0;
        if (expanded < settings.thresholds.expanded_chunks_added_min) {
            errors.push(`Detective yield (${expanded}) < min (${settings.thresholds.expanded_chunks_added_min})`);
        }
    }

    const passed = errors.length === 0;

    if (DEBUG) {
        console.log(`[DEBUG] Metrics:`, {
            gate_passed,
            gate_reason,
            citations_found,
            unique_files,
            strip_rate,
            attempts,
            latency_ms,
            detective: settings.detective_mode ? {
                hops: metrics.retrieval_hops,
                expanded: metrics.expanded_chunks_added
            } : 'off'
        });
    }

    console.log(`${passed ? '✅ PASS' : '❌ FAIL'} | ID: ${test.id} | Att: ${attempts} | Gate: ${gate_passed} (${gate_reason}) | Strip: ${strip_rate.toFixed(2)} | Cit: ${citations_found} | Files: ${unique_files} | Lat: ${latency_ms}ms`);
    
    if (!passed) {
        errors.forEach(e => console.log(`   - ${e}`));
    }

    return passed;

  } catch (err: any) {
    console.log(`❌ ERROR | ID: ${test.id} | ${err.message}`);
    return false;
  }
}

// --- MAIN ---
async function main() {
  const args = process.argv.slice(2);
  const suitePath = args[args.indexOf('--suite') + 1] || 'suites/baseline.yaml';

  if (!fs.existsSync(suitePath)) {
    console.error(`Suite file not found: ${suitePath}`);
    process.exit(1);
  }

  const suite = yaml.load(fs.readFileSync(suitePath, 'utf8')) as Suite;
  console.log(`Loaded suite: ${suitePath} (Version ${suite.version})`);
  console.log(`Project: ${SUPABASE_URL} | Pack: ${PACK_ID}`);

  // 1. Auth as Runner User
  const anonClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
    email: USER_EMAIL,
    password: USER_PASSWORD
  });

  if (authError || !authData.session) {
    console.error("Authentication failed:", authError?.message || "No session");
    process.exit(1);
  }

  const jwt = authData.session.access_token;
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  console.log("Authenticated successfully.");
  console.log("--------------------------------------------------------------------------------");

  let allPassed = true;
  for (const test of suite.tests) {
    const success = await runTest(test, suite.defaults, jwt, serviceClient);
    if (!success) allPassed = false;
  }

  console.log("--------------------------------------------------------------------------------");
  if (allPassed) {
    console.log("ALL TESTS PASSED ✨");
    process.exit(0);
  } else {
    console.log("SOME TESTS FAILED ❌");
    process.exit(1);
  }
}

main();
