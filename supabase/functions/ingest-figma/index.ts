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

function extractTextNodes(node: any, depth = 0): string[] {
  const texts: string[] = [];
  if (node.type === "TEXT" && node.characters) {
    texts.push(node.characters);
  }
  if (node.children && depth < 10) {
    for (const child of node.children) {
      texts.push(...extractTextNodes(child, depth + 1));
    }
  }
  return texts;
}

function summarizeNode(node: any, depth = 0, maxDepth = 3): string {
  if (depth >= maxDepth) return "";
  let result = "  ".repeat(depth) + `- ${node.name} (${node.type})`;
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    if (node.description) result += `: ${node.description}`;
  }
  result += "\n";
  if (node.children && depth < maxDepth) {
    for (const child of node.children.slice(0, 20)) {
      result += summarizeNode(child, depth + 1, maxDepth);
    }
    if (node.children.length > 20) {
      result += "  ".repeat(depth + 1) +
        `... and ${node.children.length - 20} more\n`;
    }
  }
  return result;
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

    let {
      file_key,
      personal_access_token,
      include_components = true,
      include_comments = true,
      include_layer_structure = false,
    } = source_config;

    // 1. Fetch personal_access_token from Vault if missing
    if (!personal_access_token) {
      personal_access_token = await getSourceCredential(
        supabase,
        source_id,
        "api_token",
      );
    }

    if (!file_key || !personal_access_token) {
      return jsonError(
        400,
        "bad_request",
        "Missing Figma configuration",
        {},
        corsHeaders,
      );
    }

    const headers = { "X-Figma-Token": personal_access_token };

    // Fetch file
    const fileResp = await fetch(
      `https://api.figma.com/v1/files/${file_key}?depth=3`,
      { headers },
    );
    if (!fileResp.ok) {
      throw new Error(
        `Figma API error: ${fileResp.status} ${await fileResp.text()}`,
      );
    }
    const fileData = await fileResp.json();

    const fileName = fileData.name || file_key;
    const pages = fileData.document?.children || [];

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

    const chunks: any[] = [];
    let chunkIdx = 0;

    for (const page of pages) {
      const topFrames = page.children || [];

      for (const frame of topFrames) {
        chunkIdx++;
        // Check per-run cap
        if (chunkIdx > getRunCap()) {
          throw new Error(
            `Ingestion cap exceeded: maximum of ${getRunCap()} new chunks per run allowed.`,
          );
        }
        let content = `# ${fileName} — ${page.name} / ${frame.name}\n\n`;
        content += `**Type**: ${frame.type}\n`;

        // Extract text content
        const texts = extractTextNodes(frame);
        if (texts.length) {
          content += `\n## Text Content\n\n`;
          const uniqueTexts = [...new Set(texts)].slice(0, 50);
          for (const t of uniqueTexts) content += `- ${t}\n`;
        }

        // Layer structure
        if (include_layer_structure) {
          content += `\n## Layer Structure\n\n`;
          content += summarizeNode(frame, 0, 4);
        }

        // Component info
        if (
          include_components &&
          (frame.type === "COMPONENT" || frame.type === "COMPONENT_SET")
        ) {
          content += `\n## Component\n\n`;
          if (frame.description) {
            content += `Description: ${frame.description}\n`;
          }
          if (frame.componentPropertyDefinitions) {
            content += "Properties:\n";
            for (
              const [key, def] of Object.entries(
                frame.componentPropertyDefinitions as Record<string, any>,
              )
            ) {
              content +=
                `- ${key}: ${def.type} (default: ${def.defaultValue})\n`;
            }
          }
        }

        const assessment = assessChunkRedaction(content);
        const hash = await computeContentHash(assessment.contentToStore);
        chunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `figma:${fileName}/${page.name}/${frame.name}`,
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
    }

    // Comments
    if (include_comments) {
      const commentsResp = await fetch(
        `https://api.figma.com/v1/files/${file_key}/comments`,
        { headers },
      );
      if (commentsResp.ok) {
        const commentsData = await commentsResp.json();
        const comments = commentsData.comments || [];
        if (comments.length) {
          chunkIdx++;
          let content = `# ${fileName} — Design Comments\n\n`;
          for (const c of comments.slice(0, 50)) {
            content += `**${c.user?.handle || "Unknown"}**: ${c.message}\n`;
            if (c.resolved_at) content += `(Resolved)\n`;
            content += "\n";
          }
          const assessment = assessChunkRedaction(content);
          const hash = await computeContentHash(assessment.contentToStore);
          chunks.push({
            chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
            path: `figma:${fileName}/comments`,
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
      }
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

    return json(
      200,
      { success: true, job_id: jobId, chunks: chunks.length },
      corsHeaders,
    );
  } catch (err: any) {
    if (err.response) return err.response;
    console.error("Figma ingestion error:", err);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
