import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { redactText } from "../_shared/secret-patterns.ts";
import { encodeHex } from "jsr:@std/encoding@1.0.5/hex";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/authz.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { requirePackRole } from "../_shared/pack-access.ts";

// CORS now handled by centralized cors.ts

// Extremely naive but deterministic block parser for V1
function parseBlocks(content: string) {
  const blocks: { block_type: string; payload: any }[] = [];
  const lines = content.split("\n");

  let inCodeBlock = false;
  let inMermaidBlock = false;
  let codeLang = "";
  let codeBuffer: string[] = [];

  let pendingParagraph: string[] = [];

  const flushParagraph = () => {
    if (pendingParagraph.length > 0) {
      blocks.push({
        block_type: "paragraph",
        payload: { text: pendingParagraph.join("\n") },
      });
      pendingParagraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code / Mermaid detection
    if (trimmed.startsWith("```")) {
      if (inCodeBlock || inMermaidBlock) {
        // closing
        blocks.push({
          block_type: inMermaidBlock ? "mermaid" : "code",
          payload: inMermaidBlock
            ? { diagram: codeBuffer.join("\n") }
            : { lang: codeLang, code: codeBuffer.join("\n") },
        });
        inCodeBlock = false;
        inMermaidBlock = false;
        codeBuffer = [];
      } else {
        flushParagraph();
        const lang = trimmed.slice(3).trim().toLowerCase();
        if (lang === "mermaid") {
          inMermaidBlock = true;
        } else {
          inCodeBlock = true;
          codeLang = lang;
        }
      }
      continue;
    }

    if (inCodeBlock || inMermaidBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Dividers
    if (trimmed.match(/^(\-{3,}|\*{3,}|\={3,})$/)) {
      flushParagraph();
      blocks.push({ block_type: "divider", payload: {} });
      continue;
    }

    // Headings (## or "1)")
    if (
      trimmed.match(/^#{1,6}\s/) || trimmed.match(/^[A-Z0-9]+[\)\.]\s+[A-Z]/)
    ) {
      flushParagraph();
      blocks.push({
        block_type: "heading",
        payload: { text: trimmed.replace(/^#{1,6}\s/, "").trim() },
      });
      continue;
    }

    // Checklists
    if (
      trimmed.startsWith("- [ ] ") || trimmed.startsWith("- [x] ") ||
      trimmed.startsWith("[ ] ") || trimmed.startsWith("[x] ")
    ) {
      flushParagraph();
      // Fast forward to grab the whole checklist
      const items = [];
      while (i < lines.length) {
        const itemLine = lines[i].trim();
        if (
          itemLine.startsWith("- [ ] ") || itemLine.startsWith("- [x] ") ||
          itemLine.startsWith("[ ] ") || itemLine.startsWith("[x] ")
        ) {
          const checked = itemLine.includes("[x]");
          const text = itemLine.replace(/^[-]?\s*\[[ x]\]\s*/, "").trim();
          items.push({
            id: crypto.randomUUID(),
            text,
            defaultChecked: checked,
          });
          i++;
        } else {
          i--; // step back to let main loop handle it
          break;
        }
      }
      blocks.push({ block_type: "checklist", payload: { items } });
      continue;
    }

    // Callouts
    if (
      trimmed.startsWith("NOTE:") || trimmed.startsWith("WARNING:") ||
      trimmed.startsWith("IMPORTANT:") || trimmed.startsWith("> [!")
    ) {
      flushParagraph();
      // Extract variant
      let variant = "info";
      if (
        trimmed.includes("WARNING") || trimmed.includes("[!WARNING]") ||
        trimmed.includes("[!CAUTION]")
      ) variant = "warning";
      if (
        trimmed.includes("IMPORTANT") || trimmed.includes("NOTE") ||
        trimmed.includes("[!IMPORTANT]") || trimmed.includes("[!NOTE]")
      ) variant = "tip";

      const cleanText = trimmed.replace(
        /^(> \[\![A-Z]+\]|NOTE:|WARNING:|IMPORTANT:|>)/,
        "",
      ).trim();
      blocks.push({
        block_type: "callout",
        payload: { variant, body: cleanText },
      });
      continue;
    }

    // Just regular text
    if (trimmed !== "") {
      pendingParagraph.push(line); // preserve original spacing
    } else {
      flushParagraph();
    }
  }

  flushParagraph();
  return blocks;
}

// Generate an SEO-friendly slug
function generateSlug(filename: string) {
  return filename
    .toLowerCase()
    .replace(/\.txt|\.md$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Clean up title
function formatTitle(filename: string) {
  let title = filename.replace(/\.txt|\.md$/, "");
  title = title.replace(/^[0-9]+_/, ""); // Remove leading numbers "01_"
  title = title.replace(/_/g, " "); // Underscores to spaces
  return title;
}

// Determine category
function determineCategory(filename: string) {
  if (filename === "AGENTS.md") return "Core";

  const match = filename.match(/^([0-9]+)_/);
  if (match) {
    const num = parseInt(match[1]);
    if (num <= 5) return "Architecture";
    if (num <= 10) return "RAG & AI";
    if (num <= 12) return "Security & Ops";
    if (num <= 15) return "Product Features";
  }
  return "Technical";
}

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsPreflight = handleCorsPreflight(req, allowedOrigins);
  if (corsPreflight) return corsPreflight;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    const body = await readJson(req, corsHeaders);
    const {
      pack_id,
      mode = "execute",
      source_prefix = "Technical documents/",
      include_agents = true,
    } = body;

    if (!pack_id) {
      return jsonError(
        400,
        "bad_request",
        "pack_id is required",
        {},
        corsHeaders,
      );
    }

    const serviceClient = createServiceClient();

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

    console.log(`[sync-pack-docs] Starting sync for pack: ${pack_id}`);

    // Fetch chunks
    const { data: chunks, error: chunksError } = await serviceClient
      .from("knowledge_chunks")
      .select("path, content, start_line")
      .eq("pack_id", pack_id)
      .order("path", { ascending: true })
      .order("start_line", { ascending: true });

    if (chunksError) {
      throw new Error(`Failed to fetch chunks: ${chunksError.message}`);
    }

    // Group and filter
    const files = new Map<string, string[]>();
    for (const chunk of chunks || []) {
      if (
        chunk.path.startsWith(source_prefix) ||
        (include_agents && chunk.path === "AGENTS.md")
      ) {
        if (!files.has(chunk.path)) {
          files.set(chunk.path, []);
        }
        files.get(chunk.path)!.push(chunk.content);
      }
    }

    const summary = {
      docs_created: 0,
      docs_updated: 0,
      docs_unchanged: 0,
      files: [] as any[],
    };

    if (mode === "dry_run") {
      for (const [path, contents] of files.entries()) {
        const fullText = contents.join("\n\n");
        const redacted = redactText(fullText);
        summary.files.push({
          path,
          chunks: contents.length,
          final_chars: redacted.redactedText.length,
        });
      }
      return json(200, { status: "dry_run", summary }, corsHeaders);
    }

    // Execute Mode: Upsert to pack_docs
    for (const [path, contents] of files.entries()) {
      const dbPath = path;
      const filename = path.split("/").pop() || path;
      const slug = generateSlug(filename);
      const title = formatTitle(filename);
      const category = determineCategory(filename);

      // Stitch and redact
      const fullText = contents.join("\n\n");
      const { redactedText } = redactText(fullText);

      // Parse Blocks
      const docBlocks = parseBlocks(redactedText);

      // Hash check
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(redactedText),
      );
      const textHash = encodeHex(hashBuffer);

      // Check existing doc
      const { data: existingDoc } = await serviceClient
        .from("pack_docs")
        .select("id, version")
        .eq("pack_id", pack_id)
        .eq("slug", slug)
        .single();

      let docId;
      let newVersion = 1;

      if (existingDoc) {
        docId = existingDoc.id;
        newVersion = existingDoc.version + 1;

        const { error: updError } = await serviceClient
          .from("pack_docs")
          .update({
            content_plain: redactedText,
            version: newVersion,
            updated_at: new Date().toISOString(),
          })
          .eq("id", docId);

        if (updError) throw new Error(`Update doc failed: ${updError.message}`);
        summary.docs_updated++;
      } else {
        const { data: newDoc, error: insError } = await serviceClient
          .from("pack_docs")
          .insert({
            pack_id,
            slug,
            title,
            category,
            content_plain: redactedText,
            source_path: dbPath,
            source_type: "repo_import",
            format: "md",
            status: "published",
            created_by: userId,
            owner_user_id: userId,
          })
          .select("id")
          .single();

        if (insError) throw new Error(`Insert doc failed: ${insError.message}`);
        docId = newDoc.id;
        summary.docs_created++;
      }

      // Re-create blocks (destructive sync)
      await serviceClient.from("pack_doc_blocks").delete().eq("doc_id", docId);

      if (docBlocks.length > 0) {
        const blocksToInsert = docBlocks.map((b, i) => ({
          doc_id: docId,
          block_order: i + 1,
          block_type: b.block_type,
          payload: b.payload,
        }));

        const { error: blkError } = await serviceClient.from("pack_doc_blocks")
          .insert(blocksToInsert);
        if (blkError) console.error("Block insert error", blkError);
      }

      summary.files.push({ slug, title, blocks: docBlocks.length });
    }

    // Audit log
    const { error: auditError } = await serviceClient.from(
      "lifecycle_audit_events",
    ).insert({
      pack_id,
      user_id: userId,
      action: "sync_docs",
      status: "success",
      details: summary,
    });
    if (auditError) console.error("Audit fail", auditError);

    return json(200, { status: "success", summary }, corsHeaders);
  } catch (error: any) {
    console.error("[sync-pack-docs] Error:", error);
    return jsonError(500, "internal_error", error.message, {}, corsHeaders);
  }
});
