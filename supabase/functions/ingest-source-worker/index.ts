// @ts-nocheck
import { astChunk } from "../_shared/ast-chunker.ts";
import { getSourceCredential } from "../_shared/credentials.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { updateHeartbeat } from "../_shared/ingestion-guards.ts";
import { computeContentHash } from "../_shared/hash-utils.ts";
import { createTrace, shouldTrace } from "../_shared/telemetry.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { requireInternal } from "../_shared/authz.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";

const ALLOWED_ORIGINS = parseAllowedOrigins();

const BATCH_SIZE = 5; // Reduced for safety

const SETUP_PATTERNS: Record<string, RegExp[]> = {
  dependencies: [
    /^package\.json$/,
    /^requirements\.txt$/,
    /^Gemfile$/,
    /^go\.mod$/,
    /^Cargo\.toml$/,
    /^pom\.xml$/,
    /^build\.gradle$/,
  ],
  configuration: [
    /^\.env/,
    /^config\//,
    /\.config\.(js|ts|json|yaml|yml)$/,
    /settings\.(json|yaml|yml)$/,
  ],
  docker: [/^Dockerfile/, /^docker-compose/, /\.dockerfile$/i],
  ci_cd: [
    /^\.github\/workflows\//,
    /^\.gitlab-ci\.yml$/,
    /^Jenkinsfile$/,
    /^\.circleci\//,
    /^azure-pipelines\.yml$/,
  ],
  environment: [
    /^Makefile$/,
    /^scripts\//,
    /^bin\//,
    /^README/i,
    /^CONTRIBUTING/i,
    /^SETUP/i,
    /^INSTALL/i,
  ],
  infrastructure: [
    /^terraform\//,
    /^k8s\//,
    /^kubernetes\//,
    /^helm\//,
    /\.tf$/,
  ],
};

function getSetupMetadata(
  filepath: string,
): { is_setup_relevant: boolean; setup_category?: string } {
  const basename = filepath.split("/").pop() || "";
  for (const [category, patterns] of Object.entries(SETUP_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(filepath) || pattern.test(basename)) {
        return { is_setup_relevant: true, setup_category: category };
      }
    }
  }
  return { is_setup_relevant: false };
}

