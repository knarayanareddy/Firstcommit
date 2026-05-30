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
import { normalizeJiraIssueToMarkdown } from "../_shared/content-normalizers.ts";
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

// Local sha256 removed in favor of computeContentHash

// Local sha256 removed in favor of computeContentHash

// Normalization and chunking moved to shared modules

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
    const { pack_id, source_id: bodySourceId, source_config, org_id } = body;
    source_id = bodySourceId;

    if (!pack_id || !source_id) {
      return jsonError(
        400,
        "bad_request",
        "Missing pack_id or source_id",
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
      serviceName: "ingest-jira",
      taskType: "ingestion",
      requestId: crypto.randomUUID(),
      packId: pack_id,
      sourceId: source_id,
      orgId: org_id,
      environment: Deno.env.get("ENVIRONMENT") || "production",
    }, { enabled: shouldTrace() });

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";

    let {
      base_url,
      project_key,
      auth_email,
      api_token,
      max_issues = 200,
      include_epics = true,
      include_recent = true,
      include_comments = false,
      include_resolved = false,
    } = source_config || {};

    // 1. Fetch api_token from Vault if missing
    if (!api_token) {
      api_token = await getSourceCredential(supabase, source_id, "api_token");
    }

    if (!base_url || !project_key || !auth_email || !api_token) {
      return jsonError(
        400,
        "bad_request",
        "Missing Jira configuration",
        {},
        corsHeaders,
      );
    }

    // 2. Validate URL (SSRF Protection)
    let validatedBaseUrl: string;
    try {
      const allowedHosts = Deno.env.get("ALLOWED_JIRA_HOSTS")?.split(",") || [];
      validatedBaseUrl = parseAndValidateExternalUrl(base_url, {
        allowedHostSuffixes: [".atlassian.net", ...allowedHosts],
        allowHttps: true,
      });
      // Ensure no trailing slash for cleaner concatenation
      validatedBaseUrl = validatedBaseUrl.replace(/\/$/, "");
    } catch (err: any) {
      console.error(
        `[SSRF BLOCK] Invalid Jira base_url: ${base_url}`,
        err.message,
      );
      return jsonError(
        400,
        "security_violation",
        "Invalid Jira URL. Only official Atlassian cloud hosts are allowed by default.",
        {},
        corsHeaders,
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

    const { data: job, error: jobErr } = await serviceClient.from(
      "ingestion_jobs",
    )
      .insert({
        pack_id,
        source_id,
        status: "processing",
        started_at: new Date().toISOString(),
        retry_count: guard.retry_count || 0,
      })
      .select().single();
    if (jobErr) throw jobErr;
    jobId = job.id;
    trace.updateMetadata({ jobId });

    const authHeader = "Basic " + btoa(`${auth_email}:${api_token}`);
    const headers = { Authorization: authHeader, Accept: "application/json" };

    // Build JQL
    let jql = `project=${project_key}`;
    if (!include_resolved) jql += " AND statusCategory != Done";
    if (include_recent) jql += " AND created >= -30d";
    jql += " ORDER BY created DESC";

    let allIssues: any[] = [];
    let startAt = 0;
    const maxResults = 50;
    const fetchSpan = trace.startSpan("fetch_issues", { jql });
    while (allIssues.length < max_issues) {
      const resp = await fetch(
        `${validatedBaseUrl}/rest/api/3/search?jql=${
          encodeURIComponent(jql)
        }&maxResults=${maxResults}&startAt=${startAt}&fields=summary,description,issuetype,status,priority,labels,components,fixVersions,comment`,
        { headers },
      );
      if (!resp.ok) {
        throw new Error(`Jira API error: ${resp.status} ${await resp.text()}`);
      }
      const data = await resp.json();
      allIssues.push(...data.issues);
      if (data.issues.length < maxResults || allIssues.length >= data.total) {
        break;
      }
      startAt += maxResults;
    }
    fetchSpan.end({ count: allIssues.length });

    allIssues = allIssues.slice(0, max_issues);
    await serviceClient.from("ingestion_jobs").update({
      total_chunks: allIssues.length,
    }).eq("id", jobId);

    const allChunks: any[] = [];
    let chunkIdx = 0;

    for (const issue of allIssues) {
      const markdown = normalizeJiraIssueToMarkdown(issue);
      const pagePath = `jira:${project_key}/${issue.key}`;
      const structuralChunks = chunkMarkdownByHeadings(markdown);

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
          pack_id,
          source_id,
          ingestion_job_id: jobId,
          metadata: {
            issue_key: issue.key,
            issue_type: issue.fields.issuetype?.name,
            status: issue.fields.status?.name,
            redaction: assessment.metrics,
          },
        });
      }

      if (chunkIdx % 20 === 0) {
        await serviceClient.from("ingestion_jobs").update({
          processed_chunks: allChunks.length,
        }).eq("id", jobId);
      }
    }

    const chunks = allChunks;
    trace.addSpan({
      name: "chunk_summary",
      startTime: Date.now(),
      endTime: Date.now(),
      output: { total_chunks: chunks.length },
    });

    // 4. Handle Embeddings (Reuse + Generation)
    const embedSpan = trace.startSpan("process_embeddings", {
      count: chunks.length,
    });
    const { reusedCount, generatedCount } = await processEmbeddingsWithReuse(
      supabase,
      pack_id,
      source_id,
      chunks,
      openAIApiKey,
    );
    embedSpan.end({ reusedCount, generatedCount });
    if (generatedCount > 0) trace.enable();

    // Upsert in batches
    for (let i = 0; i < chunks.length; i += 100) {
      const batch = chunks.slice(i, i + 100);
      await serviceClient.from("knowledge_chunks").upsert(batch, {
        onConflict: "pack_id,chunk_id",
      });
    }

    await serviceClient.from("pack_sources").update({
      last_synced_at: new Date().toISOString(),
    }).eq("id", source_id);
    await serviceClient.from("ingestion_jobs").update({
      status: "completed",
      processed_chunks: chunks.length,
      completed_at: new Date().toISOString(),
      metadata: {
        total_chunks: chunks.length,
        embeddings_reused_count: reusedCount,
        embeddings_generated_count: generatedCount,
        trace_id: trace.getTraceId(),
      },
    }).eq("id", jobId);

    await trace.flush();

    return json(
      200,
      { success: true, job_id: jobId, chunks: chunks.length },
      corsHeaders,
    );
  } catch (err: any) {
    if (err.response) return err.response;
    console.error("Jira ingestion error:", err);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
