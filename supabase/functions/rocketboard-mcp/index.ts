// @ts-nocheck
/**
 * rocketboard-mcp/index.ts
 *
 * RocketBoard MCP Server — Main Entry Point
 *
 * Implements Supabase's "two Hono apps" pattern for Edge Function routing.
 * Exposes 6 tools + 3 resource tools via mcp-lite Streamable HTTP transport.
 *
 * Routes (outer app: /rocketboard-mcp):
 *   GET    /          → server info JSON
 *   GET    /health    → 200 OK
 *   GET    /registry  → tool registry self-check (policy flags)
 *   ALL    /mcp       → mcp-lite StreamableHttpTransport handler
 *
 * Local endpoint: http://localhost:54321/functions/v1/rocketboard-mcp/mcp
 *
 * SECURITY INVARIANTS:
 * - All auth is in auth.ts (JWT-first)
 * - All pack access is in policy.ts (service_role)
 * - All outputs are redacted + capped
 * - All invocations are audited in mcp_audit_events
 * - Rate limits enforced per user (in-memory + DB for report_content_gap)
 * - No connector secrets or Vault credentials are ever returned
 */

import { Hono } from "hono";
import { McpServer } from "@supabase/mcp-utils";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { z } from "zod";

// ── Shared helpers ────────────────────────────────────────────────────────────
import {
  authenticateRequest,
  authErrorResponse,
  McpAuthError,
} from "./auth.ts";
import {
  accessErrorResponse,
  checkPackAccess,
  McpAccessError,
} from "./policy.ts";
import { auditError, hashArgs, writeMcpAudit } from "./audit.ts";

// ── Tool handlers ─────────────────────────────────────────────────────────────
import { listMyPacks, ListMyPacksInputSchema } from "./tools/list_my_packs.ts";
import {
  SearchInputSchema,
  searchKnowledgeBase,
} from "./tools/search_knowledge_base.ts";
import {
  ExplainInputSchema,
  explainWithEvidence,
} from "./tools/explain_with_evidence.ts";
import {
  getPackConventions,
  GetPackConventionsInputSchema,
} from "./tools/get_pack_conventions.ts";
import {
  getTechDoc,
  GetTechDocInputSchema,
  getTechDocsIndex,
  GetTechDocsIndexInputSchema,
} from "./tools/get_tech_docs.ts";
import {
  reportContentGap,
  ReportGapInputSchema,
} from "./tools/report_content_gap.ts";
import {
  listPackSources,
  ListPackSourcesInputSchema,
} from "./tools/list_pack_sources.ts";
import {
  findReferences,
  FindReferencesInputSchema,
} from "./tools/find_references.ts";

// ── Resource schemas (resource tools) ────────────────────────────────────────
import {
  GetResourcePackAgentsInputSchema,
  GetResourceTechDocInputSchema,
  GetResourceTechDocsIndexInputSchema,
} from "./resources/pack_resources.ts";

// ─── Environment + config ─────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RATE_LIMIT_PER_MIN = parseInt(
  Deno.env.get("MCP_RATE_LIMIT_PER_MIN") ?? "60",
  10,
);
const EXPLAIN_RATE_LIMIT_PER_MIN = parseInt(
  Deno.env.get("MCP_EXPLAIN_RATE_LIMIT_PER_MIN") ?? "20",
  10,
);

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Map: userId => { [toolBucket]: { count, resetAt } }

const rateLimitStore = new Map<
  string,
  Record<string, { count: number; resetAt: number }>
>();

/**
 * Checks rate limit for a user+bucket.
 * Returns true if allowed, false if rate-limited.
 */
function checkRateLimit(
  userId: string,
  bucket: string,
  maxPerMin: number,
): boolean {
  const now = Date.now();
  let userMap = rateLimitStore.get(userId);
  if (!userMap) {
    userMap = {};
    rateLimitStore.set(userId, userMap);
  }

  let limit = userMap[bucket];
  if (!limit || now > limit.resetAt) {
    limit = { count: 0, resetAt: now + 60_000 };
    userMap[bucket] = limit;
  }

  limit.count++;
  return limit.count <= maxPerMin;
}

// ─── Supabase admin client (singleton) ───────────────────────────────────────

function getAdminClient() {
  return createServiceClient();
}