async function fetchGitHubFile(
  owner: string,
  repo: string,
  path: string,
  token?: string,
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3.raw",
  };
  if (token) headers.Authorization = `token ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers,
        signal: controller.signal,
      },
    );
    if (!res.ok) return "";
    return await res.text();
  } catch (err) {
    console.error(`[FETCH ERROR] ${path}:`, err);
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runBatch(
  serviceClient: any,
  jobId: string,
  functionUrl: string,
) {
  // 1. Fetch current state
  const { data: state, error: stateErr } = await serviceClient
    .from("ingestion_job_state")
    .select("*")
    .eq("job_id", jobId)
    .single();

  if (stateErr || !state) {
    console.error("[WORKER] Failed to fetch job state:", stateErr);
    return;
  }

  if (state.invocations_count >= state.max_invocations) {
    throw new Error("Max invocations reached - possible infinite loop");
  }

  // Update phase to processing
  const createdMs = state.created_at
    ? new Date(state.created_at).getTime()
    : Date.now();
  await serviceClient.from("ingestion_jobs").update({
    phase: "fetch_files",
    elapsed_ms: Date.now() - createdMs,
  }).eq("id", jobId);

  const files = state.files_json;
  const startIndex = state.cursor;
  const batchFiles = files.slice(startIndex, startIndex + BATCH_SIZE);
  const isLastBatch = startIndex + BATCH_SIZE >= files.length;

  const { data: job } = await serviceClient.from("ingestion_jobs").select(
    "source_id, pack_id",
  ).eq("id", jobId).single();
  const { data: source } = await serviceClient.from("pack_sources").select(
    "source_type, source_uri, source_config",
  ).eq("id", job.source_id).single();
  const { data: pack } = await serviceClient.from("packs").select("org_id").eq(
    "id",
    job.pack_id,
  ).single();

  const match = source.source_uri.match(/github\.com\/([^/]+)\/([^/]+)/);
  const [, owner, repo] = match;
  const repoName = repo.replace(/\.git$/, "");
  const githubToken =
    await getSourceCredential(serviceClient, job.source_id, "api_token") ||
    Deno.env.get("GITHUB_TOKEN");

  console.log(
    `[WORKER] Processing batch: files ${startIndex} to ${
      startIndex + batchFiles.length
    } of ${files.length} (Invocation ${state.invocations_count + 1})`,
  );

  let currentBatchChunks: any[] = [];
  const abortController = new AbortController();

  for (let i = 0; i < batchFiles.length; i++) {
    const filepath = batchFiles[i];
    const globalIdx = startIndex + i;

    await updateHeartbeat(serviceClient, jobId, {
      phase: "fetch_files",
      current_file: filepath,
      current_file_index: globalIdx,
    });

    const content = await fetchGitHubFile(
      owner,
      repoName,
      filepath,
      githubToken,
    );
    if (!content) continue;

    const chunks = await astChunk(content, filepath, abortController.signal);
    const setupMeta = getSetupMetadata(filepath);
    const sourceUrl =
      `https://github.com/${owner}/${repoName}/blob/main/${filepath}`;

    for (let j = 0; j < chunks.length; j++) {
      const chunk = chunks[j];
      const assessment = assessChunkRedaction(chunk.text);
      const hash = await computeContentHash(assessment.contentToStore);
      currentBatchChunks.push({
        pack_id: job.pack_id,
        source_id: job.source_id,
        org_id: pack.org_id,
        generation_id: jobId,
        chunk_id: `C${String(globalIdx + 1).padStart(5, "0")}_${j}`,
        path: `repo:${owner}/${repoName}/${filepath}`,
        start_line: chunk.metadata.line_start,
        end_line: chunk.metadata.line_end,
        content: assessment.contentToStore,
        content_hash: hash,
        is_redacted: assessment.isRedacted,
        entity_type: chunk.metadata.entity_type,
        entity_name: chunk.metadata.entity_name,
        signature: chunk.metadata.signature,
        imports: chunk.metadata.imports,
        exported_names: chunk.metadata.exported_names || [],
        metadata: {
          source_url: sourceUrl,
          ...setupMeta,
          ingestion_job_id: jobId,
          generation_id: jobId,
        },
      });
    }
  }

  if (currentBatchChunks.length > 0) {
    const { error: upsertError } = await serviceClient.from("knowledge_chunks")
      .upsert(currentBatchChunks);
    if (upsertError) throw upsertError;
  }

  // Update state for next step
  const nextCursor = startIndex + batchFiles.length;
  await serviceClient.from("ingestion_job_state").update({
    cursor: nextCursor,
    chunk_idx: state.chunk_idx + currentBatchChunks.length,
    invocations_count: state.invocations_count + 1,
    updated_at: new Date().toISOString(),
  }).eq("job_id", jobId);

  await serviceClient.from("ingestion_jobs").update({
    processed_chunks: nextCursor,
  }).eq("id", jobId);

  const internalSecret = Deno.env.get("ROCKETBOARD_INTERNAL_SECRET");
  if (!internalSecret) {
    console.warn(
      "[WORKER WARNING] Missing ROCKETBOARD_INTERNAL_SECRET, falling back to Service Role Bearer token for internal calls.",
    );
  }
  const internalHeaders = internalSecret
    ? {
      "Content-Type": "application/json",
      "X-Rocketboard-Internal": internalSecret,
    }
    : {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    };

  if (!isLastBatch) {
    // Schedule next batch
    fetch(functionUrl, {
      method: "POST",
      headers: internalHeaders,
      body: JSON.stringify({ jobId }),
    }).catch((e) => console.error("[WORKER] Self-scheduling failed:", e));
  } else {
    // Phase 2: Build Symbol Graph
    console.log(
      `[WORKER] Ingestion complete for job ${jobId}. Triggering symbol graph builder.`,
    );
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const symbolGraphUrl = `${supabaseUrl}/functions/v1/build-symbol-graph`;

    fetch(symbolGraphUrl, {
      method: "POST",
      headers: internalHeaders,
      body: JSON.stringify({ jobId }),
    }).catch((e) =>
      console.error("[WORKER] Failed to trigger symbol graph builder:", e)
    );
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req, ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);

  const authz = requireInternal(req, corsHeaders);
  if (!authz.success) return authz.response;

  try {
    const { jobId, job_id } = await readJson(req, corsHeaders); // Accept both formats for compatibility
    const effectiveJobId = jobId || job_id;
    const serviceClient = createServiceClient();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const functionUrl = `${supabaseUrl}/functions/v1/ingest-source-worker`;

    const task = runBatch(serviceClient, effectiveJobId, functionUrl);

    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(task);
    else task.catch((e) => console.error("[WORKER] Task failed:", e));

    return json(202, { success: true }, corsHeaders);
  } catch (err: any) {
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
