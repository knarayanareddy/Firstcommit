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

// Local sha256 removed

async function pagerDutyAPI(
  apiKey: string,
  endpoint: string,
  params: Record<string, any> = {},
) {
  const url = new URL(`https://api.pagerduty.com${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Token token=${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`PagerDuty API error: ${resp.status} ${text}`);
  }
  return resp.json();
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
      api_key: config_api_key,
      service_ids = [],
      include_services = true,
      include_oncall = true,
      include_incidents = true,
      fetch_runbooks = false,
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

    let api_key = config_api_key;

    // 1. Fetch api_key from Vault if missing
    if (!api_key) {
      api_key = await getSourceCredential(supabase, source_id, "api_key");
    }

    if (!api_key) {
      return jsonError(
        400,
        "bad_request",
        "Missing PagerDuty API key",
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
      })
      .select().single();
    if (jobErr) throw jobErr;
    const jobId = job.id;

    const chunks: any[] = [];
    let chunkIdx = 0;

    if (include_services) {
      // Fetch services
      const servicesResp = await pagerDutyAPI(api_key, "/services", {
        limit: 100,
      });
      let services = servicesResp.services || [];

      // Filter by service_ids if provided
      if (service_ids.length > 0) {
        services = services.filter((s: any) => service_ids.includes(s.id));
      }

      for (const service of services) {
        chunkIdx++;
        // Check per-run cap
        if (chunkIdx > getRunCap()) {
          throw new Error(
            `Ingestion cap exceeded: maximum of ${getRunCap()} new chunks per run allowed.`,
          );
        }
        let content = `# Service: ${service.name}\n\n`;
        content += `**ID**: ${service.id}\n`;
        content += `**Status**: ${service.status}\n`;
        if (service.description) {
          content += `**Description**: ${service.description}\n`;
        }
        content += "\n";

        // Escalation policy
        if (service.escalation_policy) {
          content += `## Escalation Policy\n\n`;
          content += `**Policy**: ${
            service.escalation_policy.summary ||
            service.escalation_policy.name || "Unknown"
          }\n`;
        }

        // Integrations
        if (service.integrations?.length) {
          content += `\n## Integrations\n\n`;
          for (const int of service.integrations) {
            content += `- ${
              int.summary || int.type || "Unknown integration"
            }\n`;
          }
        }

        // Runbook URL
        if (service.auto_resolve_timeout) {
          content += `\nAuto-resolve timeout: ${
            service.auto_resolve_timeout / 60
          } minutes\n`;
        }

        // Runbook notes (fetched from Notes API when fetch_runbooks is enabled)
        if (fetch_runbooks) {
          try {
            const notesResp = await pagerDutyAPI(
              api_key,
              `/services/${service.id}/notes`,
            );
            const notes = notesResp.notes || [];
            const runbookNotes = notes.filter((note: any) => {
              const text = note.content || "";
              return text.includes("http") || text.includes("runbook") ||
                text.includes("playbook") ||
                text.includes("steps") || text.includes("procedure");
            });
            if (runbookNotes.length > 0) {
              content += `\n## Runbook Notes\n\n`;
              for (const note of runbookNotes.slice(0, 10)) {
                const author = note.user?.summary || "Unknown";
                const created = note.created_at
                  ? new Date(note.created_at).toLocaleDateString()
                  : "";
                content += `**${author}** (${created}):\n${note.content}\n\n`;
              }
            }
          } catch (err) {
            console.error(
              `[PagerDuty] Failed to fetch notes for service ${service.id}:`,
              err,
            );
          }
        }

        const assessment = assessChunkRedaction(content);
        const hash = await computeContentHash(assessment.contentToStore);
        chunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `pagerduty:${service.name}/overview`,
          start_line: 1,
          end_line: assessment.contentToStore.split("\n").length,
          content: assessment.contentToStore,
          content_hash: hash,
          is_redacted: assessment.isRedacted,
          pack_id,
          source_id,
          metadata: {
            service_id: service.id,
            service_name: service.name,
            status: service.status,
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

    if (include_oncall) {
      // Fetch escalation policies and on-call schedules
      try {
        const policiesResp = await pagerDutyAPI(
          api_key,
          "/escalation_policies",
          { limit: 50 },
        );
        const oncallsResp = await pagerDutyAPI(api_key, "/oncalls", {
          limit: 100,
        });

        chunkIdx++;
        let content = `# On-Call Structure\n\n`;

        // Escalation policies
        content += `## Escalation Policies\n\n`;
        for (const policy of policiesResp.escalation_policies || []) {
          content += `### ${policy.name}\n`;
          if (policy.description) content += `${policy.description}\n`;
          content += `Escalation rules:\n`;
          for (let i = 0; i < (policy.escalation_rules || []).length; i++) {
            const rule = policy.escalation_rules[i];
            const targets = (rule.targets || []).map((t: any) =>
              t.summary || t.type
            ).join(", ");
            content += `${
              i + 1
            }. After ${rule.escalation_delay_in_minutes} min → ${targets}\n`;
          }
          content += "\n";
        }

        // Current on-calls
        content += `## Current On-Call\n\n`;
        const oncallsByPolicy: Record<string, string[]> = {};
        for (const oncall of oncallsResp.oncalls || []) {
          const policyName = oncall.escalation_policy?.summary || "Unknown";
          const userName = oncall.user?.summary || "Unknown";
          if (!oncallsByPolicy[policyName]) oncallsByPolicy[policyName] = [];
          if (!oncallsByPolicy[policyName].includes(userName)) {
            oncallsByPolicy[policyName].push(userName);
          }
        }
        for (const [policy, users] of Object.entries(oncallsByPolicy)) {
          content += `- **${policy}**: ${users.join(", ")}\n`;
        }

        const assessment = assessChunkRedaction(content);
        const hash = await computeContentHash(assessment.contentToStore);
        chunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `pagerduty:oncall/structure`,
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
      } catch (err) {
        console.error("Failed to fetch on-call data:", err);
      }
    }

    if (include_incidents) {
      // Fetch recent incidents for pattern analysis
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString();
        const incidentsResp = await pagerDutyAPI(api_key, "/incidents", {
          since,
          limit: 100,
          statuses: ["resolved"],
        });

        const incidents = incidentsResp.incidents || [];
        if (incidents.length > 0) {
          chunkIdx++;
          let content = `# Incident Patterns (Last 30 Days)\n\n`;
          content += `**Total incidents**: ${incidents.length}\n\n`;

          // Analyze by service
          const byService: Record<string, number> = {};
          const byUrgency: Record<string, number> = {};
          let totalResolveTime = 0;
          let resolvedCount = 0;

          for (const inc of incidents) {
            const serviceName = inc.service?.summary || "Unknown";
            byService[serviceName] = (byService[serviceName] || 0) + 1;
            byUrgency[inc.urgency || "unknown"] =
              (byUrgency[inc.urgency || "unknown"] || 0) + 1;

            if (inc.created_at && inc.resolved_at) {
              const created = new Date(inc.created_at).getTime();
              const resolved = new Date(inc.resolved_at).getTime();
              totalResolveTime += (resolved - created) / 60000; // minutes
              resolvedCount++;
            }
          }

          content += `## By Service\n\n`;
          const sortedServices = Object.entries(byService).sort((a, b) =>
            b[1] - a[1]
          );
          for (const [service, count] of sortedServices.slice(0, 10)) {
            content += `- **${service}**: ${count} incidents\n`;
          }

          content += `\n## By Urgency\n\n`;
          for (const [urgency, count] of Object.entries(byUrgency)) {
            content += `- ${urgency}: ${count}\n`;
          }

          if (resolvedCount > 0) {
            const avgResolveTime = Math.round(totalResolveTime / resolvedCount);
            content +=
              `\n**Average resolution time**: ${avgResolveTime} minutes\n`;
          }

          const assessment = assessChunkRedaction(content);
          const hash = await computeContentHash(assessment.contentToStore);
          chunks.push({
            chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
            path: `pagerduty:incidents/patterns`,
            start_line: 1,
            end_line: assessment.contentToStore.split("\n").length,
            content: assessment.contentToStore,
            content_hash: hash,
            is_redacted: assessment.isRedacted,
            pack_id,
            source_id,
            metadata: {
              incident_count: incidents.length,
              period_days: 30,
              redaction: {
                action: assessment.action,
                secretsFound: assessment.metrics.secretsFound,
                matchedPatterns: assessment.metrics.matchedPatterns,
                redactionRatio: assessment.metrics.redactionRatio,
              },
            },
          });
        }
      } catch (err) {
        console.error("Failed to fetch incidents:", err);
      }
    }

    // 4. Handle Embeddings (Reuse + Generation)
    const { reusedCount, generatedCount } = await processEmbeddingsWithReuse(
      supabase,
      pack_id,
      source_id,
      chunks,
      openAIApiKey,
    );

    await serviceClient.from("ingestion_jobs").update({
      total_chunks: chunks.length,
    }).eq("id", jobId);

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
    console.error("PagerDuty ingestion error:", err);
    return jsonError(
      500,
      "internal_error",
      (err as Error).message,
      {},
      corsHeaders,
    );
  }
});
