import yaml from "https://esm.sh/js-yaml@4.1.0";
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

function summarizeSchema(schema: any, depth = 0): string {
  if (!schema || depth > 3) return "object";
  if (schema.$ref) return schema.$ref.split("/").pop() || "ref";
  if (schema.type === "array") {
    return `array of ${summarizeSchema(schema.items, depth + 1)}`;
  }
  if (schema.type === "object" && schema.properties) {
    const props = Object.entries(schema.properties).slice(0, 10).map((
      [k, v]: [string, any],
    ) => `${k}: ${v.type || summarizeSchema(v, depth + 1)}`);
    return `{ ${props.join(", ")} }`;
  }
  return schema.type || "any";
}

function parseSpec(raw: string): any {
  // Try YAML first — js-yaml also handles JSON since JSON is valid YAML
  try {
    return yaml.load(raw);
  } catch {}
  // Strict JSON fallback
  try {
    return JSON.parse(raw);
  } catch {}
  throw new Error("Could not parse spec. Please provide valid JSON or YAML.");
}

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

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

    const { spec_url, spec_content, label = "API" } = source_config;

    let specText = spec_content;
    if (spec_url && !specText) {
      // Validate spec_url (SSRF Protection)
      let validatedSpecUrl: string;
      try {
        validatedSpecUrl = parseAndValidateExternalUrl(spec_url, {
          allowedHostSuffixes: [
            "github.com",
            "githubusercontent.com",
            "swagger.io",
          ],
          disallowPrivateIPs: true,
          allowHttps: true,
        });
      } catch (err: any) {
        console.error(
          `[SSRF BLOCK] Invalid OpenAPI spec_url: ${spec_url}`,
          err.message,
        );
        return new Response(
          JSON.stringify({ error: `Invalid OpenAPI URL: ${err.message}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const resp = await fetch(validatedSpecUrl);
      if (!resp.ok) throw new Error(`Failed to fetch spec: ${resp.status}`);
      specText = await resp.text();
    }
    if (!specText) throw new Error("No spec provided");

    const spec = parseSpec(specText);
    const isSwagger = spec.swagger?.startsWith("2.");
    const title = spec.info?.title || label;
    const version = spec.info?.version || "";
    const basePath = isSwagger ? (spec.basePath || "") : "";

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

    // Group endpoints by tag
    const taggedEndpoints: Record<string, string[]> = {};
    const paths = spec.paths || {};

    for (const [path, methods] of Object.entries(paths)) {
      for (
        const [method, op] of Object.entries(methods as Record<string, any>)
      ) {
        if (
          ["get", "post", "put", "patch", "delete", "head", "options"].indexOf(
            method,
          ) === -1
        ) continue;
        const tags = op.tags || ["untagged"];
        const fullPath = basePath + path;

        let desc = `**${method.toUpperCase()} ${fullPath}**`;
        if (op.summary) desc += ` — ${op.summary}`;
        desc += "\n";
        if (op.description) desc += `${op.description}\n`;

        // Parameters
        const params = op.parameters || [];
        if (params.length) {
          desc += "\nParameters:\n";
          for (const p of params) {
            desc += `- ${p.name} (${p.in}, ${
              p.required ? "required" : "optional"
            }): ${p.description || p.schema?.type || "any"}\n`;
          }
        }

        // Request body (OpenAPI 3)
        if (op.requestBody) {
          const content = op.requestBody.content;
          const jsonSchema = content?.["application/json"]?.schema;
          if (jsonSchema) {
            desc += `\nRequest body: ${summarizeSchema(jsonSchema)}\n`;
          }
        }

        // Responses
        const responses = op.responses || {};
        const successResp = responses["200"] || responses["201"] ||
          responses["204"];
        if (successResp) {
          desc += `\nSuccess response: ${successResp.description || "OK"}`;
          const schema = successResp.content?.["application/json"]?.schema ||
            successResp.schema;
          if (schema) desc += ` — ${summarizeSchema(schema)}`;
          desc += "\n";
        }

        // Security
        if (op.security?.length) {
          const secNames = op.security.flatMap((s: any) => Object.keys(s));
          desc += `\nAuth: ${secNames.join(", ")}\n`;
        }

        for (const tag of tags) {
          if (!taggedEndpoints[tag]) taggedEndpoints[tag] = [];
          taggedEndpoints[tag].push(desc);
        }
      }
    }

    const chunks: any[] = [];
    let chunkIdx = 0;

    // API overview chunk
    chunkIdx++;
    let overview = `# ${title} v${version}\n\n`;
    if (spec.info?.description) overview += spec.info.description + "\n\n";
    overview += `Tags: ${Object.keys(taggedEndpoints).join(", ")}\n`;
    overview += `Total endpoints: ${
      Object.values(taggedEndpoints).flat().length
    }\n`;

    const overviewAssessment = assessChunkRedaction(overview);
    const overviewHash = await computeContentHash(
      overviewAssessment.contentToStore,
    );
    chunks.push({
      chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
      path: `openapi:${title}/overview`,
      start_line: 1,
      end_line: overviewAssessment.contentToStore.split("\n").length,
      content: overviewAssessment.contentToStore,
      content_hash: overviewHash,
      is_redacted: overviewAssessment.isRedacted,
      pack_id,
      source_id,
      metadata: {
        redaction: {
          action: overviewAssessment.action,
          secretsFound: overviewAssessment.metrics.secretsFound,
          matchedPatterns: overviewAssessment.metrics.matchedPatterns,
          redactionRatio: overviewAssessment.metrics.redactionRatio,
        },
      },
    });

    // Per-tag chunks
    for (const [tag, endpoints] of Object.entries(taggedEndpoints)) {
      chunkIdx++;
      // Check per-run cap
      if (chunkIdx > getRunCap()) {
        throw new Error(
          `Ingestion cap exceeded: maximum of ${getRunCap()} new chunks per run allowed.`,
        );
      }
      const tagContent = `# ${title} — ${tag}\n\n` + endpoints.join("\n\n");
      const assessment = assessChunkRedaction(tagContent);
      if (assessment.action === "exclude") continue;

      const hash = await computeContentHash(assessment.contentToStore);
      chunks.push({
        chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
        path: `openapi:${title}/${tag}`,
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

    await serviceClient.from("ingestion_jobs").update({
      total_chunks: chunks.length,
    }).eq("id", jobId);

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

    return json(200, {
      success: true,
      job_id: jobId,
      chunks: chunks.length,
      endpoints: Object.values(taggedEndpoints).flat().length,
    }, corsHeaders);
  } catch (err) {
    console.error("OpenAPI ingestion error:", err);
    return jsonError(
      500,
      "internal_error",
      (err as Error).message,
      {},
      corsHeaders,
    );
  }
});