// ─── Tool registry (for /registry self-check) ─────────────────────────────────

const TOOL_REGISTRY = [
  {
    name: "list_my_packs",
    policy: "read-only",
    pack_required: false,
    rate_limit: RATE_LIMIT_PER_MIN,
  },
  {
    name: "search_knowledge_base",
    policy: "read-only",
    pack_required: true,
    access_level: "learner",
    rate_limit: RATE_LIMIT_PER_MIN,
  },
  {
    name: "explain_with_evidence",
    policy: "read-only",
    pack_required: true,
    access_level: "learner",
    rate_limit: EXPLAIN_RATE_LIMIT_PER_MIN,
  },
  {
    name: "get_pack_conventions",
    policy: "read-only",
    pack_required: true,
    access_level: "learner",
    rate_limit: RATE_LIMIT_PER_MIN,
  },
  {
    name: "get_tech_docs_index",
    policy: "read-only",
    pack_required: true,
    access_level: "learner",
    rate_limit: RATE_LIMIT_PER_MIN,
  },
  {
    name: "get_tech_doc",
    policy: "read-only",
    pack_required: true,
    access_level: "learner",
    rate_limit: RATE_LIMIT_PER_MIN,
  },
  {
    name: "report_content_gap",
    policy: "mutating",
    pack_required: true,
    access_level: "learner",
    rate_limit: "10/day/user/pack",
  },
  {
    name: "list_pack_sources",
    policy: "read-only",
    pack_required: true,
    access_level: "learner",
    rate_limit: RATE_LIMIT_PER_MIN,
  },
  {
    name: "find_references",
    policy: "read-only",
    pack_required: true,
    access_level: "learner",
    rate_limit: RATE_LIMIT_PER_MIN,
  },
  // Resource tools
  {
    name: "get_resource_pack_agents",
    policy: "read-only",
    pack_required: true,
    access_level: "learner",
    resource_uri: "rocketboard://pack/<id>/agents",
  },
  {
    name: "get_resource_techdocs_index",
    policy: "read-only",
    pack_required: true,
    access_level: "learner",
    resource_uri: "rocketboard://pack/<id>/techdocs/index",
  },
  {
    name: "get_resource_techdoc",
    policy: "read-only",
    pack_required: true,
    access_level: "learner",
    resource_uri: "rocketboard://pack/<id>/techdocs/<name>",
  },
];

// ─── MCP Server Setup ─────────────────────────────────────────────────────────

const mcpServer = new McpServer({ name: "rocketboard-mcp", version: "1.0.0" });

// Helper factory: builds standard auth+rbac+rate-limit middleware per tool call
async function withToolContext<TArgs>(
  args: TArgs,
  req: Request,
  opts: {
    toolName: string;
    packId?: string;
    accessLevel?: "learner" | "author";
    rateLimitBucket?: string;
    maxPerMin?: number;
  },
): Promise<{
  userId: string;
  userToken: string;
  adminClient: ReturnType<typeof getAdminClient>;
  requestId: string;
  accessLevel: string;
}> {
  const requestId = crypto.randomUUID();
  const adminClient = getAdminClient();

  // 1. Auth
  const authResult = await authenticateRequest(req);
  const { userId, token: userToken } = authResult;

  // 2. Rate limit
  const bucket = opts.rateLimitBucket ?? opts.toolName;
  const maxPerMin = opts.maxPerMin ?? RATE_LIMIT_PER_MIN;
  const allowed = checkRateLimit(userId, bucket, maxPerMin);
  if (!allowed) {
    await auditError(adminClient, {
      requestId,
      userId,
      packId: opts.packId ?? null,
      toolName: opts.toolName,
      args,
      errorCode: "rate_limited",
    });
    throw Object.assign(new Error("Too many requests. Try again later."), {
      code: "rate_limited",
    });
  }

  // 3. Pack access check
  let accessLevel = "none";
  if (opts.packId && opts.accessLevel) {
    await checkPackAccess(adminClient, userId, opts.packId, opts.accessLevel);
    // Resolve current access level for the caller (for debug gating etc.)
    const { data: member } = await adminClient
      .from("pack_members")
      .select("access_level")
      .eq("pack_id", opts.packId)
      .eq("user_id", userId)
      .maybeSingle();
    accessLevel = member?.access_level ?? "learner";
  }

  return { userId, userToken, adminClient, requestId, accessLevel };
}

