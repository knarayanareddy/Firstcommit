// @ts-nocheck — code relocated from index.ts (itself @ts-nocheck); type-tightening tracked via tsconfig.strict.json
/**
 * ai-call.ts — BYOK config resolution + provider endpoint table (monolith split, stage 2a).
 *
 * Extracted verbatim from index.ts; behavior unchanged. callAI + agentic review + JSON
 * parsers follow in stage 2b.
 */
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
import { calculateCost } from "../_shared/telemetry.ts";
import type { TraceBuilder } from "../_shared/telemetry.ts";

export interface AIConfig {
  provider: string;
  model: string;
  endpoint: string;
  apiKey: string;
  isCustom: boolean;
  adapter?: "anthropic" | "cohere" | "bedrock" | "google_openai";
}

export const PROVIDER_ENDPOINTS: Record<
  string,
  {
    url: string;
    adapter?: "anthropic" | "cohere" | "bedrock" | "google_openai";
  }
> = {
  openai: { url: "https://api.openai.com/v1/chat/completions" },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    adapter: "anthropic",
  },
  google: {
    url:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    adapter: "google_openai",
  },
  mistral: { url: "https://api.mistral.ai/v1/chat/completions" },
  xai: { url: "https://api.x.ai/v1/chat/completions" },
  cohere: {
    url: "https://api.cohere.com/compatibility/v1/chat/completions",
    adapter: "cohere",
  },
  deepseek: { url: "https://api.deepseek.com/chat/completions" },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions" },
  fireworks: { url: "https://api.fireworks.ai/inference/v1/chat/completions" },
  together: { url: "https://api.together.xyz/v1/chat/completions" },
  sambanova: { url: "https://api.sambanova.ai/v1/chat/completions" },
  cerebras: { url: "https://api.cerebras.ai/v1/chat/completions" },
  ollama: {
    url: (Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1") +
      "/chat/completions",
  },
  local: {
    url: (Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1") +
      "/chat/completions",
  },
  // De-Lovable: default is now the configured self-hosted/local OpenAI-compatible endpoint.
  default: {
    url: Deno.env.get("DEFAULT_LLM_ENDPOINT") ||
      (Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1") +
        "/chat/completions",
  },
};

export async function resolveAIConfig(userId: string): Promise<AIConfig> {
  const defaultModel = Deno.env.get("DEFAULT_LLM_MODEL") ||
    Deno.env.get("OLLAMA_MODEL") || "llama3";
  // Local OpenAI-compatible servers ignore the key, but the client requires a
  // non-empty bearer; "ollama" is the conventional placeholder.
  const defaultKey = Deno.env.get("LOCAL_LLM_API_KEY") ||
    Deno.env.get("OLLAMA_API_KEY") || "ollama";
  const defaultConfig: AIConfig = {
    provider: "default",
    model: defaultModel,
    endpoint: PROVIDER_ENDPOINTS.default.url,
    apiKey: defaultKey,
    isCustom: false,
  };

  try {
    const sb = createServiceClient();
    const { data: userRow } = await sb.from("user_ai_settings").select(
      "byok_config",
    ).eq("user_id", userId).maybeSingle();

    if (userRow?.byok_config?.active_provider) {
      const activeP = userRow.byok_config.active_provider;
      const providerData = userRow.byok_config.providers?.[activeP];
      if (providerData && providerData.status !== "invalid") {
        const { data: rawKey } = await sb.rpc("get_decrypted_byok_key", {
          _user_id: userId,
          _provider: activeP,
        });
        if (rawKey) {
          const endpointData = PROVIDER_ENDPOINTS[activeP] ||
            PROVIDER_ENDPOINTS.openai;
          return {
            provider: activeP,
            model: userRow.byok_config.active_model ||
              providerData.preferred_model,
            endpoint: endpointData.url,
            apiKey: rawKey,
            isCustom: true,
            adapter: endpointData.adapter,
          };
        }
      }
    }
  } catch (e) {
    console.warn("Error resolving AI config:", e);
  }
  return defaultConfig;
}

// ─── AI CALL ABSTRACTION ───
// Default if not passed in via config
const AI_MODEL = Deno.env.get("DEFAULT_LLM_MODEL") ||
  Deno.env.get("OLLAMA_MODEL") || "llama3";

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  trace?: TraceBuilder,
  config?: AIConfig,
): Promise<string> {
  const activeConfig = config || {
    provider: "default",
    model: AI_MODEL,
    endpoint: PROVIDER_ENDPOINTS.default.url,
    apiKey: Deno.env.get("LOCAL_LLM_API_KEY") ||
      Deno.env.get("OLLAMA_API_KEY") || "ollama",
    isCustom: false,
  };

  if (!activeConfig.apiKey) {
    throw {
      status: 500,
      error_code: "network_error",
      message: "AI service not configured",
    };
  }

  const llmSpan = trace?.startSpan("llm-call", {
    model: activeConfig.model,
    provider: activeConfig.provider,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
  });
  const startTime = Date.now();

  let response: Response;
  try {
    let reqBody: any;
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (activeConfig.adapter === "anthropic") {
      // Anthropic Messages API format
      headers["x-api-key"] = activeConfig.apiKey;
      headers["anthropic-version"] = "2023-06-01";
      reqBody = {
        model: activeConfig.model,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 4096,
      };
    } else {
      // Standard OpenAI format
      headers["Authorization"] = `Bearer ${activeConfig.apiKey}`;
      reqBody = {
        model: activeConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      };
    }

    const localLlmHost = Deno.env.get("LOCAL_LLM_HOST") || "ollama";
    const llmPolicy = {
      allowedHostSuffixes: [
        "openai.com",
        "anthropic.com",
        "google.com",
        "googleapis.com", // For Google Vertex/Gemini
        "mistral.ai",
        "cohere.ai",
        "x.ai",
        "deepseek.com",
        "groq.com",
        "fireworks.ai",
        "together.xyz",
        "sambanova.ai",
        "cerebras.ai",
        "perplexity.ai",
      ],
      // Permit the configured self-hosted local LLM (private host + http handled by guard).
      allowPrivateHosts: [
        localLlmHost,
        "localhost",
        "127.0.0.1",
        "host.docker.internal",
      ],
      disallowPrivateIPs: true,
      allowHttps: true,
    };
    const validatedEndpoint = parseAndValidateExternalUrl(
      activeConfig.endpoint,
      llmPolicy,
    );

    response = await fetch(validatedEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody),
    });
  } catch (e) {
    console.error("AI gateway network error:", e);
    llmSpan?.error("Network error reaching AI service");
    throw {
      status: 503,
      error_code: "network_error",
      message: "Could not reach AI service. Please try again.",
    };
  }

  if (!response.ok) {
    const status = response.status;
    const t = await response.text();
    console.error("AI provider error:", status, t);
    llmSpan?.error(`AI provider returned ${status}`);

    // ── COMMERCIAL FALLBACK: If local LLM endpoint is unavailable (402/429/5xx), try direct API keys ──
    if (
      (status === 402 || status === 429 || status >= 500) &&
      !activeConfig.isCustom
    ) {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiKey) {
        console.log(
          "[FALLBACK] local LLM endpoint 402 → trying OpenAI directly",
        );
        const fallbackModel = "gpt-4o-mini"; // cost-efficient fallback
        const fallbackBody = {
          model: fallbackModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: false,
        };
        const fallbackResp = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openaiKey}`,
            },
            body: JSON.stringify(fallbackBody),
          },
        );
        if (fallbackResp.ok) {
          const fallbackResult = await fallbackResp.json();
          const fallbackContent =
            fallbackResult.choices?.[0]?.message?.content || "";
          const fallbackLatency = Date.now() - startTime;
          if (trace && fallbackResult.usage) {
            const inp = fallbackResult.usage.prompt_tokens || 0;
            const out = fallbackResult.usage.completion_tokens || 0;
            trace.setGeneration({
              model: fallbackModel,
              inputTokens: inp,
              outputTokens: out,
              totalTokens: inp + out,
              latencyMs: fallbackLatency,
              costUsd: calculateCost(fallbackModel, inp, out),
              input: [{ role: "system", content: "[redacted]" }, {
                role: "user",
                content: userPrompt.slice(0, 500),
              }],
              output: fallbackContent.slice(0, 500),
            });
          }
          llmSpan?.end();
          return fallbackContent;
        } else {
          const ft = await fallbackResp.text();
          console.error(
            "[FALLBACK] OpenAI also failed:",
            fallbackResp.status,
            ft,
          );
        }
      }

      // ── 402 FALLBACK #2: Try GOOGLE_AI_API_KEY directly ──
      const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
      if (googleKey) {
        console.log("[FALLBACK] Trying Google AI API directly");
        const googleModel = "gemini-2.5-flash";
        const googleBody = {
          model: googleModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: false,
        };
        const googleResp = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${googleKey}`,
            },
            body: JSON.stringify(googleBody),
          },
        );
        if (googleResp.ok) {
          const googleResult = await googleResp.json();
          const googleContent = googleResult.choices?.[0]?.message?.content ||
            "";
          const googleLatency = Date.now() - startTime;
          if (trace && googleResult.usage) {
            const inp = googleResult.usage.prompt_tokens || 0;
            const out = googleResult.usage.completion_tokens || 0;
            trace.setGeneration({
              model: googleModel,
              inputTokens: inp,
              outputTokens: out,
              totalTokens: inp + out,
              latencyMs: googleLatency,
              costUsd: calculateCost(googleModel, inp, out),
              input: [{ role: "system", content: "[redacted]" }, {
                role: "user",
                content: userPrompt.slice(0, 500),
              }],
              output: googleContent.slice(0, 500),
            });
          }
          llmSpan?.end();
          return googleContent;
        } else {
          const gt = await googleResp.text();
          console.error(
            "[FALLBACK] Google AI also failed:",
            googleResp.status,
            gt,
          );
        }
      }

      // ── FALLBACK #3: Local Ollama (Hardened) ──
      const ollamaEnabled = Deno.env.get("ENABLE_OLLAMA_FALLBACK") === "true";
      const ollamaEndpoint = Deno.env.get("OLLAMA_ENDPOINT");
      const isLocalMode = !Deno.env.get("DENO_REGION");

      if (ollamaEnabled && ollamaEndpoint) {
        const ollamaModel = Deno.env.get("OLLAMA_MODEL") || "llama3";
        const allowPrivate = Deno.env.get("ALLOW_PRIVATE_OLLAMA") === "true";

        try {
          // Strict URL Validation based on environment mode
          const ollamaPolicy = isLocalMode
            ? {
              allowHttp: true,
              allowedHosts: ["localhost", "host.docker.internal"],
              disallowPrivateIPs: !allowPrivate,
              allowedPorts: [11434, 8080, 80, 443],
            }
            : {
              allowHttp: false,
              disallowPrivateIPs: true,
              allowAnyHost: false, // Must be in an allowlist if cloud
            };

          const validatedOllamaUrl = parseAndValidateExternalUrl(
            ollamaEndpoint,
            ollamaPolicy,
          );

          console.log(
            `[FALLBACK] Commercial APIs unavailable → attempting Ollama. endpoint=${validatedOllamaUrl}, local_mode=${isLocalMode}`,
          );

          const ollamaBody = {
            model: ollamaModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            stream: false,
          };

          const ollamaResp = await fetch(validatedOllamaUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ollamaBody),
          });

          if (ollamaResp.ok) {
            const ollamaResult = await ollamaResp.json();
            const ollamaContent = ollamaResult.choices?.[0]?.message?.content ||
              "";
            const ollamaLatency = Date.now() - startTime;

            if (trace) {
              const inp = ollamaResult.usage?.prompt_tokens || 0;
              const out = ollamaResult.usage?.completion_tokens || 0;
              trace.setGeneration({
                model: ollamaModel,
                inputTokens: inp,
                outputTokens: out,
                totalTokens: inp + out,
                latencyMs: ollamaLatency,
                costUsd: 0,
                input: [{ role: "system", content: "[redacted]" }, {
                  role: "user",
                  content: userPrompt.slice(0, 500),
                }],
                output: ollamaContent.slice(0, 500),
              });
            }
            llmSpan?.end();
            return ollamaContent;
          } else {
            const ot = await ollamaResp.text();
            console.error(
              "[FALLBACK] Ollama also failed:",
              ollamaResp.status,
              ot,
            );
          }
        } catch (ollamaErr) {
          console.warn(
            `[FALLBACK] Ollama skipped or failed validation: ${ollamaErr.message}`,
          );
        }
      } else {
        if (!ollamaEnabled && ollamaEndpoint) {
          console.log(
            "[FALLBACK] Ollama endpoint configured but ENABLE_OLLAMA_FALLBACK is false. Skipping.",
          );
        }
      }
    }

    // Fallback logic could be thrown here to be caught by the outer task handler
    throw {
      status,
      error_code: status === 429
        ? "rate_limited"
        : (status === 401 || status === 403)
        ? "auth_error"
        : "network_error",
      message: activeConfig.isCustom
        ? "Your custom AI key failed."
        : "AI service returned an error.",
      raw: t,
      isCustom: activeConfig.isCustom,
    };
  }

  const aiResult = await response.json();
  const latencyMs = Date.now() - startTime;

  let content = "";
  let usage = aiResult.usage;

  if (activeConfig.adapter === "anthropic") {
    content = aiResult.content?.[0]?.text || "";
  } else {
    content = aiResult.choices?.[0]?.message?.content || "";
  }

  // Record generation metrics on the trace
  if (trace && usage) {
    const inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
    const outputTokens = usage.completion_tokens || usage.output_tokens || 0;
    trace.setGeneration({
      model: activeConfig.model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      latencyMs,
      costUsd: calculateCost(activeConfig.model, inputTokens, outputTokens),
      input: [{ role: "system", content: "[redacted]" }, {
        role: "user",
        content: userPrompt.slice(0, 500),
      }],
      output: content.slice(0, 500),
    });
  }

  llmSpan?.end({
    contentLength: content.length,
    latencyMs,
    inputTokens: usage?.prompt_tokens || usage?.input_tokens,
    outputTokens: usage?.completion_tokens || usage?.output_tokens,
  });

  return content;
}

function tryParseJson(raw: string): any | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export function parseAIJson(raw: string, defaults: object): any {
  const parsed = tryParseJson(raw);
  if (parsed && typeof parsed === "object") return parsed;
  return {
    ...defaults,
    warnings: ["AI response was not valid JSON; returning raw text."],
    _raw: raw,
  };
}

export function validateStructure(data: any, requiredKeys: string[]): boolean {
  if (typeof data !== "object" || data === null) return false;
  return requiredKeys.every((k) => k in data);
}
