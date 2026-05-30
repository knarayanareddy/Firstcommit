import { getSourceCredential } from "../_shared/credentials.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import {
  checkPackChunkCap,
  getRunCap,
  validateIngestion,
} from "../_shared/ingestion-guards.ts";
import {
  computeContentHash,
  computeDeterministicChunkId,
} from "../_shared/hash-utils.ts";
import { processEmbeddingsWithReuse } from "../_shared/embedding-reuse.ts";
import {
  normalizeNotionBlocksToMarkdown,
  richTextToPlain,
} from "../_shared/content-normalizers.ts";
import { chunkMarkdownByHeadings } from "../_shared/smart-chunker.ts";
import { createTrace, shouldTrace } from "../_shared/telemetry.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/authz.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { requirePackRole } from "../_shared/pack-access.ts";

const NOTION_VERSION = "2022-06-28";

// Redaction now handled by centralized secret-patterns.ts

// Normalization and chunking moved to shared modules

function getPageTitle(page: any): string {
  const titleProp = page.properties?.title || page.properties?.Name;
  if (titleProp?.title) {
    return richTextToPlain(titleProp.title) || "Untitled";
  }
  return "Untitled";
}

async function notionFetch(
  url: string,
  token: string,
  method = "GET",
  body?: any,
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Notion API error: ${resp.status} ${err}`);
  }

  return resp.json();
}

async function fetchPageBlocks(pageId: string, token: string): Promise<any[]> {
  const allBlocks: any[] = [];
  let cursor: string | undefined;

  while (true) {
    let url =
      `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;
    if (cursor) url += `&start_cursor=${cursor}`;

    const data = await notionFetch(url, token);
    allBlocks.push(...(data.results || []));

    if (!data.has_more) break;
    cursor = data.next_cursor;

    // Rate limiting: 3 req/s
    await new Promise((r) => setTimeout(r, 350));
  }

  // Recursively fetch child blocks for blocks that have children
  for (const block of allBlocks) {
    if (
      block.has_children && block.type !== "child_page" &&
      block.type !== "child_database"
    ) {
      const children = await fetchPageBlocks(block.id, token);
      allBlocks.push(...children);
    }
  }

  return allBlocks;
}

