import { getSourceCredential } from "../_shared/credentials.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import {
  checkPackChunkCap,
  validateIngestion,
} from "../_shared/ingestion-guards.ts";
import {
  computeContentHash,
  computeDeterministicChunkId,
} from "../_shared/hash-utils.ts";
import { processEmbeddingsWithReuse } from "../_shared/embedding-reuse.ts";
import { normalizeSlackThreadToMarkdown } from "../_shared/content-normalizers.ts";
import { fallbackChunkWords } from "../_shared/smart-chunker.ts";
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

async function slackAPI(
  token: string,
  method: string,
  params: Record<string, any> = {},
) {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
  return data;
}

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
      serviceName: "ingest-slack",
      taskType: "ingestion",
      requestId: crypto.randomUUID(),
      packId: pack_id,
      sourceId: source_id,
      orgId: org_id,
      environment: Deno.env.get("ENVIRONMENT") || "production",
    }, { enabled: shouldTrace() });

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";
    let {
      bot_token,
      channel_ids = [],
      days_back = 30,
      threaded_only = false,
      pinned_only = false,
      min_reactions = 0,
    } = source_config || {};

    // 1. Fetch bot_token from Vault if missing
    if (!bot_token) {
      bot_token = await getSourceCredential(supabase, source_id, "bot_token");
    }

    if (!bot_token || channel_ids.length === 0) {
      return jsonError(
        400,
        "bad_request",
        "Missing bot_token or channel_ids",
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

    // Build user cache for display names
    const userCache: Record<string, string> = {};
    try {
      const usersResp = await slackAPI(bot_token, "users.list", { limit: 200 });
      for (const user of usersResp.members || []) {
        userCache[user.id] = user.profile?.display_name || user.real_name ||
          user.name || "Unknown";
      }
    } catch { /* ignore - will use IDs */ }

    // Get channel info
    const channelInfoCache: Record<string, any> = {};
    for (const channelId of channel_ids) {
      try {
        const info = await slackAPI(bot_token, "conversations.info", {
          channel: channelId,
        });
        channelInfoCache[channelId] = info.channel;
      } catch {
        channelInfoCache[channelId] = { id: channelId, name: channelId };
      }
    }

    const allChunks: any[] = [];
    let chunkIdx = 0;
    const oldest = Math.floor(
      (Date.now() - days_back * 24 * 60 * 60 * 1000) / 1000,
    );

    for (const channelId of channel_ids) {
      const channelInfo = channelInfoCache[channelId];

      // Get pinned messages if requested
      let pinnedTs = new Set<string>();
      if (pinned_only) {
        try {
          const pins = await slackAPI(bot_token, "pins.list", {
            channel: channelId,
          });
          for (const item of pins.items || []) {
            if (item.message?.ts) pinnedTs.add(item.message.ts);
          }
        } catch { /* ignore */ }
      }

      // Fetch message history
      let messages: any[] = [];
      let cursor: string | undefined;
      let fetchCount = 0;
      const maxFetches = 10; // Max 1000 messages per channel

      const historySpan = trace.startSpan("fetch_history", {
        channel_id: channelId,
      });
      while (fetchCount < maxFetches) {
        const historyResp = await slackAPI(bot_token, "conversations.history", {
          channel: channelId,
          oldest,
          limit: 100,
          cursor,
        });
        messages.push(...(historyResp.messages || []));
        cursor = historyResp.response_metadata?.next_cursor;
        if (!cursor) break;
        fetchCount++;
      }
      historySpan.end({ count: messages.length });

      // Filter messages based on criteria
      const filteredMessages = messages.filter((msg) => {
        if (msg.subtype === "channel_join" || msg.subtype === "channel_leave") {
          return false;
        }
        if (pinned_only && !pinnedTs.has(msg.ts)) return false;
        if (threaded_only && !msg.reply_count) return false;
        if (
          min_reactions > 0 &&
          (!msg.reactions || msg.reactions.length < min_reactions)
        ) return false;
        return true; // All messages that pass basic filters are considered for normalization
      });

      // Process each valuable message (with threads if applicable)
      for (const mainMsg of filteredMessages) {
        let thread: any[] = [];
        if (mainMsg.reply_count && mainMsg.reply_count > 0) {
          // Fetch thread
          const threadSpan = trace.startSpan("fetch_thread", {
            channel_id: channelId,
            ts: mainMsg.ts,
          });
          try {
            const threadResp = await slackAPI(
              bot_token,
              "conversations.replies",
              {
                channel: channelId,
                ts: mainMsg.ts,
                limit: 50,
              },
            );
            thread = threadResp.messages || [];
          } catch (e: any) {
            console.warn(
              `Failed to fetch thread for ${mainMsg.ts} in ${channelId}: ${e.message}`,
            );
            thread = [mainMsg]; // Fallback to just the main message if thread fetch fails
          } finally {
            threadSpan.end({ count: thread.length });
          }
        } else {
          thread = [mainMsg];
        }

        const channelName = channelInfo.name || "unknown-channel";
        const date = new Date(parseFloat(mainMsg.ts) * 1000)
          .toLocaleDateString();
        const markdown = normalizeSlackThreadToMarkdown(
          channelName,
          date,
          thread,
          userCache,
        );

        const pagePath = `slack:${channelId}/${mainMsg.ts}`;
        const wordChunks = fallbackChunkWords(markdown);

        for (const chunk of wordChunks) {
          chunkIdx++;
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
              channel_id: channelId,
              channel_name: channelName,
              message_ts: mainMsg.ts,
              reply_count: mainMsg.reply_count || 0,
              reaction_count: mainMsg.reactions?.length || 0,
              redaction: assessment.metrics,
            },
          });
        }
      }

      await serviceClient.from("ingestion_jobs").update({
        processed_chunks: allChunks.length,
      }).eq("id", jobId);
    }

    const chunks = allChunks; // for compatibility with downstream code

    await serviceClient.from("ingestion_jobs").update({
      total_chunks: chunks.length,
    }).eq("id", jobId);
    trace.addSpan({
      name: "chunk_summary",
      startTime: Date.now(),
      endTime: Date.now(),
      output: { total_chunks: chunks.length, channels: channel_ids.length },
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

    // Upsert chunks
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
    console.error("Slack ingestion error:", err);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
