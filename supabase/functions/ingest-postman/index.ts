import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
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

// Local sha256 removed

// Local sha256 removed

function extractRequests(
  items: any[],
  folderPath: string = "",
): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  for (const item of items) {
    const currentPath = folderPath ? `${folderPath}/${item.name}` : item.name;
    if (item.item) {
      // It's a folder
      results.push(...extractRequests(item.item, currentPath));
    } else if (item.request) {
      const req = item.request;
      const method = typeof req.method === "string" ? req.method : "GET";
      const url = typeof req.url === "string" ? req.url : req.url?.raw || "";

      let content = `## ${method} ${item.name}\n\n`;
      content += `**URL**: ${url}\n`;
      if (req.description) content += `\n${req.description}\n`;

      // Headers (redact auth)
      if (req.header?.length) {
        const safeHeaders = req.header.filter((h: any) =>
          !["authorization", "x-api-key"].includes(h.key?.toLowerCase())
        );
        if (safeHeaders.length) {
          content += "\nHeaders:\n";
          for (const h of safeHeaders) content += `- ${h.key}: ${h.value}\n`;
        }
      }

      // Body
      if (req.body) {
        if (req.body.mode === "raw" && req.body.raw) {
          const bodyPreview = req.body.raw.length > 500
            ? req.body.raw.slice(0, 500) + "..."
            : req.body.raw;
          content += `\nBody (${
            req.body.options?.raw?.language || "raw"
          }):\n\`\`\`\n${bodyPreview}\n\`\`\`\n`;
        }
      }

      // Tests summary
      if (item.event) {
        const testEvents = item.event.filter((e: any) => e.listen === "test");
        if (testEvents.length) {
          content += "\nTests: assertions configured\n";
        }
      }

      results.push({ path: currentPath, content });
    }
  }
  return results;
}

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    const body = await readJson(req, corsHeaders);
    const { pack_id, source_id, source_config } = body;
    const {
      collection_json,
      collection_url,
      postman_api_key,
      label = "Postman",
    } = source_config || {};

    let collection: any;
    if (collection_json) {
      collection = typeof collection_json === "string"
        ? JSON.parse(collection_json)
        : collection_json;
    } else if (collection_url && postman_api_key) {
      // Validate collection_url (SSRF Protection)
      let validatedUrl: string;
      try {
        validatedUrl = parseAndValidateExternalUrl(collection_url, {
          allowedHosts: ["getpostman.com", "api.getpostman.com"],
          disallowPrivateIPs: true,
          allowHttps: true,
        });
      } catch (err: any) {
        console.error(
          `[SSRF BLOCK] Invalid Postman collection_url: ${collection_url}`,
          err.message,
        );
        return new Response(
          JSON.stringify({ error: `Invalid Postman URL: ${err.message}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const collId = validatedUrl.replace(/.*\//, "");
      const resp = await fetch(
        `https://api.getpostman.com/collections/${collId}`,
        {
          headers: { "X-API-Key": postman_api_key },
        },
      );
      if (!resp.ok) throw new Error(`Postman API error: ${resp.status}`);
      const data = await resp.json();
      collection = data.collection;
    } else {
      throw new Error("No collection data provided");
    }

    // Handle both v2.1 formats
    const info = collection.info || {};
    const collName = info.name || label;
    const items = collection.item || [];

    const serviceClient = createServiceClient();
    const supabase = serviceClient;

    // 1. Authenticate user
    const { userId } = await requireUser(req, corsHeaders);

    // 2. Authorize pack access (Author or higher)
    await requirePackRole(
      serviceClient,
      pack_id,
      userId,
      "author",
      corsHeaders,
    );

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";

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

    const requests = extractRequests(items);
    await serviceClient.from("ingestion_jobs").update({
      total_chunks: requests.length,
    }).eq("id", jobId);

    const chunks: any[] = [];
    let chunkIdx = 0;

    for (const r of requests) {
      chunkIdx++;
      // Check per-run cap
      if (chunkIdx > getRunCap()) {
        throw new Error(
          `Ingestion cap exceeded: maximum of ${getRunCap()} new chunks per run allowed.`,
        );
      }
      const assessment = assessChunkRedaction(r.content);
      if (assessment.action === "exclude") continue;

      const hash = await computeContentHash(assessment.contentToStore);
      chunks.push({
        chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
        path: `postman:${collName}/${r.path}`,
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

    for (let i = 0; i < chunks.length; i += 100) {
      await serviceClient.from("knowledge_chunks").upsert(
        chunks.slice(i, i + 100),
        { onConflict: "pack_id,chunk_id" },
      );
    }

    // 4. Handle Embeddings (Reuse + Generation)
    const { reusedCount, generatedCount } = await processEmbeddingsWithReuse(
      supabase,
      pack_id,
      source_id,
      chunks,
      openAIApiKey,
    );

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
  } catch (err) {
    console.error("Postman ingestion error:", err);
    return jsonError(
      500,
      "internal_error",
      (err as Error).message,
      {},
      corsHeaders,
    );
  }
});
