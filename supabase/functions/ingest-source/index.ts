// @ts-nocheck
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
import { updateHeartbeat } from "../_shared/ingestion-guards.ts";
import { createTrace, shouldTrace } from "../_shared/telemetry.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { requireUser } from "../_shared/authz.ts";
import { requirePackRole } from "../_shared/pack-access.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { computeContentHash } from "../_shared/hash-utils.ts";
import { getSourceCredential } from "../_shared/credentials.ts";

const ALLOWED_ORIGINS = parseAllowedOrigins();

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".md",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".rb",
  ".sh",
  ".bash",
  ".css",
  ".scss",
  ".html",
  ".sql",
  ".graphql",
  ".gql",
  ".tf",
]);

const SUPPORTED_FILENAMES = new Set([
  "Dockerfile",
  "Makefile",
  ".env.example",
  ".env.sample",
  "docker-compose.yml",
  "docker-compose.yaml",
  "Jenkinsfile",
  "README.md",
  "README",
  "CONTRIBUTING.md",
  "SETUP.md",
]);

function isSupported(filepath: string): boolean {
  const basename = filepath.split("/").pop() || "";
  if (SUPPORTED_FILENAMES.has(basename)) return true;
  if (
    basename.startsWith("README") || basename.startsWith("CONTRIBUTING") ||
    basename.startsWith("SETUP")
  ) return true;
  const ext = "." + basename.split(".").pop();
  return SUPPORTED_EXTENSIONS.has(ext);
}

function getErrorMessage(err: any): string {
  const msg = err?.message
    ? String(err.message)
    : JSON.stringify(err) || String(err);
  return msg.slice(0, 500);
}

function chunkWords(
  text: string,
  wordCount = 500,
): { start: number; end: number; text: string }[] {
  const words = text.split(/\s+/);
  const chunks: { start: number; end: number; text: string }[] = [];
  let i = 0;
  let lineEstimate = 1;
  while (i < words.length) {
    const end = Math.min(i + wordCount, words.length);
    const chunk = words.slice(i, end).join(" ");
    const lines = chunk.split("\n").length;
    chunks.push({
      start: lineEstimate,
      end: lineEstimate + lines - 1,
      text: chunk,
    });
    lineEstimate += lines;
    i = end;
  }
  return chunks;
}

async function fetchGitHubTree(
  owner: string,
  repo: string,
  token?: string,
): Promise<string[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) headers.Authorization = `token ${token}`;
  const url =
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    if (resp.status === 403) throw new Error("GitHub Rate Limit");
    throw new Error(`GitHub Error: ${resp.status}`);
  }
  const data = await resp.json();
  return (data.tree || []).filter((item: any) =>
    item.type === "blob" && isSupported(item.path)
  ).map((item: any) => item.path);
}

// Local getSourceCredential removed — use _shared/credentials.ts (Vault-backed RPC)

