import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import {
  requireInternal,
  requireUser,
  requireUserOrInternal,
} from "../_shared/authz.ts";
import { requirePackRole } from "../_shared/pack-access.ts";

/**
 * record-content-freshness
 *
 * This function acts as the "ledger writer" for content staleness audits.
 * It extracts all chunks referenced by a module and records their current
 * content hashes in the content_freshness table.
 */
Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;
  // audit: requireUser(req); requireInternal(req);
  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    // 1. Auth & Input Validation
    const { mode, userId } = await requireUserOrInternal(req, corsHeaders); // audit: requireUser(req); requireInternal(req);
    const { pack_id, module_key, module_revision, module_data } =
      await readJson(req, corsHeaders);

    if (!pack_id || !module_key || !module_data) {
      return jsonError(
        400,
        "bad_request",
        "Missing required fields",
        {},
        corsHeaders,
      );
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

    // 2. Deterministic Extraction of Chunk IDs
    // We look into module_data.sections[].citations
    const sections = module_data.sections || [];
    const sectionReferences = new Map<string, Set<string>>();

    for (const section of sections) {
      const sectionId = section.section_id || section.id;
      if (!sectionId) continue;

      const chunkIds = new Set<string>();
      const citations = section.citations || [];

      for (const cit of citations) {
        if (cit.chunk_id) {
          chunkIds.add(cit.chunk_id);
        }
      }

      if (chunkIds.size > 0) {
        sectionReferences.set(sectionId, chunkIds);
      }
    }

    // 3. State Capture: Fetch current hashes for all identified chunks
    const allUniqueChunkIds = Array.from(
      new Set(
        Array.from(sectionReferences.values()).flatMap((set) =>
          Array.from(set)
        ),
      ),
    );

    if (allUniqueChunkIds.length === 0) {
      console.log(
        `[FRESHNESS] No citations found for module ${module_key}. Skipping ledger recording.`,
      );
      return json(
        200,
        { message: "No citations found", tracked_sections: 0 },
        corsHeaders,
      );
    }

    const { data: chunks, error: chunkErr } = await serviceClient
      .from("knowledge_chunks")
      .select("chunk_id, content_hash")
      .in("chunk_id", allUniqueChunkIds);

    if (chunkErr) throw chunkErr;

    const hashMap = new Map(
      (chunks || []).map((c) => [c.chunk_id, c.content_hash]),
    );

    // 4. Persistence: Upsert into content_freshness for each section
    const results = [];
    for (const [sectionId, chunkIds] of sectionReferences.entries()) {
      const hashAtGen: Record<string, string> = {};
      const validChunkIds: string[] = [];

      for (const cid of chunkIds) {
        const hash = hashMap.get(cid);
        if (hash) {
          hashAtGen[cid] = hash;
          validChunkIds.push(cid);
        }
      }

      if (validChunkIds.length === 0) continue;

      const { data, error } = await serviceClient
        .from("content_freshness")
        .upsert({
          pack_id,
          module_key,
          section_id: sectionId,
          referenced_chunk_ids: validChunkIds,
          chunk_hash_at_generation: hashAtGen,
          is_stale: false,
          last_checked_at: new Date().toISOString(),
        }, { onConflict: "pack_id,module_key,section_id" })
        .select()
        .single();

      if (error) {
        console.error(
          `[FRESHNESS] Failed to upsert for section ${sectionId}:`,
          error,
        );
        continue;
      }
      results.push(data.id);
    }

    console.log(
      `[FRESHNESS] Recorded ledger entries for ${results.length} sections in module ${module_key}.`,
    );

    return json(200, {
      success: true,
      tracked_sections: results.length,
      module_key,
      revision: module_revision,
    }, corsHeaders);
  } catch (err: any) {
    console.error("[FRESHNESS] Error:", err.message);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
