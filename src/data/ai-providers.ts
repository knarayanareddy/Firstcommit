// ─── AI Providers Catalogue (March 15, 2026) ─────────────────────────────────
// Used by the BYOK settings UI and the useAISettings hook.
// Keep model IDs in sync with the ai-task-router provider routing table.

export type CompatibilityType = "native_openai" | "adapted" | "sdk";
export type ModelTier = "flagship" | "frontier" | "balanced" | "fast" | "edge" | "reasoning" | "coding";

export interface AIModel {
  id: string;
  label: string;
  context: number; // tokens
  tier: ModelTier;
  available?: boolean;    // false = show "Coming soon" badge, unselectable
  coming_soon?: boolean;  // alias for clarity
  pricing_hint?: string;  // e.g. "$0.28/MTok input"
}

export interface AIProvider {
  label: string;
  keyUrl: string;
  docsUrl?: string;
  compatibility: CompatibilityType;
  keyFormat?: string;       // regex hint for client-side format validation
  keyPlaceholder?: string;  // shown in the input field
  models: AIModel[];
}

// ─── PLATFORM DEFAULT ─────────────────────────────────────────────────────────
export const PLATFORM_DEFAULT = {
  provider: "local" as const,
  model: "llama3" as const,
  label: "Local LLM (Ollama / llama.cpp)",
  note: "Self-hosted OpenAI-compatible endpoint. No external key or vendor required.",
};

