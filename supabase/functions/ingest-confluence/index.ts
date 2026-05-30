import { astChunk } from "../_shared/ast-chunker.ts";
import { getSourceCredential } from "../_shared/credentials.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
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
import { normalizeConfluenceHtmlToMarkdown } from "../_shared/content-normalizers.ts";
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

// Redaction now handled by centralized secret-patterns.ts

// Redaction now handled by centralized secret-patterns.ts

// Normalization and chunking moved to shared modules

async function fetchAllPages(
  baseUrl: string,
  spaceKey: string,
  auth: string,
): Promise<any[]> {
  const pages: any[] = [];
  let cursor: string | null = null;

  while (true) {
    let url =
      `${baseUrl}/wiki/api/v2/spaces/${spaceKey}/pages?limit=50&body-format=storage`;
    if (cursor) url += `&cursor=${cursor}`;

    const resp = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      // Fallback to v1 API
      if (resp.status === 404) {
        return await fetchAllPagesV1(baseUrl, spaceKey, auth);
      }
      const errText = await resp.text();
      throw new Error(`Confluence API error: ${resp.status} ${errText}`);
    }

    const data = await resp.json();
    pages.push(...(data.results || []));

    // Check for next page
    const nextLink = data._links?.next;
    if (!nextLink) break;

    // Extract cursor from next link
    const cursorMatch = nextLink.match(/cursor=([^&]+)/);
    cursor = cursorMatch ? cursorMatch[1] : null;
    if (!cursor) break;

    // Rate limiting: ~100 req/min → wait 600ms between requests
    await new Promise((r) => setTimeout(r, 600));
  }

  return pages;
}

async function fetchAllPagesV1(
  baseUrl: string,
  spaceKey: string,
  auth: string,
): Promise<any[]> {
  const pages: any[] = [];
  let start = 0;
  const limit = 50;

  while (true) {
    const url =
      `${baseUrl}/wiki/rest/api/content?spaceKey=${spaceKey}&type=page&limit=${limit}&start=${start}&expand=body.storage,title`;

    const resp = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Confluence v1 API error: ${resp.status} ${errText}`);
    }

    const data = await resp.json();
    const results = data.results || [];

    // Map v1 format to v2-like format
    for (const page of results) {
      pages.push({
        id: page.id,
        title: page.title,
        body: {
          storage: {
            value: page.body?.storage?.value || "",
          },
        },
      });
    }

    if (results.length < limit) break;
    start += limit;
    await new Promise((r) => setTimeout(r, 600));
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
      serviceName: "ingest-confluence",
      taskType: "ingestion",
      requestId: crypto.randomUUID(),
      packId: pack_id,
      sourceId: source_id,
      orgId: org_id,
      environment: Deno.env.get("ENVIRONMENT") || "production",
    }, { enabled: shouldTrace() });

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";

    let { base_url, space_key, auth_email, api_token } = source_config;

    // 1. Fetch api_token from Vault if missing
    if (!api_token) {
      api_token = await getSourceCredential(supabase, source_id, "api_token");
    }

    if (!base_url || !space_key || !auth_email || !api_token) {
      return new Response(
        JSON.stringify({ error: "Missing Confluence credentials" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Validate URL (SSRF Protection)
    let validatedBaseUrl: string;
    try {
      const allowedHosts =
        Deno.env.get("ALLOWED_CONFLUENCE_HOSTS")?.split(",") || [];
      validatedBaseUrl = parseAndValidateExternalUrl(base_url, {
        allowedHostSuffixes: [".atlassian.net", ...allowedHosts],
        allowHttps: true,
      });
      // Ensure no trailing slash
      validatedBaseUrl = validatedBaseUrl.replace(/\/$/, "");
    } catch (err: any) {
      console.error(
        `[SSRF BLOCK] Invalid Confluence base_url: ${base_url}`,
        err.message,
      );
      return new Response(
        JSON.stringify({
          error:
            "Invalid Confluence URL. Only official Atlassian cloud hosts are allowed by default.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Check Ingestion Guards (Cooldown, Concurrency)
    const guard = await validateIngestion(supabase, pack_id, source_id);
    if (!guard.success) {
      return jsonError(
        guard.status || 403,
        "ingestion_restricted",
        guard.error || "Ingestion restricted",
        { next_allowed_at: guard.next_allowed_at },
        corsHeaders,
      );
    }

    // 2. Check Pack-level Chunk Cap
    const cap = await checkPackChunkCap(supabase, pack_id);
    if (!cap.success) {
      return jsonError(
        cap.status || 403,
        "cap_exceeded",
        cap.error || "Chunk cap exceeded",
        {},
        corsHeaders,
      );
    }

    // 3. Create ingestion job
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

    const cleanUrl = validatedBaseUrl;
    const auth = btoa(`${auth_email}:${api_token}`);

    console.log(`[Confluence] Fetching pages from space ${space_key}...`);
    const fetchSpan = trace.startSpan("fetch_pages", { space_key });
    const pages = await fetchAllPages(cleanUrl, space_key, auth);
    fetchSpan.end({ count: pages.length });
    console.log(`[Confluence] Found ${pages.length} pages`);

    await serviceClient.from("ingestion_jobs").update({
      total_chunks: pages.length,
    }).eq("id", jobId);

    const allChunks: any[] = [];
    let chunkIdx = 0;

    for (const page of pages) {
      const title = page.title || "Untitled";
      const htmlContent = page.body?.storage?.value || "";
      const markdown = normalizeConfluenceHtmlToMarkdown(htmlContent);

      if (!markdown.trim()) continue;

      const pagePath = `confluence:${space_key}/${title}`;
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
            ingestion_job_id: jobId,
          },
        });
      }

      if (allChunks.length % 50 === 0) {
        await serviceClient.from("ingestion_jobs").update({
          processed_chunks: allChunks.length,
        }).eq("id", jobId);
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

    // Upsert chunks in batches
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

    // Update source sync time
    await serviceClient.from("pack_sources").update({
      last_synced_at: new Date().toISOString(),
    }).eq("id", source_id);

    // Mark complete
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

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        chunks: allChunks.length,
        pages: pages.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    if (err.response) return err.response;
    console.error("Confluence ingestion error:", err);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
