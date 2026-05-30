import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import {
  parseAndValidateExternalUrl,
  safeFetch,
} from "../_shared/external-url-policy.ts";
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
import { normalizeUrlHtmlToMarkdown } from "../_shared/content-normalizers.ts";
import { chunkMarkdownByHeadings } from "../_shared/smart-chunker.ts";
import { createTrace, shouldTrace } from "../_shared/telemetry.ts";

import { json, jsonError, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { requireInternal } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-rocketboard-internal",
};

// Normalization and chunking moved to shared modules

async function fetchPage(
  url: string,
  policy: any,
): Promise<{ content: string; contentType: string; html: string }> {
  const validatedUrl = parseAndValidateExternalUrl(url, policy);
  const resp = await safeFetch(validatedUrl, {
    headers: { "User-Agent": "RocketBoard-Bot/1.0 (knowledge ingestion)" },
  }, policy);

  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  const contentType = resp.headers.get("content-type") || "";
  const html = await resp.text();

  if (contentType.includes("text/html")) {
    let content = normalizeUrlHtmlToMarkdown(html);
    if (content.length < 200) {
      try {
        const jinaResp = await safeFetch(`https://r.jina.ai/${validatedUrl}`, {
          headers: {
            "Accept": "text/plain",
            "User-Agent": "RocketBoard-Bot/1.0",
          },
        }, policy);
        if (jinaResp.ok) {
          const jinaContent = await jinaResp.text();
          if (jinaContent.length > content.length) {
            return { content: jinaContent, contentType: "html", html };
          }
        }
      } catch {}
    }
    return { content, contentType: "html", html };
  }
  return { content: html, contentType: contentType.split(";")[0], html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 1. Internal Auth Gate (with legacy fallback)
  const internal = requireInternal(req, corsHeaders);
  if (!internal.success) return internal.response;

  // Hoist for catch scope
  let source_id: string | undefined;
  let jobId: string | undefined;
  let trace: any;

  try {
    const body = await readJson(req, corsHeaders);
    const {
      pack_id,
      startUrl,
      crawl_mode = "single_page",
      max_pages = 1,
      max_depth = 0,
      follow_internal_only = true,
      include_pdfs = false,
      org_id,
    } = body;
    source_id = body.source_id;

    trace = createTrace({
      serviceName: "ingest-url",
      taskType: "ingestion",
      requestId: crypto.randomUUID(),
      packId: pack_id,
      sourceId: source_id,
      orgId: org_id,
      environment: Deno.env.get("ENVIRONMENT") || "production",
    }, { enabled: shouldTrace() });

    if (!pack_id || !source_id || !startUrl) {
      return jsonError(
        400,
        "bad_request",
        "Missing required fields: pack_id, source_id, or startUrl",
        {},
        corsHeaders,
      );
    }

    const serviceClient = createServiceClient();
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") ||
      Deno.env.get("LOCAL_LLM_API_KEY") || "";

    const guard = await validateIngestion(serviceClient, pack_id, source_id);
    if (!guard.success) {
      return json(guard.status ?? 503, {
        error: guard.error,
        next_allowed_at: guard.next_allowed_at,
      }, corsHeaders);
    }

    const cap = await checkPackChunkCap(serviceClient, pack_id);
    if (!cap.success) {
      return json(cap.status ?? 429, {
        error: cap.error ?? "chunk_cap_exceeded",
      }, corsHeaders);
    }

    const { data: job, error: jobErr } = await serviceClient
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

    const urlPolicy = {
      allowedHostSuffixes: [
        "github.com",
        "atlassian.net",
        "notion.so",
        "slack.com",
        "microsoft.com",
        "google.com",
        "readme.io",
        "gitbook.com",
      ],
      disallowPrivateIPs: true,
      allowHttp: Deno.env.get("ALLOW_INSECURE_URL_INGESTION") === "true",
      allowHttps: true,
    };

    const validatedStartUrl = parseAndValidateExternalUrl(startUrl, urlPolicy);
    const baseUrlObj = new URL(validatedStartUrl);
    const baseDomain = baseUrlObj.hostname;
    const visited = new Set<string>();
    const queue: { url: string; depth: number }[] = [{
      url: validatedStartUrl,
      depth: 0,
    }];
    const allChunks: any[] = [];
    let chunkIdx = 0;
    let pagesProcessed = 0;

    while (queue.length > 0 && pagesProcessed < max_pages) {
      const current = queue.shift()!;
      try {
        if (visited.has(current.url)) continue;
        visited.add(current.url);

        const fetchSpan = trace.startSpan("fetch_page", { url: current.url });
        const { content, contentType, html } = await fetchPage(
          current.url,
          urlPolicy,
        );
        fetchSpan.end({ contentType, length: content.length });
        pagesProcessed++;

        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const titleText = titleMatch ? titleMatch[1].trim() : "";
        const pageContent = titleText
          ? `# ${titleText}\n\n${content}`
          : content;
        const urlPath = new URL(current.url).pathname;
        const pagePath = `url:${baseDomain}${urlPath}`;

        const structuralChunks = chunkMarkdownByHeadings(pageContent);
        for (const chunk of structuralChunks) {
          chunkIdx++;
          if (chunkIdx > getRunCap()) {
            throw new Error(`Ingestion cap exceeded (${getRunCap()})`);
          }

          const assessment = assessChunkRedaction(chunk.text);
          if (assessment.action === "exclude") continue;

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
            ingestion_job_id: jobId,
            metadata: {
              source_url: current.url,
              page_title: titleText,
              redaction: assessment.metrics,
            },
          });
        }

        if (
          crawl_mode === "crawl" && current.depth < max_depth &&
          contentType === "html"
        ) {
          const links = extractLinks(html, current.url);
          for (const link of links) {
            try {
              const linkUrl = new URL(link);
              if (!linkUrl.protocol.startsWith("http")) continue;
              if (follow_internal_only && linkUrl.hostname !== baseDomain) {
                continue;
              }
              if (
                linkUrl.pathname.match(
                  /\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|ttf|eot)$/i,
                )
              ) continue;
              if (!include_pdfs && linkUrl.pathname.endsWith(".pdf")) continue;
              if (visited.has(linkUrl.href)) continue;

              parseAndValidateExternalUrl(linkUrl.href, urlPolicy);
              queue.push({ url: linkUrl.href, depth: current.depth + 1 });
            } catch {}
          }
        }

        await serviceClient.from("ingestion_jobs").update({
          processed_chunks: pagesProcessed,
          total_chunks: pagesProcessed + queue.length,
        }).eq("id", jobId);

        if (crawl_mode === "crawl" && queue.length > 0) {
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (err: any) {
        console.error(`Failed to fetch ${current.url}:`, err);
      }
    }

    const { reusedCount, generatedCount } = await processEmbeddingsWithReuse(
      serviceClient,
      pack_id,
      source_id,
      allChunks,
      openAIApiKey,
    );
    if (generatedCount > 0) trace.enable();

    const BATCH_SIZE = 100;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE).map((c) => ({
        pack_id,
        source_id,
        ...c,
      }));
      await serviceClient.from("knowledge_chunks").upsert(batch, {
        onConflict: "pack_id,chunk_id",
      });
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
        reusedCount,
        generatedCount,
        trace_id: trace.getTraceId(),
      },
    }).eq("id", jobId);

    await trace.flush();
    return json(200, {
      success: true,
      job_id: jobId,
      pages: pagesProcessed,
      chunks: allChunks.length,
    }, corsHeaders);
  } catch (err: any) {
    console.error("URL ingestion fatal error:", err);
    try {
      const serviceClient = createServiceClient();
      if (source_id) {
        await serviceClient.from("ingestion_jobs").update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: (err.message || "Unknown error").slice(0, 500),
          last_error_at: new Date().toISOString(),
          last_error_message: (err.message || "Unknown error").slice(0, 500),
        }).eq("source_id", source_id).eq("status", "processing");

        if (jobId) {
          console.log(
            `[CLEANUP] Deleting partial chunks for failed job ${jobId}`,
          );
          await serviceClient.from("knowledge_chunks").delete().eq(
            "ingestion_job_id",
            jobId,
          );
        }
      }
    } catch (e) {
      console.error("Secondary error in catch block:", e);
    }

    if (trace) {
      trace.setError(err.message).enable();
      await trace.flush();
    }
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const regex = /<a[^>]+href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      links.push(new URL(match[1], baseUrl).toString());
    } catch { /* skip invalid links */ }
  }
  return links;
}
