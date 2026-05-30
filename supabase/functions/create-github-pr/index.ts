// Modern Deno.serve is built-in
import { applyPatch, parsePatch } from "https://esm.sh/diff@5.1.0";
import { getSourceCredential } from "../_shared/credentials.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
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

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsPreflight = handleCorsPreflight(req, allowedOrigins);
  if (corsPreflight) return corsPreflight;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    const body = await readJson(req, corsHeaders);
    const { pack_id, proposal_id } = body;

    if (!pack_id || !proposal_id) {
      return jsonError(
        400,
        "bad_request",
        "Missing required fields",
        {},
        corsHeaders,
      );
    }

    const { userId } = await requireUser(req, corsHeaders);
    const serviceClient = createServiceClient();

    // 2. Check Author Access
    await requirePackRole(
      serviceClient,
      pack_id,
      userId,
      "author",
      corsHeaders,
    );

    // 2. Fetch Proposal
    const { data: proposal, error: proposalError } = await serviceClient
      .from("change_proposals")
      .select("*")
      .eq("id", proposal_id)
      .single();

    if (proposalError || !proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (proposal.status !== "approved") {
      return new Response(
        JSON.stringify({
          error: "Only approved proposals can be turned into PRs",
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    // 3. Get GitHub Credentials
    const githubToken = await getSourceCredential(
      serviceClient,
      proposal.source_id,
    );
    if (!githubToken) {
      return new Response(
        JSON.stringify({
          error: "GitHub credentials not found for this source",
        }),
        { status: 500, headers: corsHeaders },
      );
    }

    // 4. Fetch Source Info
    const { data: source } = await serviceClient
      .from("pack_sources")
      .select("source_uri")
      .eq("id", proposal.source_id)
      .single();

    if (!source || !source.source_uri) {
      throw new Error("Source URI not found");
    }

    // Parse owner/repo from source_uri (e.g., https://github.com/owner/repo)
    const urlParts = new URL(source.source_uri).pathname.split("/").filter(
      Boolean,
    );
    const owner = urlParts[0];
    const repo = urlParts[1];
    const baseBranch = proposal.target_base_branch || "main";
    const newBranch = `rocketboard/proposal-${proposal_id.slice(0, 8)}`;

    const githubHeaders = {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

    // Helper for GitHub API calls with SSRF protection
    const ghFetch = async (path: string, options: RequestInit = {}) => {
      const url = parseAndValidateExternalUrl(`${apiBase}${path}`, {
        allowedHostSuffixes: ["api.github.com"],
      });
      const res = await fetch(url, {
        ...options,
        headers: { ...githubHeaders, ...options.headers },
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`GitHub API Error (${res.status}): ${err}`);
      }
      return res.json();
    };

    console.log(
      `[WRITE-BACK] Creating PR for ${owner}/${repo} from proposal ${proposal_id}`,
    );

    // A. Get Base Branch SHA
    const baseRef = await ghFetch(`/git/refs/heads/${baseBranch}`);
    const baseSha = baseRef.object.sha;

    // B. Apply Multi-file Patch & Create Blobs
    const patches = parsePatch(proposal.patch_unified);
    const treeItems = [];

    if (patches.length === 0) {
      throw new Error(
        "No patches found in proposal. Unified diff might be malformed.",
      );
    }

    for (const patch of patches) {
      // Robust path detection from patch headers
      const rawPath = patch.newFileName || patch.oldFileName;
      if (!rawPath) continue;

      // Strip common prefixes like a/ and b/ from git diffs
      const normalizedPath = rawPath.replace(/^[ab]\//, "");

      // 1. Get current content from GitHub
      let currentContent = "";
      try {
        const fileData = await ghFetch(
          `/contents/${normalizedPath}?ref=${baseSha}`,
        );
        // GitHub returns base64 with newlines.
        // Robust base64 to utf8 decoding:
        const binary = atob(fileData.content.replace(/\n/g, ""));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        currentContent = new TextDecoder().decode(bytes);
      } catch (e) {
        console.warn(
          `[WRITE-BACK] File ${normalizedPath} not found, assuming new file creation.`,
        );
      }

      // 2. Apply patch to content
      const result = applyPatch(currentContent, patch);

      if (result === false) {
        throw new Error(
          `Conflict: Failed to apply patch to "${normalizedPath}".`,
        );
      }

      // 3. Create Blob for the new content
      const blob = await ghFetch(`/git/blobs`, {
        method: "POST",
        body: JSON.stringify({
          content: result,
          encoding: "utf-8",
        }),
      });

      treeItems.push({
        path: normalizedPath,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }

    // C. Create Tree
    const tree = await ghFetch(`/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseSha,
        tree: treeItems,
      }),
    });

    // D. Create Commit
    const commit = await ghFetch(`/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: proposal.title,
        tree: tree.sha,
        parents: [baseSha],
      }),
    });

    // E. Create Branch Ref
    await ghFetch(`/git/refs`, {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${newBranch}`,
        sha: commit.sha,
      }),
    });

    // F. Create Pull Request
    const pr = await ghFetch(`/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: proposal.title,
        body: proposal.description ||
          `Proposal created via RocketBoard.\n\nProposal ID: ${proposal_id}`,
        head: newBranch,
        base: baseBranch,
      }),
    });

    // 5. Update Proposal & Audit
    await serviceClient
      .from("change_proposals")
      .update({
        status: "pr_opened",
        pr_url: pr.html_url,
      })
      .eq("id", proposal_id);

    // Audit Event
    await serviceClient.from("lifecycle_audit_events").insert({
      pack_id: pack_id,
      event_type: "proposal_pr_created",
      actor_id: null,
      details: {
        proposal_id: proposal_id,
        pr_url: pr.html_url,
        owner,
        repo,
        branch: newBranch,
      },
    });

    return json(200, {
      success: true,
      pr_url: pr.html_url,
      branch: newBranch,
    }, corsHeaders);
  } catch (err: any) {
    console.error("[WRITE-BACK] Error:", err.message);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
