import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

export interface GuardResult {
  success: boolean;
  status?: number;
  error?: string;
  next_allowed_at?: string;
  retry_count?: number;
}

export async function validateIngestion(
  supabase: SupabaseClient,
  pack_id: string,
  source_id: string,
): Promise<GuardResult> {
  const cooldownSeconds = parseInt(
    Deno.env.get("INGEST_SOURCE_COOLDOWN_SECONDS") || "3600",
  );
  const serializePack = Deno.env.get("INGEST_PACK_SERIALIZE") !== "false";
  const staleProcessingSeconds = parseInt(
    Deno.env.get("INGESTION_STALE_PROCESSING_SECONDS") || "300",
  );

  // 1. Check for 'processing' jobs (Concurrency)
  const { data: activeJobs, error: activeErr } = await supabase
    .from("ingestion_jobs")
    .select("id, source_id, status, started_at, last_heartbeat_at")
    .eq("pack_id", pack_id)
    .eq("status", "processing");

  if (activeErr) throw activeErr;

  const staleJobIds = (activeJobs || [])
    .filter((job) => {
      const referenceTime = job.last_heartbeat_at || job.started_at;
      if (!referenceTime) return false;
      return Date.now() - new Date(referenceTime).getTime() >
        staleProcessingSeconds * 1000;
    })
    .map((job) => job.id);

  if (staleJobIds.length > 0) {
    const { error: staleErr } = await supabase
      .from("ingestion_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "Stale processing job reset after runtime failure",
      })
      .in("id", staleJobIds);

    if (staleErr) throw staleErr;
  }

  const blockingJobs = (activeJobs || []).filter((job) =>
    !staleJobIds.includes(job.id)
  );

  if (blockingJobs.length > 0) {
    if (serializePack) {
      return {
        success: false,
        status: 409,
        error: "Another ingestion is already in progress for this pack.",
      };
    }
    if (blockingJobs.some((j) => j.source_id === source_id)) {
      return {
        success: false,
        status: 409,
        error: "Ingestion already in progress for this source.",
      };
    }
  }

  // 2. Check Last Job State (Cooldown & Retry Count)
  const { data: lastJob, error: lastErr } = await supabase
    .from("ingestion_jobs")
    .select("status, completed_at, retry_count")
    .eq("source_id", source_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastErr) throw lastErr;

  let currentRetryCount = 0;
  if (lastJob) {
    if (lastJob.status === "failed") {
      currentRetryCount = (lastJob.retry_count || 0) + 1;
    } else if (lastJob.status === "completed" && lastJob.completed_at) {
      const lastCompleted = new Date(lastJob.completed_at).getTime();
      const now = Date.now();
      const elapsed = (now - lastCompleted) / 1000;

      if (elapsed < cooldownSeconds) {
        const nextAllowed = new Date(lastCompleted + cooldownSeconds * 1000)
          .toISOString();
        return {
          success: false,
          status: 429,
          error:
            "Cooldown active. Please wait before re-ingesting this source.",
          next_allowed_at: nextAllowed,
        };
      }
    }
  }

  return { success: true, retry_count: currentRetryCount };
}

export async function updateHeartbeat(
  supabase: SupabaseClient,
  jobId: string,
  data: Record<string, number | string | null> = {},
): Promise<string | null> {
  const { data: updatedJob, error } = await supabase
    .from("ingestion_jobs")
    .update({
      last_heartbeat_at: new Date().toISOString(),
      ...data,
    })
    .eq("id", jobId)
    .select("status")
    .maybeSingle();

  if (error) {
    console.error(
      `[HEARTBEAT ERROR] Failed to update heartbeat for job ${jobId}:`,
      error,
    );
  }

  return updatedJob?.status || null;
}

export async function checkPackChunkCap(
  supabase: SupabaseClient,
  pack_id: string,
): Promise<GuardResult> {
  const maxChunks = parseInt(Deno.env.get("MAX_CHUNKS_PER_PACK") || "50000");

  const { count, error } = await supabase
    .from("knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .eq("pack_id", pack_id);

  if (error) throw error;

  if (count !== null && count >= maxChunks) {
    return {
      success: false,
      status: 413,
      error:
        `Storage cap exceeded. Pack has reached the maximum limit of ${maxChunks} chunks.`,
    };
  }

  return { success: true };
}

export function getRunCap(): number {
  return parseInt(Deno.env.get("MAX_NEW_CHUNKS_PER_RUN") || "20000");
}