// ─── PROVIDER CATALOGUE ───────────────────────────────────────────────────────
export const AI_PROVIDERS: Record<string, AIProvider> = {

  // ── TIER 0: LOCAL / SELF-HOSTED (no key; OpenAI-compatible Ollama / llama.cpp) ──
  local: {
    label: "Local (Ollama / llama.cpp)",
    keyUrl: "https://ollama.com",
    docsUrl: "https://docs.ollama.com/api/openai-compatibility",
    compatibility: "native_openai",
    keyPlaceholder: "(no key needed \u2014 endpoint configured server-side)",
    models: [
      { id: "llama3",      label: "Llama 3 (local)",     context: 8_192,  tier: "balanced" },
      { id: "qwen2.5",     label: "Qwen 2.5 (local)",    context: 32_768, tier: "balanced" },
      { id: "mistral",     label: "Mistral (local)",     context: 32_768, tier: "fast" },
      { id: "deepseek-r1", label: "DeepSeek R1 (local)", context: 65_536, tier: "reasoning" },
    ],
  },

  // ── TIER 1: PROPRIETARY FRONTIER ──────────────────────────────────────────

  openai: {
    label: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    docsUrl: "https://platform.openai.com/docs",
    compatibility: "native_openai",
    keyPlaceholder: "sk-...",
    keyFormat: "^sk-[A-Za-z0-9\\-_]{32,}$",
    models: [
      {
        id: "gpt-5.4",
        label: "GPT-5.4 Thinking",
        context: 1_000_000,
        tier: "flagship",
        pricing_hint: "Reasoning / agentic workflows",
      },
      {
        id: "gpt-5.4-pro",
        label: "GPT-5.4 Pro",
        context: 1_000_000,
        tier: "flagship",
        pricing_hint: "Maximum capability",
      },
      {
        id: "gpt-5.2",
        label: "GPT-5.2",
        context: 400_000,
        tier: "frontier",
        pricing_hint: "Professional knowledge work",
      },
      {
        id: "gpt-5.3-instant",
        label: "GPT-5.3 Instant",
        context: 200_000,
        tier: "fast",
        pricing_hint: "Fast, everyday tasks",
      },
      {
        id: "o4-mini",
        label: "o4-mini",
        context: 200_000,
        tier: "reasoning",
        pricing_hint: "$1.10 / $4.40 per MTok",
      },
    ],
  },

  anthropic: {
    label: "Anthropic",
    keyUrl: "https://console.anthropic.com",
    docsUrl: "https://docs.anthropic.com",
    compatibility: "adapted",
    keyPlaceholder: "sk-ant-...",
    keyFormat: "^sk-ant-[A-Za-z0-9\\-_]{32,}$",
    models: [
      {
        id: "claude-opus-4.6",
        label: "Claude Opus 4.6",
        context: 1_000_000,
        tier: "flagship",
        pricing_hint: "Deep reasoning, long-horizon tasks",
      },
      {
        id: "claude-sonnet-4.6",
        label: "Claude Sonnet 4.6",
        context: 200_000,
        tier: "balanced",
        pricing_hint: "New default — near-Opus coding & docs",
      },
      {
        id: "claude-haiku-4.5",
        label: "Claude Haiku 4.5",
        context: 200_000,
        tier: "fast",
        pricing_hint: "Speed-optimised, high-volume",
      },
      // NOTE: Claude Opus 4 and 4.1 removed by Anthropic March 2026 — not listed.
    ],
  },

  google: {
    label: "Google Gemini",
    keyUrl: "https://aistudio.google.dev",
    docsUrl: "https://ai.google.dev/docs",
    compatibility: "adapted",
    keyPlaceholder: "AIza...",
    keyFormat: "^AIza[A-Za-z0-9\\-_]{35}$",
    models: [
      {
        id: "gemini-3.1-pro",
        label: "Gemini 3.1 Pro",
        context: 1_000_000,
        tier: "flagship",
        pricing_hint: "Complex problem-solving",
      },
      {
        id: "gemini-3-flash",
        label: "Gemini 3 Flash",
        context: 1_000_000,
        tier: "balanced",
        pricing_hint: "Platform default — fast & capable",
      },
      {
        id: "gemini-3.1-flash-lite",
        label: "Gemini 3.1 Flash Lite",
        context: 1_000_000,
        tier: "fast",
        pricing_hint: "$0.25 / $1.50 per MTok (preview)",
      },
      // NOTE: gemini-3-pro-preview shut down March 9 2026 — alias now → 3.1 Pro. NOT listed.
    ],
  },

  mistral: {
    label: "Mistral",
    keyUrl: "https://console.mistral.ai",
    docsUrl: "https://docs.mistral.ai",
    compatibility: "native_openai",
    keyPlaceholder: "...",
    models: [
      { id: "mistral-large-2512",       label: "Mistral Large 3 (41B/675B MoE)", context: 256_000, tier: "flagship" },
      { id: "ministral-14b-2512",       label: "Ministral 3 14B",                context: 128_000, tier: "balanced" },
      { id: "ministral-8b-2512",        label: "Ministral 3 8B",                 context: 128_000, tier: "fast" },
      { id: "ministral-3b-2512",        label: "Ministral 3 3B",                 context: 128_000, tier: "edge" },
      { id: "devstral-2512",            label: "Devstral 2 (123B)",              context: 256_000, tier: "coding" },
      { id: "labs-devstral-small-2512", label: "Devstral Small 2 (24B)",         context: 256_000, tier: "coding" },
    ],
  },

  // ── TIER 2: ADDITIONAL PROPRIETARY ────────────────────────────────────────

  xai: {
    label: "xAI",
    keyUrl: "https://console.x.ai",
    docsUrl: "https://docs.x.ai",
    compatibility: "native_openai",
    keyPlaceholder: "xai-...",
    keyFormat: "^xai-[A-Za-z0-9\\-_]{32,}$",
    models: [
      {
        id: "grok-4-1-fast",
        label: "Grok 4.1 Fast",
        context: 2_000_000,
        tier: "fast",
        available: true,
      },
      {
        id: "grok-4-heavy",
        label: "Grok 4 Heavy",
        context: 2_000_000,
        tier: "flagship",
        available: true,
        pricing_hint: "Multi-agent reasoning",
      },
      {
        id: "grok-4.20",
        label: "Grok 4.20",
        context: 2_000_000,
        tier: "flagship",
        available: false, // API not yet public — shows "Coming soon" badge
        coming_soon: true,
      },
    ],
  },

  cohere: {
    label: "Cohere",
    keyUrl: "https://dashboard.cohere.com",
    docsUrl: "https://docs.cohere.com",
    compatibility: "adapted",
    keyPlaceholder: "...",
    models: [
      { id: "command-a",           label: "Command A",           context: 256_000, tier: "flagship" },
      { id: "command-a-reasoning", label: "Command A Reasoning", context: 256_000, tier: "reasoning" },
    ],
  },

  // NOTE: Amazon Bedrock uses AWS IAM (3 fields) — deferred to v2.

  // ── TIER 3: OPEN-WEIGHT (direct API) ──────────────────────────────────────

  deepseek: {
    label: "DeepSeek",
    keyUrl: "https://platform.deepseek.com",
    docsUrl: "https://platform.deepseek.com/docs",
    compatibility: "native_openai",
    keyPlaceholder: "sk-...",
    models: [
      {
        id: "deepseek-chat",
        label: "DeepSeek V3.2",
        context: 131_000,
        tier: "flagship",
        pricing_hint: "$0.28 / $0.42 per MTok",
      },
      {
        id: "deepseek-reasoner",
        label: "DeepSeek R1",
        context: 131_000,
        tier: "reasoning",
      },
      {
        id: "deepseek-v4",
        label: "DeepSeek V4",
        context: 1_000_000,
        tier: "flagship",
        available: false,
        coming_soon: true,
        pricing_hint: "1T params, multimodal — coming soon",
      },
    ],
  },

  // ── TIER 4: INFERENCE PLATFORMS (OpenAI-compatible; host open-weight models) ──

  groq: {
    label: "Groq",
    keyUrl: "https://console.groq.com/keys",
    docsUrl: "https://console.groq.com/docs/openai",
    compatibility: "native_openai",
    keyPlaceholder: "gsk_...",
    models: [
      { id: "llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout (17B×16E)",     context: 131_000, tier: "fast" },
      { id: "llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick (17B×128E)", context: 131_000, tier: "balanced" },
      { id: "deepseek-r1-distill-llama-70b",      label: "DeepSeek R1 (Groq)",           context: 131_000, tier: "reasoning" },
      { id: "qwen-qwq-32b",                       label: "Qwen QwQ 32B",                 context: 131_000, tier: "reasoning" },
    ],
  },

  fireworks: {
    label: "Fireworks AI",
    keyUrl: "https://fireworks.ai/account/api-keys",
    docsUrl: "https://docs.fireworks.ai",
    compatibility: "native_openai",
    keyPlaceholder: "fw_...",
    models: [
      { id: "accounts/fireworks/models/llama-4-maverick-instruct-basic",   label: "Llama 4 Maverick",          context: 131_000, tier: "balanced" },
      { id: "accounts/fireworks/models/deepseek-v3",                       label: "DeepSeek V3.2 (Fireworks)", context: 131_000, tier: "flagship" },
      { id: "accounts/fireworks/models/qwen3-235b-a22b",                   label: "Qwen3-235B-A22B",           context: 131_000, tier: "flagship" },
    ],
  },

  together: {
    label: "Together AI",
    keyUrl: "https://api.together.xyz/settings/api-keys",
    docsUrl: "https://docs.together.ai",
    compatibility: "native_openai",
    keyPlaceholder: "...",
    models: [
      { id: "meta-llama/Llama-4-Scout-17B-16E-Instruct",      label: "Llama 4 Scout",                context: 131_000, tier: "fast" },
      { id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct",  label: "Llama 4 Maverick",             context: 131_000, tier: "balanced" },
      { id: "deepseek-ai/DeepSeek-V3",                         label: "DeepSeek V3.2 (Together)",     context: 131_000, tier: "flagship" },
      { id: "Qwen/Qwen3-235B-A22B-fp8-moe-tput",              label: "Qwen3-235B-A22B (Together)",   context: 131_000, tier: "flagship" },
    ],
  },

  sambanova: {
    label: "SambaNova",
    keyUrl: "https://cloud.sambanova.ai/apis",
    docsUrl: "https://community.sambanova.ai/c/docs",
    compatibility: "native_openai",
    keyPlaceholder: "...",
    models: [
      { id: "Meta-Llama-4-Scout-17B-16E-Instruct",    label: "Llama 4 Scout (SambaNova)",    context: 131_000, tier: "fast" },
      { id: "Meta-Llama-4-Maverick-17B-128E-Instruct", label: "Llama 4 Maverick (SambaNova)", context: 131_000, tier: "balanced" },
      { id: "DeepSeek-V3-0324",                        label: "DeepSeek V3.2 (SambaNova)",    context: 131_000, tier: "flagship" },
    ],
  },

  cerebras: {
    label: "Cerebras",
    keyUrl: "https://cloud.cerebras.ai",
    docsUrl: "https://inference-docs.cerebras.ai",
    compatibility: "native_openai",
    keyPlaceholder: "csk-...",
    keyFormat: "^csk-[A-Za-z0-9\\-_]{32,}$",
    models: [
      { id: "llama-4-scout-17b-16e-instruct",     label: "Llama 4 Scout (Cerebras)",    context: 131_000, tier: "fast",     pricing_hint: "Ultra-fast Wafer-Scale" },
      { id: "llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick (Cerebras)", context: 131_000, tier: "balanced", pricing_hint: "Ultra-fast Wafer-Scale" },
      { id: "deepseek-r1-distill-llama-70b",      label: "DeepSeek R1 (Cerebras)",      context: 131_000, tier: "reasoning" },
    ],
  },
};

// ─── TIER GROUPING FOR UI ─────────────────────────────────────────────────────
export const PROVIDER_TIERS: { label: string; keys: string[] }[] = [
  {
    label: "Tier 0 \u2014 Local / Self-hosted",
    keys: ["local"],
  },
  {
    label: "Tier 1 — Proprietary Frontier",
    keys: ["openai", "anthropic", "google", "mistral"],
  },
  {
    label: "Tier 2 — Additional Proprietary",
    keys: ["xai", "cohere"],
  },
  {
    label: "Tier 3 — Open Weight (direct API)",
    keys: ["deepseek"],
  },
  {
    label: "Tier 4 — Inference Platforms",
    keys: ["groq", "fireworks", "together", "sambanova", "cerebras"],
  },
];

// ─── PROVIDER ROUTING ENDPOINTS ───────────────────────────────────────────────
// Used by the edge function to resolve the correct API base URL.
export const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai:    "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",         // adapted
  google:    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", // OpenAI compat layer
  mistral:   "https://api.mistral.ai/v1/chat/completions",
  xai:       "https://api.x.ai/v1/chat/completions",
  cohere:    "https://api.cohere.com/compatibility/v1/chat/completions", // OpenAI compat
  deepseek:  "https://api.deepseek.com/chat/completions",
  groq:      "https://api.groq.com/openai/v1/chat/completions",
  fireworks: "https://api.fireworks.ai/inference/v1/chat/completions",
  together:  "https://api.together.xyz/v1/chat/completions",
  sambanova: "https://api.sambanova.ai/v1/chat/completions",
  cerebras:  "https://api.cerebras.ai/v1/chat/completions",
  ollama:    "http://localhost:11434/v1/chat/completions",
  local:     "http://localhost:11434/v1/chat/completions",
  // De-Lovable: default routes to the self-hosted local LLM (configure via env in the edge runtime).
  default:   "http://localhost:11434/v1/chat/completions",
};
