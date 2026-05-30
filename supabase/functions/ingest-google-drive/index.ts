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

// Redaction now handled by centralized secret-patterns.ts

function chunkWords(
  text: string,
  wordCount = 500,
): { start: number; end: number; text: string }[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: { start: number; end: number; text: string }[] = [];
  let i = 0;
  let lineEstimate = 1;
  while (i < words.length) {
    const end = Math.min(i + wordCount, words.length);
    const chunk = words.slice(i, end).join(" ");
    const lines = chunk.split("\n").length;
    chunks.push({
      start: lineEstimate,
      end: lineEstimate + lines - 1,
      text: chunk,
    });
    lineEstimate += lines;
    i = end;
  }
  return chunks;
}

// Local sha256 removed in favor of computeContentHash

// Google service account JWT creation
async function createServiceAccountJWT(keyData: any): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: keyData.client_email,
    scope:
      "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=+$/, "").replace(
    /\+/g,
    "-",
  ).replace(/\//g, "_");
  const encodedClaims = btoa(JSON.stringify(claims)).replace(/=+$/, "").replace(
    /\+/g,
    "-",
  ).replace(/\//g, "_");
  const signatureInput = `${encodedHeader}.${encodedClaims}`;

  // Import the private key
  const pemKey = keyData.private_key;
  const pemContent = pemKey.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(
    /-----END PRIVATE KEY-----/,
    "",
  ).replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signatureInput),
  );
  const encodedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  ).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${signatureInput}.${encodedSignature}`;
}

async function getAccessToken(keyData: any): Promise<string> {
  const jwt = await createServiceAccountJWT(keyData);

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Google OAuth error: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return data.access_token;
}

async function listFilesRecursive(
  folderId: string,
  accessToken: string,
): Promise<any[]> {
  const files: any[] = [];
  let pageToken: string | undefined;

  while (true) {
    let url =
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,parents)&pageSize=100`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Google Drive API error: ${resp.status} ${err}`);
    }

    const data = await resp.json();

    for (const file of (data.files || [])) {
      if (file.mimeType === "application/vnd.google-apps.folder") {
        // Recurse into subfolder
        const subFiles = await listFilesRecursive(file.id, accessToken);
        files.push(
          ...subFiles.map((f: any) => ({ ...f, parentName: file.name })),
        );
      } else {
        files.push(file);
      }
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return files;
}

async function extractGoogleDoc(
  docId: string,
  accessToken: string,
): Promise<string> {
  const resp = await fetch(
    `https://docs.googleapis.com/v1/documents/${docId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!resp.ok) return "";
  const doc = await resp.json();

  const parts: string[] = [];
  for (const elem of (doc.body?.content || [])) {
    if (elem.paragraph) {
      const text = (elem.paragraph.elements || [])
        .map((e: any) => e.textRun?.content || "")
        .join("");

      // Check for heading style
      const style = elem.paragraph.paragraphStyle?.namedStyleType;
      if (style === "HEADING_1") parts.push(`# ${text}`);
      else if (style === "HEADING_2") parts.push(`## ${text}`);
      else if (style === "HEADING_3") parts.push(`### ${text}`);
      else parts.push(text);
    } else if (elem.table) {
      for (const row of (elem.table.tableRows || [])) {
        const cells = (row.tableCells || []).map((cell: any) => {
          return (cell.content || []).map((c: any) =>
            (c.paragraph?.elements || []).map((e: any) =>
              e.textRun?.content || ""
            ).join("")
          ).join("");
        });
        parts.push(`| ${cells.join(" | ")} |`);
      }
    }
  }

  return parts.join("\n").trim();
}

async function extractGoogleSheet(
  sheetId: string,
  accessToken: string,
): Promise<string> {
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?includeGridData=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!resp.ok) return "";
  const data = await resp.json();

  const parts: string[] = [];
  for (const sheet of (data.sheets || [])) {
    parts.push(`## ${sheet.properties?.title || "Sheet"}\n`);
    for (const row of (sheet.data?.[0]?.rowData || []).slice(0, 200)) {
      const cells = (row.values || []).map((v: any) => v.formattedValue || "");
      if (cells.some((c: string) => c.trim())) {
        parts.push(`| ${cells.join(" | ")} |`);
      }
    }
    parts.push("");
  }

  return parts.join("\n").trim();
}

