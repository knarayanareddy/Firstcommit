import { createTrace } from "../_shared/telemetry.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { requireUser } from "../_shared/authz.ts";
import { requirePackRole } from "../_shared/pack-access.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);
  const startTime = Date.now();

  let trace = createTrace({ taskType: "startup", requestId: "unknown" }, {
    enabled: false,
  });
  let requestId = "unknown";

  try {
    // 1. Authenticate user
    const { userId } = await requireUser(req, corsHeaders);

    // 2. Parse request
    const body = await readJson(req, corsHeaders).catch(() => ({}));
    const { pack_id, query, filters, limit = 10 } = body;

    requestId = body.request_id || body.trace_id ||
      req.headers.get("x-request-id") || crypto.randomUUID();
    trace = createTrace({
      taskType: "search-content",
      requestId,
      userId,
      packId: pack_id,
      serviceName: "retrieval",
    });

    if (!pack_id || !query || query.trim().length === 0) {
      return jsonError(400, "bad_request", "pack_id and query are required", {
        trace_id: requestId,
      }, corsHeaders);
    }

    const safeLimit = Math.min(Math.max(limit, 1), 25);
    const clampedQuery = query.trim().slice(0, 500);

    if (clampedQuery.length === 0) {
      return json(200, {
        modules: [],
        glossary: [],
        notes: [],
        chatHistory: [],
        sourceChunks: [],
      }, corsHeaders);
    }

    const activeFilters = filters && filters.length > 0
      ? filters
      : ["modules", "glossary", "notes", "chatHistory", "sourceChunks"];

    const serviceClient = createServiceClient();

    // 3. Authorize pack access (Learner or higher)
    const { org_id } = await requirePackRole(
      serviceClient,
      pack_id,
      userId,
      "learner",
      corsHeaders,
    );

    const results: Record<string, unknown[]> = {
      modules: [],
      glossary: [],
      notes: [],
      chatHistory: [],
      sourceChunks: [],
    };

    // Run searches in parallel
    const promises: Promise<void>[] = [];

    if (activeFilters.includes("sourceChunks")) {
      promises.push(
        (async () => {
          const rpcSpan = trace.startSpan("rpc:hybrid_search_v2");
          const { data } = await serviceClient.rpc("hybrid_search_v2", {
            p_org_id: org_id,
            p_pack_id: pack_id,
            p_query_text: clampedQuery,
            p_query_embedding: null,
            p_match_count: safeLimit,
          });
          rpcSpan.end({ count: data?.length || 0 });

          if (data) {
            results.sourceChunks = data.map((r: any) => ({
              chunkId: r.id,
              path: r.path,
              snippet: makeSnippet(r.content, clampedQuery),
            }));
          }
        })(),
      );
    }
    // ... other search logic remains same ...
    if (activeFilters.includes("modules")) {
      promises.push(
        (async () => {
          const { data } = await serviceClient
            .from("generated_modules")
            .select("module_key, title, module_data, description")
            .eq("pack_id", pack_id)
            .eq("status", "published")
            .limit(100);
          if (data) {
            const lowerQ = clampedQuery.toLowerCase();
            const matched: any[] = [];
            for (const mod of data) {
              const sections = (mod.module_data as any)?.sections || [];
              for (const sec of sections) {
                const heading = sec.heading || "";
                const md = sec.markdown || "";
                if (
                  heading.toLowerCase().includes(lowerQ) ||
                  md.toLowerCase().includes(lowerQ)
                ) {
                  matched.push({
                    moduleKey: mod.module_key,
                    moduleTitle: mod.title,
                    sectionId: sec.id || heading,
                    sectionHeading: heading,
                    snippet: makeSnippet(md || heading, clampedQuery),
                  });
                  if (matched.length >= safeLimit) break;
                }
              }
              // Also check title/description
              if (
                mod.title?.toLowerCase().includes(lowerQ) ||
                mod.description?.toLowerCase().includes(lowerQ)
              ) {
                if (!matched.some((m: any) => m.moduleKey === mod.module_key)) {
                  matched.push({
                    moduleKey: mod.module_key,
                    moduleTitle: mod.title,
                    sectionId: null,
                    sectionHeading: null,
                    snippet: makeSnippet(
                      mod.description || mod.title,
                      clampedQuery,
                    ),
                  });
                }
              }
              if (matched.length >= safeLimit) break;
            }
            results.modules = matched.slice(0, safeLimit);
          }
        })(),
      );
    }

    if (activeFilters.includes("glossary")) {
      promises.push(
        (async () => {
          const { data } = await serviceClient
            .from("generated_glossaries")
            .select("glossary_data")
            .eq("pack_id", pack_id)
            .limit(1)
            .order("created_at", { ascending: false });
          if (data && data.length > 0) {
            const terms = (data[0].glossary_data as any[]) || [];
            const lowerQ = clampedQuery.toLowerCase();
            const matched = terms
              .filter(
                (t: any) =>
                  (t.term || "").toLowerCase().includes(lowerQ) ||
                  (t.definition || "").toLowerCase().includes(lowerQ),
              )
              .slice(0, safeLimit)
              .map((t: any) => ({
                term: t.term,
                definition: t.definition,
                snippet: makeSnippet(t.definition || t.term, clampedQuery),
              }));
            results.glossary = matched;
          }
        })(),
      );
    }

    if (activeFilters.includes("notes")) {
      promises.push(
        (async () => {
          const { data } = await serviceClient
            .from("learner_notes")
            .select("module_id, section_id, content")
            .eq("user_id", userId)
            .eq("pack_id", pack_id)
            .textSearch("content", clampedQuery, {
              type: "websearch",
              config: "simple",
            })
            .limit(safeLimit);
          if (data) {
            results.notes = data.map((r: any) => ({
              moduleId: r.module_id,
              sectionId: r.section_id,
              snippet: makeSnippet(r.content, clampedQuery),
            }));
          }
        })(),
      );
    }

    if (activeFilters.includes("chatHistory")) {
      promises.push(
        (async () => {
          const { data } = await serviceClient
            .from("chat_messages")
            .select("module_id, content, role")
            .eq("user_id", userId)
            .eq("pack_id", pack_id)
            .textSearch("content", clampedQuery, {
              type: "websearch",
              config: "simple",
            })
            .limit(safeLimit);
          if (data) {
            results.chatHistory = data.map((r: any) => ({
              moduleId: r.module_id,
              content: r.content,
              role: r.role,
              snippet: makeSnippet(r.content, clampedQuery),
            }));
          }
        })(),
      );
    }

    await Promise.allSettled(promises);

    const latency_ms = Date.now() - startTime;
    await trace.flush();

    return json(200, {
      ...results,
      trace_id: requestId,
      latency_ms,
    }, corsHeaders);
  } catch (error: any) {
    if (error.response) return error.response;

    console.error("Search error:", error);
    trace.setError(error.message);
    await trace.flush();
    return jsonError(500, "internal_error", "Internal server error", {
      trace_id: requestId,
    }, corsHeaders);
  }
});

function makeSnippet(text: string, query: string, contextChars = 80): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase().split(/\s+/)[0] || query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) {
    return text.slice(0, contextChars * 2) +
      (text.length > contextChars * 2 ? "…" : "");
  }
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + qLower.length + contextChars);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";
  return snippet;
}