// ─── Register Tools ───────────────────────────────────────────────────────────

// 1. list_my_packs
mcpServer.tool(
  "list_my_packs",
  "List all packs the authenticated user is a member of.",
  ListMyPacksInputSchema.shape,
  async (args, { request }) => {
    const ctx = await withToolContext(args, request, {
      toolName: "list_my_packs",
    });
    const result = await listMyPacks(args, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// 2. search_knowledge_base
mcpServer.tool(
  "search_knowledge_base",
  "Perform a hybrid semantic+keyword search over a pack's knowledge base. Returns evidence span previews (not full content).",
  SearchInputSchema.shape,
  async (args, { request }) => {
    const ctx = await withToolContext(args, request, {
      toolName: "search_knowledge_base",
      packId: args.pack_id,
      accessLevel: "learner",
    });
    const result = await searchKnowledgeBase(args, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// 3. explain_with_evidence
mcpServer.tool(
  "explain_with_evidence",
  "Get a grounded, evidence-backed answer to a question about the pack's codebase. Returns citations and evidence manifest.",
  ExplainInputSchema.shape,
  async (args, { request }) => {
    const ctx = await withToolContext(args, request, {
      toolName: "explain_with_evidence",
      packId: args.pack_id,
      accessLevel: "learner",
      rateLimitBucket: "explain",
      maxPerMin: EXPLAIN_RATE_LIMIT_PER_MIN,
    });
    const result = await explainWithEvidence(args, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// 4. get_pack_conventions
mcpServer.tool(
  "get_pack_conventions",
  "Retrieve the pack's AGENTS.md conventions file. Returns stitched content with secrets redacted.",
  GetPackConventionsInputSchema.shape,
  async (args, { request }) => {
    const ctx = await withToolContext(args, request, {
      toolName: "get_pack_conventions",
      packId: args.pack_id,
      accessLevel: "learner",
    });
    const result = await getPackConventions(args, ctx);
    return {
      content: [{ type: "text", text: result.content }],
    };
  },
);

// 5. get_tech_docs_index
mcpServer.tool(
  "get_tech_docs_index",
  "List all technical document paths available in the pack under the 'Technical documents/' namespace.",
  GetTechDocsIndexInputSchema.shape,
  async (args, { request }) => {
    const ctx = await withToolContext(args, request, {
      toolName: "get_tech_docs_index",
      packId: args.pack_id,
      accessLevel: "learner",
    });
    const result = await getTechDocsIndex(args, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// 6. get_tech_doc
mcpServer.tool(
  "get_tech_doc",
  "Retrieve a specific technical document from the pack by its path (must start with 'Technical documents/').",
  GetTechDocInputSchema.shape,
  async (args, { request }) => {
    const ctx = await withToolContext(args, request, {
      toolName: "get_tech_doc",
      packId: args.pack_id,
      accessLevel: "learner",
    });
    const result = await getTechDoc(args, ctx);
    return {
      content: [{ type: "text", text: result.content }],
    };
  },
);

// 7. report_content_gap
mcpServer.tool(
  "report_content_gap",
  "Report a missing or incorrect piece of documentation. Stored for pack owner review. Rate limited to 10 reports/day/pack.",
  ReportGapInputSchema.shape,
  async (args, { request }) => {
    const ctx = await withToolContext(args, request, {
      toolName: "report_content_gap",
      packId: args.pack_id,
      accessLevel: "learner",
    });
    const result = await reportContentGap(args, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// 8. list_pack_sources
mcpServer.tool(
  "list_pack_sources",
  "List all sources (repos, docs, urls) defined in a specific pack.",
  ListPackSourcesInputSchema.shape,
  async (args, { request }) => {
    const ctx = await withToolContext(args, request, {
      toolName: "list_pack_sources",
      packId: args.pack_id,
      accessLevel: "learner",
    });
    const result = await listPackSources(args, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// 9. find_references
mcpServer.tool(
  "find_references",
  "Perform a graph-based lookup of references for a given symbol in a pack.",
  FindReferencesInputSchema.shape,
  async (args, { request }) => {
    const ctx = await withToolContext(args, request, {
      toolName: "find_references",
      packId: args.pack_id,
      accessLevel: "learner",
    });
    const result = await findReferences(args, {
      userId: ctx.userId,
      adminClient: ctx.adminClient,
      requestId: ctx.requestId,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// 10. Resource tool: get_resource_pack_agents
mcpServer.tool(
  "get_resource_pack_agents",
  "Resource: rocketboard://pack/<id>/agents — Retrieve pack conventions (AGENTS.md). Same as get_pack_conventions.",
  GetResourcePackAgentsInputSchema.shape,
  async (args, { request }) => {
    const ctx = await withToolContext(args, request, {
      toolName: "get_resource_pack_agents",
      packId: args.pack_id,
      accessLevel: "learner",
    });
    const result = await getPackConventions({ pack_id: args.pack_id }, ctx);
    return {
      content: [{ type: "text", text: result.content }],
    };
  },
);

// 9. Resource tool: get_resource_techdocs_index
mcpServer.tool(
  "get_resource_techdocs_index",
  "Resource: rocketboard://pack/<id>/techdocs/index — List available technical document paths.",
  GetResourceTechDocsIndexInputSchema.shape,
  async (args, { request }) => {
    const ctx = await withToolContext(args, request, {
      toolName: "get_resource_techdocs_index",
      packId: args.pack_id,
      accessLevel: "learner",
    });
    const result = await getTechDocsIndex({ pack_id: args.pack_id }, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// 10. Resource tool: get_resource_techdoc
mcpServer.tool(
  "get_resource_techdoc",
  "Resource: rocketboard://pack/<id>/techdocs/<name> — Retrieve a technical document by name (within 'Technical documents/' prefix).",
  GetResourceTechDocInputSchema.shape,
  async (args, { request }) => {
    const ctx = await withToolContext(args, request, {
      toolName: "get_resource_techdoc",
      packId: args.pack_id,
      accessLevel: "learner",
    });
    // The name argument now represents the slug, not a file path
    const path = args.name;
    const result = await getTechDoc({ pack_id: args.pack_id, path }, ctx);
    return {
      content: [{ type: "text", text: result.content }],
    };
  },
);

// ─── Inner MCP App (handles /mcp, /health, /, /registry) ─────────────────────

const mcpApp = new Hono().basePath("/");

mcpApp.get("/", (c) => {
  return c.json({
    name: "rocketboard-mcp",
    version: "1.0.0",
    description: "RocketBoard MCP Server — evidence-grounded onboarding tools",
    endpoints: {
      mcp: "/mcp",
      health: "/health",
      registry: "/registry",
    },
    tools: TOOL_REGISTRY.map((t) => t.name),
  });
});

mcpApp.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

mcpApp.get("/registry", (c) => {
  return c.json({
    server: "rocketboard-mcp",
    version: "1.0.0",
    tools: TOOL_REGISTRY,
    note:
      "policy=read-only tools do not mutate data; policy=mutating tools write to pack-scoped tables only",
  });
});

// OPTIONS handler (for MCP clients that preflighт)
mcpApp.options("/mcp", (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, Mcp-Session-Id",
    },
  });
});

// MCP Streamable HTTP transport — ALL methods on /mcp
mcpApp.all("/mcp", async (c) => {
  return mcpServer.handle(c.req.raw);
});

// ─── Outer App (Supabase routing: /rocketboard-mcp/*) ─────────────────────────

const app = new Hono();
app.route("/rocketboard-mcp", mcpApp);

// Handle 404 on outer app
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Global error handler — never leak internal details
app.onError((err, c) => {
  const code = (err as any).code;

  if (err instanceof McpAuthError) return authErrorResponse(err);
  if (err instanceof McpAccessError) return accessErrorResponse(err);

  if (code === "rate_limited") {
    return c.json({
      error: "Too many requests",
      code: "rate_limited",
      message: err.message,
    }, 429);
  }

  // Zod validation errors
  if (err.name === "ZodError") {
    return c.json({ error: "Invalid input", detail: (err as any).errors }, 400);
  }

  console.error("[MCP:unhandled]", err.message);
  return c.json({ error: "Internal server error" }, 500);
});

// ─── Deno serve entrypoint ────────────────────────────────────────────────────

Deno.serve((req: Request) => app.fetch(req));
