import { json, jsonError, readJson } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { requireUser } from "../_shared/authz.ts";
import { requirePackRole } from "../_shared/pack-access.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    // 1. Authenticate user
    const { userId } = await requireUser(req, corsHeaders);

    // 2. Parse request
    const { messages, moduleContext, packId } = await readJson(
      req,
      corsHeaders,
    );
    const targetPackId = packId || moduleContext?.packId;

    if (!targetPackId) {
      return jsonError(400, "bad_request", "Missing packId", {}, corsHeaders);
    }

    // 3. Authorize pack access (Learner or higher)
    const serviceClient = createServiceClient();
    await requirePackRole(
      serviceClient,
      targetPackId,
      userId,
      "learner",
      corsHeaders,
    );

    const LOCAL_LLM_API_KEY = Deno.env.get("LOCAL_LLM_API_KEY");
    if (!LOCAL_LLM_API_KEY) {
      throw new Error("LOCAL_LLM_API_KEY is not configured");
    }

    const systemPrompt =
      `You are a helpful onboarding assistant for the "${moduleContext.title}" module. Answer questions clearly and concisely based ONLY on the module content provided below. If a question is outside the module scope, say so politely.

## Module: ${moduleContext.title}
${moduleContext.description}

## Key Takeaways
${(moduleContext.keyTakeaways || []).map((t: string) => `- ${t}`).join("\n")}

## Sections
${
        (moduleContext.sections || []).map((
          s: { title: string; content: string },
        ) => `### ${s.title}\n${s.content}`).join("\n\n")
      }

Keep answers concise, use markdown formatting, and reference specific sections when relevant.`;

    const response = await fetch(
      (Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1") +
        "/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOCAL_LLM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again in a moment.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted. Please add credits to continue.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error: any) {
    if (error.response) return error.response;

    console.error("module-chat error:", error);
    return jsonError(
      500,
      "internal_error",
      error.message || "Unknown error",
      {},
      corsHeaders,
    );
  }
});
