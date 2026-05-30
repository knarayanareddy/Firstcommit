/**
 * ai-call.ts — BYOK config resolution + provider endpoint table (monolith split, stage 2a).
 *
 * Extracted verbatim from index.ts; behavior unchanged. callAI + agentic review + JSON
 * parsers follow in stage 2b.
 */
import { createServiceClient } from "../_shared/supabase-clients.ts";

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
  ollama: { url: (Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1") + "/chat/completions" },
  local: { url: (Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1") + "/chat/completions" },
  // De-Lovable: default is now the configured self-hosted/local OpenAI-compatible endpoint.
  default: {
    url: Deno.env.get("DEFAULT_LLM_ENDPOINT") ||
      (Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1") + "/chat/completions",
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