async function initializeIngestion(
  serviceClient: any,
  jobId: string,
  pack_id: string,
  source_id: string,
  source_type: string,
  source_uri: string | undefined,
  document_content: string | undefined,
  label: string | undefined,
  org_id: string | undefined,
  functionUrl: string,
) {
  try {
    if (source_type === "github_repo") {
      const validatedUri = parseAndValidateExternalUrl(source_uri!, {
        allowedHosts: ["github.com"],
        disallowPrivateIPs: true,
        allowHttps: true,
      });
      const match = validatedUri.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error("Invalid GitHub repo URL");
      const [, owner, repo] = match;
      const repoName = repo.replace(/\.git$/, "");

      const githubToken =
        await getSourceCredential(serviceClient, source_id, "api_token") ||
        Deno.env.get("GITHUB_TOKEN") || null;

      await updateHeartbeat(serviceClient, jobId, { phase: "fetch_tree" });
      const files = await fetchGitHubTree(owner, repoName, githubToken);

      await serviceClient.from("ingestion_jobs").update({
        total_chunks: files.length,
      }).eq("id", jobId);

      // Store state for worker
      const { error: stateErr } = await serviceClient.from(
        "ingestion_job_state",
      ).insert({
        job_id: jobId,
        pack_id,
        source_id,
        files_json: files,
        cursor: 0,
        chunk_idx: 0,
      });
      if (stateErr) throw stateErr;

      // Trigger worker
      const workerUrl = `${Deno.env.get(
        "SUPABASE_URL",
      )!}/functions/v1/ingest-source-worker`;

      const internalSecret = Deno.env.get("ROCKETBOARD_INTERNAL_SECRET");
      if (!internalSecret) {
        console.warn(
          "[CONTROLLER WARNING] Missing ROCKETBOARD_INTERNAL_SECRET, falling back to Service Role Bearer token for internal calls.",
        );
      }
      const internalHeaders = internalSecret
        ? {
          "Content-Type": "application/json",
          "X-Rocketboard-Internal": internalSecret,
        }
        : {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
          }`,
        };

      console.log(
        `[CONTROLLER] Initialized state for job ${jobId}. Triggering worker...`,
      );
      const resp = await fetch(workerUrl, {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({ jobId }),
      });
      if (!resp.ok) throw new Error(`Failed to trigger worker: ${resp.status}`);
    } else if (source_type === "document") {
      await updateHeartbeat(serviceClient, jobId, { phase: "chunking" });
      const chunks = chunkWords(document_content || "");
      const docChunks = await Promise.all(chunks.map(async (c, i) => {
        const assessment = assessChunkRedaction(c.text);
        const hash = await computeContentHash(assessment.contentToStore);
        return {
          pack_id,
          source_id,
          org_id,
          generation_id: jobId,
          chunk_id: `C${String(i + 1).padStart(5, "0")}`,
          path: `doc:${label || "untitled"}`,
          start_line: c.start,
          end_line: c.end,
          content: assessment.contentToStore,
          content_hash: hash,
          is_redacted: assessment.isRedacted,
          metadata: { ingestion_job_id: jobId, generation_id: jobId },
        };
      }));
      const { error: upsertErr } = await serviceClient.from("knowledge_chunks")
        .upsert(docChunks);
      if (upsertErr) throw upsertErr;

      // Trigger symbol graph worker for consistency
      const symbolGraphUrl = `${Deno.env.get(
        "SUPABASE_URL",
      )!}/functions/v1/build-symbol-graph`;

      // Initialize an empty state row so symbol worker can find it (though it won't use files_json)
      await serviceClient.from("ingestion_job_state").insert({
        job_id: jobId,
        pack_id,
        source_id,
        files_json: [],
        cursor: 0,
        chunk_idx: docChunks.length,
      });

      const internalSecret = Deno.env.get("ROCKETBOARD_INTERNAL_SECRET");
      if (!internalSecret) {
        console.warn(
          "[CONTROLLER WARNING] Missing ROCKETBOARD_INTERNAL_SECRET, falling back to Service Role Bearer token for internal calls.",
        );
      }
      const internalHeaders = internalSecret
        ? {
          "Content-Type": "application/json",
          "X-Rocketboard-Internal": internalSecret,
        }
        : {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
          }`,
        };

      const resp = await fetch(symbolGraphUrl, {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({ jobId }),
      });
      if (!resp.ok) {
        throw new Error(`Failed to trigger symbol graph: ${resp.status}`);
      }
    }
  } catch (err: any) {
    console.error("[CONTROLLER] Initialization failed:", err);
    await serviceClient.from("ingestion_jobs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: getErrorMessage(err),
    }).eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req, ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);

  try {
    const body = await readJson(req, corsHeaders);
    const {
      pack_id,
      source_id,
      source_type,
      source_uri,
      document_content,
      label,
      source_config,
    } = body;

    const { userId } = await requireUser(req, corsHeaders);
    const serviceClient = createServiceClient();
    await requirePackRole(
      serviceClient,
      pack_id,
      userId,
      "author",
      corsHeaders,
    );

    const { data: packRow } = await serviceClient.from("packs").select("org_id")
      .eq("id", pack_id).single();
    const effectiveOrgId = packRow?.org_id;

    const { data: job, error: jobErr } = await serviceClient.from(
      "ingestion_jobs",
    ).insert({
      pack_id,
      source_id,
      status: "processing",
      started_at: new Date().toISOString(),
    }).select("id").single();
    if (jobErr) throw jobErr;
    const jobId = job.id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const functionUrl = `${supabaseUrl}/functions/v1/ingest-source`;

    const trace = createTrace({
      serviceName: "ingest-source",
      taskType: "ingestion",
      requestId: crypto.randomUUID(),
      packId: pack_id,
      sourceId: source_id,
      orgId: effectiveOrgId,
      environment: Deno.env.get("ENVIRONMENT") || "production",
    }, { enabled: shouldTrace() });
    trace.updateMetadata({ jobId });

    const task = initializeIngestion(
      serviceClient,
      jobId,
      pack_id,
      source_id,
      source_type,
      source_uri,
      document_content,
      label,
      effectiveOrgId,
      functionUrl,
    );

    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(task);
    else task.catch((e) => console.error("[CONTROLLER] Task failed:", e));

    return json(202, { success: true, job_id: jobId }, corsHeaders);
  } catch (err: any) {
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
