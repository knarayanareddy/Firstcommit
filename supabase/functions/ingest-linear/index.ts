import { getSourceCredential } from "../_shared/credentials.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import {
  checkPackChunkCap,
  getRunCap,
  validateIngestion,
} from "../_shared/ingestion-guards.ts";
import { computeContentHash } from "../_shared/hash-utils.ts";
import { processEmbeddingsWithReuse } from "../_shared/embedding-reuse.ts";
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

async function linearGQL(
  apiKey: string,
  query: string,
  variables: Record<string, any> = {},
) {
  const resp = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) throw new Error(`Linear API error: ${resp.status}`);
  const data = await resp.json();
  if (data.errors) {
    throw new Error(data.errors[0]?.message || "Linear GraphQL error");
  }
  return data.data;
}

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);
  const supabase = createServiceClient();

  try {
    const body = await readJson(req, corsHeaders);
    const { pack_id, source_id, source_config } = body;

    if (!pack_id || !source_id || !source_config) {
      return jsonError(
        400,
        "bad_request",
        "Missing required fields (pack_id, source_id, source_config)",
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

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";

    let { api_key, team_id } = source_config;

    // 1. Fetch api_key from Vault if missing
    if (!api_key) {
      api_key = await getSourceCredential(supabase, source_id, "api_key");
    }

    if (!api_key || !team_id) {
      return jsonError(
        400,
        "bad_request",
        "Missing Linear configuration (api_key, team_id)",
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
    ).insert({
      pack_id,
      source_id,
      status: "processing",
      started_at: new Date().toISOString(),
    }).select().single();
    if (jobErr) throw jobErr;
    const jobId = job.id;

    const MAX_ISSUES = 2000;
    const ISSUES_PER_PAGE = 50;

    // First fetch: team info + projects + first page of issues
    const firstPageData = await linearGQL(
      api_key,
      `
      query($teamId: String!, $first: Int!) {
        team(id: $teamId) {
          name
          projects { nodes { name description state } }
          issues(first: $first, orderBy: createdAt) {
            nodes {
              identifier title description
              state { name }
              priority priorityLabel
              labels { nodes { name } }
              project { name }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `,
      { teamId: team_id, first: ISSUES_PER_PAGE },
    );

    const team = firstPageData.team;
    if (!team) throw new Error("Team not found");

    const projects = team.projects?.nodes || [];
    let issues = team.issues?.nodes || [];
    let pageInfo = team.issues?.pageInfo;

    // Paginate through remaining issues
    while (pageInfo?.hasNextPage && issues.length < MAX_ISSUES) {
      const remainingQuota = MAX_ISSUES - issues.length;
      const nextPageData = await linearGQL(
        api_key,
        `
        query($teamId: String!, $first: Int!, $after: String!) {
          team(id: $teamId) {
            issues(first: $first, orderBy: createdAt, after: $after) {
              nodes {
                identifier title description
                state { name }
                priority priorityLabel
                labels { nodes { name } }
                project { name }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      `,
        {
          teamId: team_id,
          first: Math.min(ISSUES_PER_PAGE, remainingQuota),
          after: pageInfo.endCursor,
        },
      );

      const nextIssues = nextPageData.team?.issues?.nodes || [];
      issues = [...issues, ...nextIssues];
      pageInfo = nextPageData.team?.issues?.pageInfo;
      // Rate limit: Linear API allows 1500 complexity points/min
      await new Promise((r) => setTimeout(r, 300));
    }

    await serviceClient.from("ingestion_jobs").update({
      total_chunks: issues.length + projects.length,
    }).eq("id", jobId);

    const chunks: any[] = [];
    let chunkIdx = 0;

    // Projects as chunks
    for (const proj of projects) {
      chunkIdx++;
      let content = `# Project: ${proj.name}\n\n`;
      content += `**State**: ${proj.state || "Unknown"}\n\n`;
      if (proj.description) content += proj.description + "\n";
      const assessment = assessChunkRedaction(content);
      const hash = await computeContentHash(assessment.contentToStore);
      chunks.push({
        chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
        path: `linear:${team.name}/${proj.name}`,
        start_line: 1,
        end_line: assessment.contentToStore.split("\n").length,
        content: assessment.contentToStore,
        content_hash: hash,
        is_redacted: assessment.isRedacted,
        pack_id,
        source_id,
        metadata: {
          redaction: {
            action: assessment.action,
            secretsFound: assessment.metrics.secretsFound,
            matchedPatterns: assessment.metrics.matchedPatterns,
            redactionRatio: assessment.metrics.redactionRatio,
          },
        },
      });
    }

    // Issues as chunks
    for (const issue of issues) {
      chunkIdx++;
      // Check per-run cap
      if (chunkIdx > getRunCap()) {
        throw new Error(
          `Ingestion cap exceeded: maximum of ${getRunCap()} new chunks per run allowed.`,
        );
      }
      let content = `# ${issue.identifier}: ${issue.title}\n\n`;
      content += `**Status**: ${issue.state?.name || "Unknown"}\n`;
      content += `**Priority**: ${issue.priorityLabel || "None"}\n`;
      if (issue.labels?.nodes?.length) {
        content += `**Labels**: ${
          issue.labels.nodes.map((l: any) => l.name).join(", ")
        }\n`;
      }
      if (issue.project?.name) {
        content += `**Project**: ${issue.project.name}\n`;
      }
      content += "\n";
      if (issue.description) content += issue.description + "\n";

      const assessment = assessChunkRedaction(content);
      const hash = await computeContentHash(assessment.contentToStore);
      chunks.push({
        chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
        path: `linear:${team.name}/${
          issue.project?.name || "_"
        }/${issue.identifier}`,
        start_line: 1,
        end_line: assessment.contentToStore.split("\n").length,
        content: assessment.contentToStore,
        content_hash: hash,
        is_redacted: assessment.isRedacted,
        pack_id,
        source_id,
        metadata: {
          redaction: {
            action: assessment.action,
            secretsFound: assessment.metrics.secretsFound,
            matchedPatterns: assessment.metrics.matchedPatterns,
            redactionRatio: assessment.metrics.redactionRatio,
          },
        },
      });
    }

    // 4. Handle Embeddings (Reuse + Generation)
    const { reusedCount, generatedCount } = await processEmbeddingsWithReuse(
      supabase,
      pack_id,
      source_id,
      chunks,
      openAIApiKey,
    );

    for (let i = 0; i < chunks.length; i += 100) {
      await serviceClient.from("knowledge_chunks").upsert(
        chunks.slice(i, i + 100),
        { onConflict: "pack_id,chunk_id" },
      );
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
      },
    }).eq("id", jobId);

    return json(
      200,
      { success: true, job_id: jobId, chunks: chunks.length },
      corsHeaders,
    );
  } catch (err: any) {
    if (err.response) return err.response;
    console.error("Linear ingestion error:", err);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
