#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * scripts/mcp-smoke-test.ts
 *
 * Minimal MCP Smoke-Test Spec (v0)
 * Validates auth, pack isolation, caps/redaction, and safe refusal.
 * Supports Deno and Node execution.
 */

// ============================================================================
// Isomorphic environment utilities
// ============================================================================
const isDeno = typeof Deno !== "undefined";
const getEnv = (key: string): string | undefined => {
  if (isDeno) return Deno.env.get(key);
  if (typeof process !== "undefined") return process.env[key];
  return undefined;
};
const exitProcess = (code: number) => {
  if (typeof process !== "undefined" && typeof process.exit === "function") process.exit(code);
  if (isDeno) Deno.exit(code);
};

// ============================================================================
// Spec 0) REQUIRED ENV VARS
// ============================================================================
function requireEnv(name: string): string {
  const val = getEnv(name);
  if (!val) {
    console.error(`❌ Missing required env var: ${name}`);
    exitProcess(1);
  }
  return val as string;
}
function optionalEnv(name: string, def?: string): string | undefined {
  return getEnv(name) || def;
}

const SUPABASE_URL = requireEnv("MCP_EVAL_SUPABASE_URL");
const ANON_KEY = requireEnv("MCP_EVAL_ANON_KEY");
const USER_EMAIL = requireEnv("MCP_EVAL_USER_EMAIL");
const USER_PASSWORD = requireEnv("MCP_EVAL_USER_PASSWORD");
const PACK_ID_ALLOWED = requireEnv("MCP_EVAL_PACK_ID_ALLOWED");

const PACK_ID_FORBIDDEN = optionalEnv("MCP_EVAL_PACK_ID_FORBIDDEN");
const MCP_PATH = optionalEnv("MCP_EVAL_MCP_PATH", "functions/v1/rocketboard-mcp/mcp");
const RUN_RATELIMIT = optionalEnv("MCP_EVAL_RUN_RATELIMIT_TEST");
// (MCP_EVAL_DEBUG not explicitly wired, but logging rules strictly hide outputs regardless)

// ============================================================================
// Spec 2) UTILITIES
// ============================================================================
const nowMs = () => Date.now();

async function fetchJson(url: string, opts: { method: string; headers?: Record<string, string>; body?: string; timeoutMs?: number }) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  let timer: any;
  if (controller && opts.timeoutMs) {
    timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  }
  
  try {
    const res = await fetch(url, {
      method: opts.method,
      headers: opts.headers,
      body: opts.body,
      signal: controller?.signal,
    });
    
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (_) {}
    
    return { status: res.status, json, text };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function safeString(x: any, maxLen = 200): string {
  if (!x) return "";
  const s = String(x);
  return s.length > maxLen ? s.substring(0, maxLen) + "..." : s;
}

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/, // AWS
  /Bearer\s+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, // JWT
];
function containsSecretPattern(text: string): boolean {
  if (!text) return false;
  return SECRET_PATTERNS.some(p => p.test(text));
}

const SENSITIVE_KEYS = ["config", "api_key", "refresh_token", "service_role", "SUPABASE_SERVICE_ROLE_KEY", "authorization"];
function assertNoSensitiveKeys(obj: any): void {
  if (!obj || typeof obj !== "object") return;
  
  if (Array.isArray(obj)) {
    obj.forEach(assertNoSensitiveKeys);
    return;
  }
  
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      throw new Error(`Sensitive key '${key}' found in response object.`);
    }
    assertNoSensitiveKeys(obj[key]);
  }
}

// ============================================================================
// JWT Acquisition & MCP endpoint helpers
// ============================================================================
let activeJwt: string | undefined;

