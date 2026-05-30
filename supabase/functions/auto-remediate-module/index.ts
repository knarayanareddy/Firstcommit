import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { requireUserOrInternal } from "../_shared/authz.ts";
import { requirePackRole } from "../_shared/pack-access.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
import { warnIfMissingEnv } from "../_shared/env-warnings.ts";

Deno.serve(async (req) => {
  warnIfMissingEnv("OPENAI_API_KEY", "auto-remediate-module LLM calls");
  warnIfMissingEnv("LOCAL_LLM_API_KEY", "auto-remediate-module LLM fallback");
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    const { pack_id, changed_files, compare_url } = await readJson(
      req,
      corsHeaders,
    );

    if (!pack_id || !compare_url) {
      return jsonError(
        400,
        "bad_request",
        "Missing required fields",
        {},
        corsHeaders,
      );
    }

    const { mode, userId } = await requireUserOrInternal(req, corsHeaders);
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

    // 1. Fetch the actual diff from GitHub
    // Assuming compare_url is something like https://github.com/owner/repo/compare/hash1...hash2
    const githubToken = Deno.env.get("GITHUB_TOKEN");
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3.diff",
    };
    if (githubToken) headers.Authorization = `token ${githubToken}`;

    // Robustly parse GitHub compare URL and convert to API URL
    const url = new URL(compare_url);
    if (!url.hostname.endsWith("github.com")) {
      throw new Error(`Hostname ${url.hostname} not supported for remediation`);
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    // Expected: /owner/repo/compare/base...head
    // Or: /owner/repo/compare/head (relative to base)
    if (pathParts.length < 4 || pathParts[2] !== "compare") {
      throw new Error(
        "Invalid GitHub compare URL format. Expected /owner/repo/compare/comparison",
      );
    }

    const owner = pathParts[0];
    const repo = pathParts[1];
    const comparison = pathParts[3];

    const apiUrl =
      `https://api.github.com/repos/${owner}/${repo}/compare/${comparison}`;

    // SSRF Protection
    const validatedApiUrl = parseAndValidateExternalUrl(apiUrl, {
      allowAnyHost: false,
      allowedHostSuffixes: ["api.github.com"],
      allowHttps: true,
      disallowPrivateIPs: true,
    });

    const diffResp = await fetch(validatedApiUrl, { headers });
    if (!diffResp.ok) throw new Error("Failed to fetch diff");
    const diffText = await diffResp.text();

    if (!diffText || diffText.trim().length === 0) {
      return new Response(JSON.stringify({ message: "Empty diff" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Identify which modules need remediation based on content_freshness or knowledge_chunks
    // For simplicity, we just look up modules that are marked as stale (`content_freshness.is_stale = true`)
    const { data: staleModules, error: staleErr } = await serviceClient
      .from("content_freshness")
      .select("module_key, section_id, staleness_details")
      .eq("pack_id", pack_id)
      .eq("is_stale", true);

    if (staleErr || !staleModules || staleModules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No stale modules to remediate" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. For each stale module section, contact LLM to draft an update
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    const localApiKey = Deno.env.get("LOCAL_LLM_API_KEY");

    // Provider Routing Logic
    const useOpenAI = !!openAIApiKey;
    const llmApiKey = openAIApiKey || localApiKey;
    const llmEndpoint = useOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : ((Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1") +
        "/chat/completions");
    const llmModel = useOpenAI ? "gpt-4o" : "google/gemini-3-flash-preview";

    if (!llmApiKey) {
      throw new Error(
        "Missing LLM API Key (OPENAI_API_KEY or LOCAL_LLM_API_KEY)",
      );
    }

    console.log(
      `[REMEDIATION] drafting via ${
        useOpenAI ? "OpenAI" : "local LLM endpoint"
      } (${llmModel})`,
    );

    for (const stale of staleModules) {
      // Fetch current module data
      const { data: mod } = await serviceClient
        .from("generated_modules")
        .select("module_data")
        .eq("pack_id", pack_id)
        .eq("module_key", stale.module_key)
        .single();

      if (!mod) continue;
      const section = (mod.module_data as any).sections?.find((s: any) =>
        s.id === stale.section_id
      );
      if (!section) continue;

      const originalContent = section.content;

      // Ask LLM to propose a change
      const prompt =
        `The source code supporting this documentation has changed. Here is the exact diff of the changes:\n\n${
          diffText.substring(0, 4000)
        }\n\nHere is the original documentation section:\n\n${originalContent}\n\nPlease completely rewrite this documentation section so it is accurate based on the git diff. Return ONLY the new markdown content. Do NOT include any intro or conversational text.`;

      const llmResp = await fetch(llmEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${llmApiKey}`,
        },
        body: JSON.stringify({
          model: llmModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        }),
      });

      if (!llmResp.ok) {
        console.error("LLM Error:", await llmResp.text());
        continue;
      }

      const llmData = await llmResp.json();
      const proposedContent = llmData.choices[0].message.content.trim();

      const diffSummary =
        `Updated based on ${changed_files.length} changed files in recent push.`;

      // Save to module_remediations
      await serviceClient.from("module_remediations").insert({
        pack_id: pack_id,
        module_key: stale.module_key,
        section_id: stale.section_id,
        original_content: originalContent,
        proposed_content: proposedContent,
        diff_summary: diffSummary,
        status: "pending",
      });
      console.log(
        `[REMEDIATION] Draft created for ${stale.module_key}/${stale.section_id}`,
      );
    }

    return new Response(
      JSON.stringify({ success: true, processed: staleModules.length }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("Remediation error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
