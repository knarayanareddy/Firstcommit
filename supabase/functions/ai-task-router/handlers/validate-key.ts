// @ts-nocheck
/**
 * handlers/validate-key.ts — `validate_key` task handler (monolith split, stage 4b).
 *
 * Validates a BYOK provider/api_key pair by making a minimal test call against the
 * provider endpoint. Dispatched via an early path in index.ts (before auth/preprocess),
 * so it deliberately runs without the grounding pipeline.
 */
import { errorResponse, jsonResponse } from "../responses.ts";
import { callAI, PROVIDER_ENDPOINTS } from "../ai-call.ts";
import type { AIConfig } from "../ai-call.ts";

export async function handleValidateKey(
  envelope: any,
  headers: Record<string, string>,
): Promise<Response> {
  const { provider, api_key, model } = envelope;
  if (!provider || !api_key) {
    return errorResponse(
      400,
      { error: "Missing provider or api_key" },
      headers,
    );
  }

  const endpointData = PROVIDER_ENDPOINTS[provider] ||
    PROVIDER_ENDPOINTS.openai;
  const config: AIConfig = {
    provider,
    model: model || "gpt-5.3-instant", // fallback
    endpoint: endpointData.url,
    apiKey: api_key,
    isCustom: true,
    adapter: endpointData.adapter,
  };

  try {
    // Make a minimal test call to validate
    await callAI(
      `You are an API key validation bot. Reply with 'valid'.`,
      `Ping.`,
      undefined,
      config,
    );
    return jsonResponse({
      type: "success",
      message: "Key validated successfully",
    }, headers);
  } catch (e: any) {
    console.warn("Key validation failed:", e.message, e.raw);
    return jsonResponse({
      type: "error",
      message: `Key validation failed: ${e.message}`,
    }, headers);
  }
}
