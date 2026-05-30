import { astChunk } from "../_shared/ast-chunker.ts";
import { getSourceCredential } from "../_shared/credentials.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
import { computeContentHash } from "../_shared/hash-utils.ts";
import { generateEmbedding, getPreviousGenerationEmbeddings } from "../_shared/embedding-reuse.ts";
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

// Embedding generation is centralized in _shared/embedding-reuse.ts (configurable provider/model/dim).

async function fetchGitHubTree(
  owner: string,
  repo: string,
  token?: string,
): Promise<string[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) headers.Authorization = `token ${token}`;
  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers },
  );
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
  const data = await resp.json();
  const SUPPORTED_EXT = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".md",
    ".json",
    ".yaml",
    ".yml",
  ];
  return (data.tree || [])
    .filter((item: any) =>
      item.type === "blob" &&
      SUPPORTED_EXT.some((ext) => item.path.endsWith(ext))
    )
    .map((item: any) => item.path);
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
  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { headers },
  );
  if (!resp.ok) return "";
  return await resp.text();
}

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  let lockToken: string | null = null;
  let pack_id: string | undefined;
  let generation_id: string = crypto.randomUUID();
  let trace: any;

  try {
    const body = await readJson(req, corsHeaders);
    const { org_id } = body;
    pack_id = body.pack_id;

    if (!org_id || !pack_id) {
      return jsonError(
        400,
        "bad_request",
        "Missing org_id or pack_id",
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
      serviceName: "reindex-orgs",
      taskType: "ingestion",
      requestId: crypto.randomUUID(),
      packId: pack_id,
      orgId: org_id,
      environment: Deno.env.get("ENVIRONMENT") || "production",
    }, { enabled: shouldTrace() });

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";
    const githubToken = Deno.env.get("GITHUB_TOKEN");

    // 1. Acquire Lock (P0: Prevent Concurrent Racing)
    const { data: lockData, error: lockErr } = await serviceClient
      .rpc("acquire_pack_lock", {
        p_pack_id: pack_id,
        p_lock_name: "reindex",
        p_ttl_seconds: 3600,
      });

    if (lockErr || !lockData) {
      console.warn(`[LOCK REJECT] Job already in progress for pack ${pack_id}`);
      return json(409, {
        error:
          "Reindex already in progress for this pack. Please wait or try again later.",
      }, corsHeaders);
    }

    lockToken = lockData;

    // 2. Initialize Progress
    await serviceClient.from("reindex_progress").upsert({
      org_id,
      pack_id,
      status: "processing",
      started_at: new Date().toISOString(),
      metadata: {
        embeddings_reused: 0,
        embeddings_generated: 0,
        total_chunks: 0,
        indexable_chunks: 0,
      },
    });

    // 3. Get all sources for the pack
    const { data: sources, error: sErr } = await serviceClient.from(
      "pack_sources",
    ).select("*").eq("pack_id", pack_id);
    if (sErr) throw sErr;

    let totalFiles = 0;
    let processedFiles = 0;

    for (const source of sources) {
      if (source.source_type !== "github_repo") continue; // Simple MVP support

      // SSRF Protection
      let validatedUri: string;
      try {
        validatedUri = parseAndValidateExternalUrl(source.source_uri, {
          allowedHosts: ["github.com"],
          disallowPrivateIPs: true,
          allowHttps: true,
        });
      } catch (err: any) {
        console.error(
          `[SSRF BLOCK] Invalid source_uri for pack ${pack_id}: ${source.source_uri}`,
          err.message,
        );
        continue;
      }

      const match = validatedUri.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) continue;
      const [, owner, repo] = match;
      const repoName = repo.replace(/\.git$/, "");

      const treeSpan = trace.startSpan("fetch_tree", { owner, repo: repoName });
      const files = await fetchGitHubTree(owner, repoName, githubToken);
      treeSpan.end({ count: files.length });
      totalFiles += files.length;

      for (const filepath of files) {
        const fileSpan = trace.startSpan("process_file", { path: filepath });
        console.log(`[Reindex] Processing ${filepath}...`);
        const content = await fetchGitHubFile(
          owner,
          repoName,
          filepath,
          githubToken,
        );
        if (!content) {
          fileSpan.end({ status: "skipped_empty" });
          continue;
        }

        const chunks = await astChunk(content, filepath);
        const chunkBatch = [];

        const hashes = await Promise.all(
          chunks.map((c) =>
            computeContentHash(assessChunkRedaction(c.text).contentToStore)
          ),
        );
        const existingEmbeddings = await getPreviousGenerationEmbeddings(
          serviceClient,
          pack_id,
          hashes,
        );

        let fileReused = 0;
        let fileGenerated = 0;

        for (let i = 0; i < chunks.length; i++) {
          const c = chunks[i];
          const hash = hashes[i];
          const assessment = assessChunkRedaction(c.text);
          if (assessment.action === "exclude") continue;

          let embedding = existingEmbeddings.get(hash);
          if (embedding) {
            fileReused++;
          } else {
            embedding = await generateEmbedding(
              assessment.contentToStore,
              openAIApiKey,
            ) || undefined;
            if (embedding) fileGenerated++;
          }

          chunkBatch.push({
            org_id,
            pack_id,
            source_id: source.id,
            chunk_id: `G-${
              generation_id.slice(0, 8)
            }-${processedFiles}-${chunkBatch.length}`,
            path: filepath,
            content: assessment.contentToStore,
            content_hash: hash,
            entity_type: c.metadata.entity_type,
            entity_name: c.metadata.entity_name,
            signature: c.metadata.signature,
            line_start: c.metadata.line_start,
            line_end: c.metadata.line_end,
            generation_id,
            embedding,
            is_redacted: assessment.isRedacted,
            imports: c.metadata.imports || [],
            exported_names: c.metadata.exported_names || [],
            metadata: {
              ...c.metadata,
              redaction: {
                action: assessment.action,
                secretsFound: assessment.metrics.secretsFound,
                matchedPatterns: assessment.metrics.matchedPatterns,
                redactionRatio: assessment.metrics.redactionRatio,
              },
            },
          });
        }
        fileSpan.end({
          reusedCount: fileReused,
          generatedCount: fileGenerated,
          totalChunks: chunks.length,
        });
        if (fileGenerated > 0) trace.enable();

        // Update global metrics in metadata
        const { data: currentProgress } = await serviceClient.from(
          "reindex_progress",
        ).select("metadata").eq("pack_id", pack_id).single();
        const meta = (currentProgress?.metadata as any) || {};
        await serviceClient.from("reindex_progress").update({
          metadata: {
            ...meta,
            embeddings_reused: (meta.embeddings_reused || 0) + fileReused,
            embeddings_generated: (meta.embeddings_generated || 0) +
              fileGenerated,
            total_chunks: (meta.total_chunks || 0) + chunks.length,
            indexable_chunks: (meta.indexable_chunks || 0) + chunkBatch.length,
          },
        }).eq("pack_id", pack_id);

        if (chunkBatch.length > 0) {
          const { error: insErr } = await serviceClient.from("knowledge_chunks")
            .insert(chunkBatch);
          if (insErr) console.error("[Reindex] Insert error:", insErr);
        }

        processedFiles++;
        await serviceClient.from("reindex_progress").update({
          chunks_processed: processedFiles,
          chunks_total: totalFiles,
        }).eq("pack_id", pack_id).eq("org_id", org_id);
      }
    }

    // 4. Atomic Swap
    const { error: ledgerErr } = await serviceClient.from(
      "pack_active_generation",
    ).upsert({
      org_id,
      pack_id,
      active_generation_id: generation_id,
      updated_at: new Date().toISOString(),
    });
    if (ledgerErr) throw ledgerErr;

    // 5. Cleanup old chunks
    await serviceClient.from("knowledge_chunks")
      .delete()
      .eq("pack_id", pack_id)
      .neq("generation_id", generation_id);

    const { data: finalProgress } = await serviceClient.from("reindex_progress")
      .select("metadata").eq("pack_id", pack_id).single();
    const finalMeta = (finalProgress?.metadata as any) || {};

    await serviceClient.from("reindex_progress").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      metadata: {
        ...finalMeta,
        trace_id: trace.getTraceId(),
      },
    }).eq("pack_id", pack_id).eq("org_id", org_id);

    await trace.flush();

    return json(200, { success: true, generation_id }, corsHeaders);
  } catch (err: any) {
    if (err.response) return err.response;
    console.error("[Reindex] Fatal:", err);
    if (typeof trace !== "undefined") {
      trace.setError(err.message).enable();
      await trace.flush();
    }

    try {
      if (pack_id) {
        const serviceClient = createServiceClient();
        // Mark progress as failed
        await serviceClient.from("reindex_progress").update({
          status: "failed",
          error_message: (err.message ?? "Unknown internal error").slice(
            0,
            500,
          ),
          completed_at: new Date().toISOString(),
        }).eq("pack_id", pack_id);

        // CLEANUP: Delete partial chunks for this failed generation
        console.log(
          `[CLEANUP] Deleting partial chunks for failed generation ${generation_id}`,
        );
        await serviceClient.from("knowledge_chunks")
          .delete()
          .eq("pack_id", pack_id)
          .eq("generation_id", generation_id);
      }
    } catch (innerErr) {
      console.error("[Reindex] Secondary failure in catch block:", innerErr);
    }

    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  } finally {
    if (lockToken && pack_id) {
      try {
        const serviceClient = createServiceClient();
        await serviceClient.rpc("release_pack_lock", {
          p_pack_id: pack_id,
          p_lock_name: "reindex",
          p_lock_token: lockToken,
        });
      } catch (releaseErr) {
        console.error("[LOCK RELEASE FAILED]", releaseErr);
      }
    }
  }
});