async function downloadFileAsText(
  fileId: string,
  accessToken: string,
): Promise<string> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!resp.ok) return "";
  return await resp.text();
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
        "Missing required fields",
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

    let { folder_id, service_account_key, auth_method } = source_config;
    if (!folder_id) {
      return jsonError(
        400,
        "bad_request",
        "Missing folder ID",
        {},
        corsHeaders,
      );
    }

    // 1. Fetch service_account_key from Vault if needed and missing
    if (auth_method === "service_account" && !service_account_key) {
      service_account_key = await getSourceCredential(
        supabase,
        source_id,
        "service_account_key",
      );
    }

    let accessToken: string;

    if (auth_method === "service_account" && service_account_key) {
      const keyData = typeof service_account_key === "string"
        ? JSON.parse(service_account_key)
        : service_account_key;
      accessToken = await getAccessToken(keyData);
    } else if (auth_method === "oauth") {
      // Load stored OAuth token for this user
      const { user_id } = source_config;
      if (!user_id) {
        return jsonError(
          400,
          "bad_request",
          "user_id required for OAuth auth",
          {},
          corsHeaders,
        );
      }
      const supabaseTmp = createServiceClient();
      const { data: tokenRow, error: tokenErr } = await supabaseTmp
        .from("google_oauth_tokens")
        .select("access_token, refresh_token, expires_at")
        .eq("user_id", user_id)
        .single();

      if (tokenErr || !tokenRow) {
        return jsonError(
          401,
          "unauthorized",
          "No Google OAuth token found. Please reconnect Google Drive in the Sources page.",
          {},
          corsHeaders,
        );
      }

      // Refresh the token if it has expired (or expires within 2 minutes)
      const expiresAt = new Date(tokenRow.expires_at).getTime();
      if (Date.now() > expiresAt - 120_000 && tokenRow.refresh_token) {
        const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: tokenRow.refresh_token,
            client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
            client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
          }),
        });
        if (!refreshResp.ok) {
          return new Response(
            JSON.stringify({
              error:
                "Google OAuth token expired and refresh failed. Please reconnect Google Drive.",
            }),
            {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const refreshData = await refreshResp.json();
        accessToken = refreshData.access_token;
        // Persist the new token
        await supabaseTmp.from("google_oauth_tokens").update({
          access_token: accessToken,
          expires_at: new Date(
            Date.now() + (refreshData.expires_in || 3600) * 1000,
          ).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("user_id", user_id);
      } else {
        accessToken = tokenRow.access_token;
      }
    } else {
      return new Response(
        JSON.stringify({
          error: "Service account key or Google OAuth connection required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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

    const { data: job, error: jobErr } = await supabase
      .from("ingestion_jobs")
      .insert({
        pack_id,
        source_id,
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (jobErr) throw jobErr;
    const jobId = job.id;

    console.log(`[GDrive] Listing files in folder ${folder_id}...`);
    const files = await listFilesRecursive(folder_id, accessToken);
    console.log(`[GDrive] Found ${files.length} files`);

    await serviceClient.from("ingestion_jobs").update({
      total_chunks: files.length,
    }).eq("id", jobId);

    const allChunks: any[] = [];
    let chunkIdx = 0;

    const SUPPORTED_MIME_TYPES = new Set([
      "application/vnd.google-apps.document",
      "application/vnd.google-apps.spreadsheet",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
    ]);

    for (const file of files) {
      if (!SUPPORTED_MIME_TYPES.has(file.mimeType)) continue;

      let content = "";
      const fileName = file.parentName
        ? `${file.parentName}/${file.name}`
        : file.name;

      try {
        if (file.mimeType === "application/vnd.google-apps.document") {
          content = await extractGoogleDoc(file.id, accessToken);
        } else if (
          file.mimeType === "application/vnd.google-apps.spreadsheet"
        ) {
          content = await extractGoogleSheet(file.id, accessToken);
        } else {
          content = await downloadFileAsText(file.id, accessToken);
        }
      } catch (err) {
        console.error(`[GDrive] Error extracting ${fileName}:`, err);
        continue;
      }

      if (!content.trim()) continue;

      const wordChunks = chunkWords(content);
      for (const chunk of wordChunks) {
        chunkIdx++;
        // Check per-run cap
        if (chunkIdx > getRunCap()) {
          throw new Error(
            `Ingestion cap exceeded: maximum of ${getRunCap()} new chunks per run allowed.`,
          );
        }
        const assessment = assessChunkRedaction(chunk.text);
        const hash = await computeContentHash(assessment.contentToStore);

        allChunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `gdrive:${fileName}`,
          start_line: chunk.start,
          end_line: assessment.contentToStore.split("\n").length,
          content: assessment.contentToStore,
          content_hash: hash,
          is_redacted: assessment.isRedacted,
          metadata: {
            redaction: {
              action: assessment.action,
              secretsFound: assessment.metrics.secretsFound,
            },
          },
        });
      }
    }

    // 4. Handle Embeddings (Reuse + Generation)
    const { reusedCount, generatedCount } = await processEmbeddingsWithReuse(
      supabase,
      pack_id,
      source_id,
      allChunks,
      openAIApiKey,
    );

    // Upsert chunks
    const BATCH_SIZE = 100;
    let processed = 0;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE).map((c) => ({
        pack_id,
        source_id,
        ...c,
      }));
      const { error: upsertErr } = await supabase
        .from("knowledge_chunks")
        .upsert(batch, { onConflict: "pack_id,chunk_id" });
      if (upsertErr) console.error("Upsert error:", upsertErr);
      processed += batch.length;
      await serviceClient.from("ingestion_jobs").update({
        processed_chunks: processed,
      }).eq("id", jobId);
    }

    await serviceClient.from("pack_sources").update({
      last_synced_at: new Date().toISOString(),
    }).eq("id", source_id);

    await serviceClient.from("ingestion_jobs").update({
      status: "completed",
      processed_chunks: allChunks.length,
      completed_at: new Date().toISOString(),
      metadata: {
        total_chunks: allChunks.length,
        embeddings_reused_count: reusedCount,
        embeddings_generated_count: generatedCount,
      },
    }).eq("id", jobId);

    return json(200, {
      success: true,
      job_id: jobId,
      chunks: allChunks.length,
      files: files.length,
    }, corsHeaders);
  } catch (err: any) {
    if (err.response) return err.response;
    console.error("Google Drive ingestion error:", err);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