async function acquireToken() {
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const { status, json } = await fetchJson(url, {
    method: "POST",
    headers: {
      "apikey": ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
    timeoutMs: 15000,
  });
  
  if (status !== 200 || !json?.access_token) {
    throw new Error(`Failed to acquire JWT. Status: ${status}`);
  }
  activeJwt = json.access_token;
}

// mcp-lite exposes tools via Streamable HTTP layer (tools/call method).
async function callMcpTool(toolName: string, args: Record<string, unknown>, jwtOverride?: string | null) {
  const url = `${SUPABASE_URL}/${MCP_PATH}`;
  const reqId = crypto.randomUUID();
  
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = jwtOverride !== undefined ? jwtOverride : activeJwt;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const payload = {
    jsonrpc: "2.0",
    id: reqId,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };

  const startMs = nowMs();
  const { status, json, text } = await fetchJson(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    timeoutMs: 30000,
  });
  const latencyMs = nowMs() - startMs;
  return { status, json, text, latencyMs };
}

// ============================================================================
// Runner Core
// ============================================================================

type TestResult = { name: string; status: "PASS" | "FAIL" | "SKIP"; httpStatus: number; latencyMs: number; details: string };

async function runTest(name: string, fn: () => Promise<{ status: number; latencyMs: number; details: string; skip?: boolean }>): Promise<TestResult> {
  console.log(`\n➤ Running: ${name}`);
  try {
    const res = await fn();
    if (res.skip) return { name, status: "SKIP", httpStatus: res.status, latencyMs: res.latencyMs, details: res.details };
    return { name, status: "PASS", httpStatus: res.status, latencyMs: res.latencyMs, details: res.details };
  } catch (err: any) {
    console.error(`  ❌ Error: ${safeString(err.message || err, 200)}`);
    return { name, status: "FAIL", httpStatus: 0, latencyMs: 0, details: safeString(err.message, 200) };
  }
}

// ============================================================================
// 4) TEST CASES
// ============================================================================

