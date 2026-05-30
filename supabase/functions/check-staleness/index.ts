import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { requireUserOrInternal } from "../_shared/authz.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { requirePackRole } from "../_shared/pack-access.ts";

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    const { mode, userId } = await requireUserOrInternal(req, corsHeaders);
    const { pack_id } = await readJson(req, corsHeaders);

    if (!pack_id) {
      return jsonError(400, "bad_request", "pack_id required", {}, corsHeaders);
    }

    const serviceClient = createServiceClient();

    // Pack Authorization: Ensure human users have 'author' access to this pack.
    if (mode === "user") {
      await requirePackRole(
        serviceClient,
        pack_id,
        userId!,
        "author",
        corsHeaders,
      );
    }

    // Get all content_freshness rows for this pack
    const { data: freshnessRows, error: fErr } = await serviceClient
      .from("content_freshness")
      .select("*")
      .eq("pack_id", pack_id);

    if (fErr) throw fErr;
    if (!freshnessRows || freshnessRows.length === 0) {
      return new Response(JSON.stringify({ stale_count: 0, checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect all referenced chunk IDs
    const allChunkIds = new Set<string>();
    for (const row of freshnessRows) {
      for (const cid of (row.referenced_chunk_ids || [])) allChunkIds.add(cid);
    }

    // Fetch current hashes
    const { data: chunks } = await serviceClient
      .from("knowledge_chunks")
      .select("chunk_id, content_hash")
      .eq("pack_id", pack_id)
      .in("chunk_id", Array.from(allChunkIds));

    const currentHashes = new Map(
      (chunks ?? []).map((c: any) => [c.chunk_id, c.content_hash]),
    );

    let staleCount = 0;
    for (const row of freshnessRows) {
      const storedHashes = row.chunk_hash_at_generation || {};
      let isStale = false;
      const details: any[] = [];

      for (const cid of (row.referenced_chunk_ids || [])) {
        const currentHash = currentHashes.get(cid);
        const storedHash = (storedHashes as any)[cid];
        if (!currentHash) {
          isStale = true;
          details.push({ chunk_id: cid, reason: "deleted" });
        } else if (storedHash && currentHash !== storedHash) {
          isStale = true;
          details.push({ chunk_id: cid, reason: "modified" });
        }
      }

      if (isStale) staleCount++;

      await serviceClient.from("content_freshness").update({
        is_stale: isStale,
        staleness_details: { changed_chunks: details },
        last_checked_at: new Date().toISOString(),
      }).eq("id", row.id);
    }

    return json(
      200,
      { stale_count: staleCount, checked: freshnessRows.length },
      corsHeaders,
    );
  } catch (err: any) {
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
