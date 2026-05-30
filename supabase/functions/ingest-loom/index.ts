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

// Local sha256 removed

// Local sha256 removed

function parseTimestamp(timeStr: string): number {
  // Parse SRT/VTT timestamps like "00:01:23,456" or "00:01:23.456"
  const match = timeStr.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) +
    parseInt(ms) / 1000;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${
      s.toString().padStart(2, "0")
    }`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

function parseSRT(content: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;

    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;

    const [startStr, endStr] = timeLine.split("-->");
    const start = parseTimestamp(startStr.trim());
    const end = parseTimestamp(endStr.trim());
    const text = lines.slice(lines.indexOf(timeLine) + 1).join(" ").trim();

    if (text) segments.push({ start, end, text });
  }

  return segments;
}

function parseVTT(content: string): TranscriptSegment[] {
  // Remove VTT header
  const cleanContent = content.replace(/^WEBVTT\n+/, "");
  return parseSRT(cleanContent);
}

function parsePlainText(content: string): TranscriptSegment[] {
  // Split plain text into ~30 second segments based on sentence count
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim());
  const segments: TranscriptSegment[] = [];
  let currentText = "";
  let segmentIndex = 0;
  const wordsPerSecond = 2.5; // Average speaking rate

  for (const sentence of sentences) {
    currentText += sentence.trim() + ". ";
    const words = currentText.split(/\s+/).length;
    const estimatedDuration = words / wordsPerSecond;

    if (
      estimatedDuration >= 30 || sentence === sentences[sentences.length - 1]
    ) {
      segments.push({
        start: segmentIndex * 30,
        end: (segmentIndex + 1) * 30,
        text: currentText.trim(),
      });
      currentText = "";
      segmentIndex++;
    }
  }

  return segments;
}

function chunkSegments(
  segments: TranscriptSegment[],
  chunkDuration = 150,
): TranscriptSegment[] {
  // Combine segments into ~2.5 minute chunks
  const chunks: TranscriptSegment[] = [];
  let currentChunk: TranscriptSegment | null = null;

  for (const seg of segments) {
    if (!currentChunk) {
      currentChunk = { ...seg };
    } else if (seg.end - currentChunk.start < chunkDuration) {
      currentChunk.end = seg.end;
      currentChunk.text += " " + seg.text;
    } else {
      chunks.push(currentChunk);
      currentChunk = { ...seg };
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
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

    const {
      api_key,
      workspace_id,
      video_title,
      video_url,
      transcript_content,
      transcript_format = "auto",
    } = source_config;

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
    )
      .insert({
        pack_id,
        source_id,
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select().single();
    if (jobErr) throw jobErr;
    const jobId = job.id;

    const chunks: any[] = [];
    let chunkIdx = 0;

    if (api_key) {
      // Loom API mode
      const headers = {
        Authorization: `Bearer ${api_key}`,
        "Content-Type": "application/json",
      };

      let videosData: any;
      try {
        const videosResp = await fetch("https://api.loom.com/v1/videos", {
          headers,
        });
        if (!videosResp.ok) {
          throw new Error(
            `Loom API returned ${videosResp.status}. The Loom public API has limited availability. ` +
              `Please use the "Upload Transcript" tab instead — paste your transcript text directly ` +
              `(supports SRT, VTT, or plain text format).`,
          );
        }
        videosData = await videosResp.json();
      } catch (apiErr: any) {
        if (apiErr.message.includes("Loom API returned")) throw apiErr;
        throw new Error(
          `Could not reach the Loom API. Please use the "Upload Transcript" tab and paste ` +
            `your transcript text directly instead.`,
        );
      }

      for (const video of videosData.videos || []) {
        // Fetch transcript
        let transcriptText = "";
        try {
          const transcriptResp = await fetch(
            `https://api.loom.com/v1/videos/${video.id}/transcript`,
            { headers },
          );
          if (transcriptResp.ok) {
            const transcriptData = await transcriptResp.json();
            transcriptText = transcriptData.transcript || "";
          }
        } catch { /* Use description as fallback */ }

        if (!transcriptText && video.description) {
          transcriptText = video.description;
        }

        if (!transcriptText) continue;

        // Parse and chunk the transcript
        const segments = parsePlainText(transcriptText);
        const videoChunks = chunkSegments(segments);

        for (let i = 0; i < videoChunks.length; i++) {
          const chunk = videoChunks[i];
          chunkIdx++;
          // Check per-run cap
          if (chunkIdx > getRunCap()) {
            throw new Error(
              `Ingestion cap exceeded: maximum of ${getRunCap()} new chunks per run allowed.`,
            );
          }

          let content = `# ${video.title || "Loom Video"}\n\n`;
          content += `**Segment ${i + 1}/${videoChunks.length}** (${
            formatDuration(chunk.start)
          } - ${formatDuration(chunk.end)})\n\n`;
          content += chunk.text + "\n";

          const assessment = assessChunkRedaction(content);
          if (assessment.action === "exclude") continue;

          const hash = await computeContentHash(assessment.contentToStore);
          chunks.push({
            chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
            path: `loom:${video.title || video.id}/${i + 1}`,
            start_line: 1,
            end_line: assessment.contentToStore.split("\n").length,
            content: assessment.contentToStore,
            content_hash: hash,
            is_redacted: assessment.isRedacted,
            pack_id,
            source_id,
            metadata: {
              video_id: video.id,
              video_title: video.title,
              duration_seconds: video.duration,
              segment_index: i,
              segment_start: chunk.start,
              segment_end: chunk.end,
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
    } else if (transcript_content) {
      // Manual transcript upload mode
      let segments: TranscriptSegment[];

      if (
        transcript_format === "srt" ||
        transcript_content.match(/^\d+\n\d{2}:\d{2}:\d{2}/)
      ) {
        segments = parseSRT(transcript_content);
      } else if (
        transcript_format === "vtt" || transcript_content.startsWith("WEBVTT")
      ) {
        segments = parseVTT(transcript_content);
      } else {
        segments = parsePlainText(transcript_content);
      }

      const videoChunks = chunkSegments(segments);
      const title = video_title || "Video Transcript";

      for (let i = 0; i < videoChunks.length; i++) {
        const chunk = videoChunks[i];
        chunkIdx++;
        // Check per-run cap
        if (chunkIdx > getRunCap()) {
          throw new Error(
            `Ingestion cap exceeded: maximum of ${getRunCap()} new chunks per run allowed.`,
          );
        }

        let content = `# ${title}\n\n`;
        if (video_url) content += `**Source**: ${video_url}\n\n`;
        content += `**Segment ${i + 1}/${videoChunks.length}** (${
          formatDuration(chunk.start)
        } - ${formatDuration(chunk.end)})\n\n`;
        content += chunk.text + "\n";

        const assessment = assessChunkRedaction(content);
        if (assessment.action === "exclude") continue;

        const hash = await computeContentHash(assessment.contentToStore);
        chunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `loom:${title}/${i + 1}`,
          start_line: 1,
          end_line: assessment.contentToStore.split("\n").length,
          content: assessment.contentToStore,
          content_hash: hash,
          is_redacted: assessment.isRedacted,
          pack_id,
          source_id,
          metadata: {
            video_title: title,
            video_url,
            segment_index: i,
            segment_start: chunk.start,
            segment_end: chunk.end,
            redaction: {
              action: assessment.action,
              secretsFound: assessment.metrics.secretsFound,
              matchedPatterns: assessment.metrics.matchedPatterns,
              redactionRatio: assessment.metrics.redactionRatio,
            },
          },
        });
      }
    } else {
      throw new Error("Either api_key or transcript_content is required");
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
  } catch (err) {
    console.error("Loom ingestion error:", err);
    return jsonError(
      500,
      "internal_error",
      (err as Error).message,
      {},
      corsHeaders,
    );
  }
});