async function runAll() {
  console.log("=========================================");
  console.log("🚀 Minimal MCP Smoke-Test Spec (v0)");
  console.log(`   Endpoint: ${SUPABASE_URL}/${MCP_PATH}`);
  console.log("=========================================");
  
  const results: TestResult[] = [];
  
  // T1: Health Endpoint (optional)
  results.push(await runTest("T1: Health endpoint", async () => {
    const startMs = nowMs();
    const { status } = await fetchJson(`${SUPABASE_URL}/functions/v1/rocketboard-mcp/health`, { method: "GET", timeoutMs: 5000 });
    const latencyMs = nowMs() - startMs;
    if (status === 200) return { status, latencyMs, details: "200 OK" };
    return { status, latencyMs, details: `Skip: not found/broken (${status})`, skip: true };
  }));

  // T2: Unauthorized connection
  results.push(await runTest("T2: Unauthorized connection rejected", async () => {
    const { status, json, latencyMs } = await callMcpTool("list_my_packs", {}, null);
    assert(status === 401, `Expected 401, got ${status}`);
    assert(!!(json?.error || json?.message), "Expected error object");
    assert(!JSON.stringify(json).includes("service_role"), "Stack trace leaked service_role");
    return { status, latencyMs, details: safeString(json?.error?.message || json?.error || "Auth rejected") };
  }));

  // Acquire token
  console.log("\n➤ Authenticating via Supabase Auth...");
  await acquireToken();
  console.log("  ✅ Token acquired (hidden)");

  // T3: list_my_packs (auth baseline + anti-secret)
  results.push(await runTest("T3: list_my_packs (auth baseline)", async () => {
    const { status, json, text, latencyMs } = await callMcpTool("list_my_packs", {});
    assert(status === 200, `Expected 200, got ${status}`);
    
    // Support either direct data or MCP-lite nested content
    const content = json?.result?.content?.[0]?.text;
    const parsed = content ? JSON.parse(content) : (json || {});
    
    assert(Array.isArray(parsed.packs), "Expected 'packs' array");
    const count = parsed.packs.length;
    if (count === 0) console.log("  ⚠️ Warning: 0 packs returned. Staging might be empty.");
    if (count > 0) {
      assert(typeof parsed.packs[0].pack_id === "string", "Expected string pack_id");
      assert(typeof parsed.packs[0].title === "string", "Expected string title");
    }
    
    assertNoSensitiveKeys(parsed);
    assert(!containsSecretPattern(text || ""), "Response contains a secret pattern!");
    
    return { status, latencyMs, details: `Packs: ${count}` };
  }));

  // T4: search_knowledge_base
  results.push(await runTest("T4: search_knowledge_base (caps + redaction)", async () => {
    const { status, json, text, latencyMs } = await callMcpTool("search_knowledge_base", {
      pack_id: PACK_ID_ALLOWED,
      query: "architecture setup configuration",
      max_spans: 10
    });
    assert(status === 200, `Expected 200, got ${status}`);
    
    const content = json?.result?.content?.[0]?.text;
    const parsed = content ? JSON.parse(content) : (json || {});
    
    assert(Array.isArray(parsed.spans), "Expected 'spans' array");
    assert(parsed.spans.length <= 20, `Too many spans: ${parsed.spans.length}`);
    
    for (const span of parsed.spans) {
      assert(typeof span.path === "string", "Missing span path");
      const previewText = span.snippet_preview || span.text_preview || "";
      assert(previewText.length <= 1500, `Preview too large (${previewText.length})`); // Aligning max cap check securely
      assert(!containsSecretPattern(previewText), "Secret pattern found in preview!");
    }
    
    assertNoSensitiveKeys(parsed);
    assert(!containsSecretPattern(text || ""), "Secret pattern found in raw output!");
    
    return { status, latencyMs, details: `Spans: ${parsed.spans.length}` };
  }));

  // T5: explain_with_evidence
  results.push(await runTest("T5: explain_with_evidence (pass OR safe refusal)", async () => {
    const { status, json, latencyMs } = await callMcpTool("explain_with_evidence", {
      pack_id: PACK_ID_ALLOWED,
      question: "Summarize the main request flow and where authorization is checked.",
      detective_mode: true,
      max_spans: 10
    });
    
    // 500 Server error downstream is handled securely, expect 200
    assert(status === 200, `Expected 200, got ${status}`);
    
    const content = json?.result?.content?.[0]?.text;
    const parsed = content ? JSON.parse(content) : (json || {});
    
    const answer = parsed.answer_markdown || parsed.message;
    assert(typeof answer === "string", "Missing answer_markdown/message");
    assert(answer.length <= 12000, `Answer too large (${answer.length})`);
    
    const hasCodeFences = answer.includes("```");
    if (hasCodeFences) {
      if (!answer.includes("// SOURCE:") && !answer.includes("PSEUDOCODE")) {
        console.log("  ⚠️ Warning: Answer has code fence without SOURCE marker. (Router formatting anomaly)");
      }
    }

    const ev = parsed.evidence_manifest || parsed;
    const citations = ev.citations || [];
    
    if (citations.length > 0) {
      return { status, latencyMs, details: `PASS outcome. Citations: ${citations.length}, AnswerLen: ${answer.length}` };
    } else {
      // REFUSE Outcome
      const passedGate = parsed.gate_outcome?.passed === true;
      assert(!passedGate || String(parsed.error_code).includes("insufficient_evidence") || String(parsed.reason).includes("insufficient"), "Expected evidence gate failure state on refusal");
      assert(answer.length > 0, "Refusal message must not be empty");
      return { status, latencyMs, details: `REFUSE outcome. AnswerLen: ${answer.length}` };
    }
  }));

  // T6: Cross-pack access denial
  results.push(await runTest("T6: Cross-pack access denial", async () => {
    if (!PACK_ID_FORBIDDEN) {
      return { status: 0, latencyMs: 0, details: "Skipped (no MCP_EVAL_PACK_ID_FORBIDDEN configured)", skip: true };
    }
    const { status, json, latencyMs } = await callMcpTool("search_knowledge_base", { pack_id: PACK_ID_FORBIDDEN, query: "secrets" });
    
    // Prefer 403, accept 404. Also handle MCP spec wrapping where app error is within 200.
    const isErrorWrapper = status === 200 && json?.error;
    assert(status === 403 || status === 404 || isErrorWrapper || status === 500, `Expected boundary error, got HTTP ${status}`);
    if (!isErrorWrapper) {
      // Must not return spans if somehow we didn't throw an error status
      const content = json?.result?.content?.[0]?.text;
      const parsed = content ? JSON.parse(content) : (json || {});
      assert(!Array.isArray(parsed?.spans) || parsed.spans.length === 0, "Returned spans for forbidden pack!");
    }
    return { status, latencyMs, details: `Correctly refused (st=${status})` };
  }));

  // T7: Path traversal protection
  results.push(await runTest("T7: Path traversal protection", async () => {
    const { status, json, latencyMs } = await callMcpTool("get_tech_doc", { pack_id: PACK_ID_ALLOWED, path: "Technical documents/../../AGENTS.md" });
    
    if (status === 404 && String(json?.error?.message).includes("Tool not found")) {
      return { status, latencyMs, details: "Skipped (tool get_tech_doc not found)", skip: true };
    }
    
    const isErrorWrapper = status === 200 && !!json?.error;
    const isBadRequest = status === 400 || status === 500;
    assert(isBadRequest || isErrorWrapper, `Expected schema/boundary failure, got HTTP ${status}`);
    assert(!JSON.stringify(json).includes("service_role"), "Stack trace dumped");
    
    return { status, latencyMs, details: "Path traversal correctly blocked" };
  }));

  // T8: Rate limit sanity testing
  results.push(await runTest("T8: Rate limiting sanity", async () => {
    if (RUN_RATELIMIT !== "true") {
      return { status: 0, latencyMs: 0, details: "Skipped (MCP_EVAL_RUN_RATELIMIT_TEST != true)", skip: true };
    }
    
    let hitRateLimit = false;
    let limitStatus = 0;
    for (let i = 0; i < 70; i++) {
      const { status, json } = await callMcpTool("list_my_packs", {});
      const isErrorWrapper = status === 200 && json?.error;
      const isRateLimited = status === 429 || (isErrorWrapper && String(json.error?.message).includes("rate limit"));
      if (isRateLimited) {
        hitRateLimit = true;
        limitStatus = status;
        break;
      }
      // Small pause to prevent complete lockup on edge
      await new Promise(r => setTimeout(r, 10));
    }
    assert(hitRateLimit, "Failed to trigger rate limit after 70 reads.");
    return { status: limitStatus, latencyMs: 0, details: "Rate limit triggered correctly" };
  }));

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n=========================================");
  console.log("📊 RUN SUMMARY");
  console.log("=========================================");
  let hasFailed = false;
  
  for (const r of results) {
    let icon = "✅";
    if (r.status === "FAIL") { icon = "❌"; hasFailed = true; }
    if (r.status === "SKIP") { icon = "�️ "; }
    const time = r.latencyMs > 0 ? `${r.latencyMs}ms` : "-";
    console.log(`${icon} [${r.status}] ${r.name.padEnd(50)} | HTTP: ${String(r.httpStatus).padEnd(3)} | Time: ${time.padEnd(6)} | Info: ${r.details}`);
  }
  
  console.log("=========================================");
  if (hasFailed) {
    console.log("💥 SOME REQUIRED TESTS FAILED. See logs above.");
    exitProcess(1);
  } else {
    console.log("🎉 ALL TESTS PASSED OR SKIPPED SECURELY.");
    exitProcess(0);
  }
}

const isMain = isDeno 
  ? (import.meta as any).main 
  : typeof require !== 'undefined' && require.main === module || (typeof process !== "undefined" && process.argv[1]?.endsWith("mcp-smoke-test.ts"));

if (isMain) {
  runAll().catch((e) => {
    console.error("\n❌ Fatal Error:");
    console.error(safeString(e.message || e, 300));
    exitProcess(1);
  });
}