async function searchAllPages(token: string): Promise<any[]> {
  const pages: any[] = [];
  let cursor: string | undefined;

  while (true) {
    const body: any = {
      page_size: 100,
      filter: { property: "object", value: "page" },
    };
    if (cursor) body.start_cursor = cursor;

    const data = await notionFetch(
      "https://api.notion.com/v1/search",
      token,
      "POST",
      body,
    );
    pages.push(...(data.results || []));

    if (!data.has_more) break;
    cursor = data.next_cursor;
    await new Promise((r) => setTimeout(r, 350));
  }

  return pages;
}

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);
  const supabase = createServiceClient();

  let source_id: string | undefined;
  let jobId: string | undefined;
  let trace: any;

  try {
    const body = await readJson(req, corsHeaders);
    source_id = body.source_id;
    const { pack_id, source_config, org_id } = body;

    if (!pack_id || !source_id || !source_config) {
      return jsonError(
        400,
        "bad_request",
        "Missing required fields",
        {},
        corsHeaders,
      );
    }

    // 1. Authenticate user
    const { userId } = await requireUser(req, corsHeaders);

    // 2. Authorize pack access (Author or higher)
    const serviceClient = createServiceClient();
    await requirePackRole(
      serviceClient,
      pack_id,
      userId,
      "author",
      corsHeaders,
    );

    // Initialize Trace (Strategic Sampling)
    trace = createTrace({
      serviceName: "ingest-notion",
      taskType: "ingestion",
      requestId: crypto.randomUUID(),
      packId: pack_id,
      sourceId: source_id,
      orgId: org_id,
      environment: Deno.env.get("ENVIRONMENT") || "production",
    }, { enabled: shouldTrace() });

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";

    let { integration_token, root_page_id } = source_config;

    // 1. Fetch integration_token from Vault if missing
    if (!integration_token) {
      integration_token = await getSourceCredential(
        supabase,
        source_id,
        "api_token",
      );
    }

    if (!integration_token) {
      return new Response(
        JSON.stringify({ error: "Missing Notion integration token" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Check Ingestion Guards (Cooldown, Concurrency)
    const guard = await validateIngestion(supabase, pack_id, source_id);
    if (!guard.success) {
      return new Response(
        JSON.stringify({
          error: guard.error,
          next_allowed_at: guard.next_allowed_at,
        }),
        {
          status: guard.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Check Pack-level Chunk Cap
    const cap = await checkPackChunkCap(supabase, pack_id);
    if (!cap.success) {
      return new Response(JSON.stringify({ error: cap.error }), {
        status: cap.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobErr } = await supabase
      .from("ingestion_jobs")
      .insert({
        pack_id,
        source_id,
        status: "processing",
        started_at: new Date().toISOString(),
        retry_count: guard.retry_count || 0,
      })
      .select()
      .single();
    if (jobErr) throw jobErr;
    jobId = job.id;
    trace.updateMetadata({ jobId });

    // Get pages
    let pages: any[];
    if (root_page_id) {
      // Fetch child pages from root
      console.log(`[Notion] Fetching children of page ${root_page_id}...`);
      const fetchSpan = trace.startSpan("fetch_pages", { root_page_id });
      const blocks = await fetchPageBlocks(root_page_id, integration_token);
      const childPages = blocks.filter((b: any) => b.type === "child_page");

      // Also process the root page itself
      const rootPage = await notionFetch(
        `https://api.notion.com/v1/pages/${root_page_id}`,
        integration_token,
      );
      pages = [
        rootPage,
        ...await Promise.all(childPages.map((cp: any) =>
          notionFetch(
            `https://api.notion.com/v1/pages/${cp.id}`,
            integration_token,
          )
        )),
      ];
      fetchSpan.end({ count: pages.length });
    } else {
      console.log("[Notion] Searching all accessible pages...");
      const fetchSpan = trace.startSpan("search_pages");
      pages = await searchAllPages(integration_token);
      fetchSpan.end({ count: pages.length });
    }

    console.log(`[Notion] Found ${pages.length} pages`);
    await serviceClient.from("ingestion_jobs").update({
      total_chunks: pages.length,
    }).eq("id", jobId);

    const allChunks: any[] = [];
    let chunkIdx = 0;

    for (const page of pages) {
      const title = getPageTitle(page);

      // Fetch page blocks
      const blocks = await fetchPageBlocks(page.id, integration_token);
      const markdown = normalizeNotionBlocksToMarkdown(blocks);

      if (!markdown.trim()) continue;

      const pagePath = `notion:${title}`;
      const structuralChunks = chunkMarkdownByHeadings(markdown);
      for (const chunk of structuralChunks) {
        chunkIdx++;
        // Check per-run cap
        if (chunkIdx > getRunCap()) {
          throw new Error(
            `Ingestion cap exceeded: maximum of ${getRunCap()} new chunks per run allowed.`,
          );
        }
        const assessment = assessChunkRedaction(chunk.text);
        const hash = await computeContentHash(assessment.contentToStore);
        const chunkId = await computeDeterministicChunkId(
          pagePath,
          chunk.start,
          chunk.end,
          hash,
        );

        allChunks.push({
          chunk_id: chunkId,
          path: pagePath,
          start_line: chunk.start,
          end_line: chunk.end,
          content: assessment.contentToStore,
          content_hash: hash,
          is_redacted: assessment.isRedacted,
          metadata: {
            redaction: {
              action: assessment.action,
              secretsFound: assessment.metrics.secretsFound,
              matchedPatterns: assessment.metrics.matchedPatterns,
              redactionRatio: assessment.metrics.redactionRatio,
            },
          },
          ingestion_job_id: jobId,
        });
      }
    }
    trace.addSpan({
      name: "chunk_summary",
      startTime: Date.now(),
      endTime: Date.now(),
      output: { total_chunks: allChunks.length, pages_processed: pages.length },
    });

    // 4. Handle Embeddings (Reuse + Generation)
    const embedSpan = trace.startSpan("process_embeddings", {
      count: allChunks.length,
    });
    const { reusedCount, generatedCount } = await processEmbeddingsWithReuse(
      supabase,
      pack_id,
      source_id,
      allChunks,
      openAIApiKey,
    );
    embedSpan.end({ reusedCount, generatedCount });
    if (generatedCount > 0) trace.enable();

    // Upsert chunks
    const BATCH_SIZE = 100;
    let processed = 0;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE).map((c) => ({
        pack_id,
        source_id,
        ...c,
      }));
      const { error: upsertErr } = await supabase
        .from("knowledge_chunks")
        .upsert(batch, { onConflict: "pack_id,chunk_id" });
      if (upsertErr) console.error("Upsert error:", upsertErr);
      processed += batch.length;
      await serviceClient.from("ingestion_jobs").update({
        processed_chunks: processed,
      }).eq("id", jobId);
    }

    await serviceClient.from("pack_sources").update({
      last_synced_at: new Date().toISOString(),
    }).eq("id", source_id);

    await serviceClient.from("ingestion_jobs").update({
      status: "completed",
      processed_chunks: allChunks.length,
      completed_at: new Date().toISOString(),
      metadata: {
        total_chunks: allChunks.length,
        embeddings_reused_count: reusedCount,
        embeddings_generated_count: generatedCount,
        trace_id: trace.getTraceId(),
      },
    }).eq("id", jobId);

    await trace.flush();

    return json(200, {
      success: true,
      job_id: jobId,
      chunks: allChunks.length,
      pages: pages.length,
    }, corsHeaders);
  } catch (err: any) {
    if (err.response) return err.response;
    console.error("Notion ingestion error:", err);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
