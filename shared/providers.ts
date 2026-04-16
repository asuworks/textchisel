/**
 * Provider Registry -- single source of truth for all LLM provider definitions.
 *
 * Both client (src/shell/) and server (server/) import from here.
 * Adding a new provider requires editing only this file + server/model.ts (SDK import).
 */

export type Provider =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "cohere"
  | "xai"
  | "groq"
  | "deepseek"
  | "cerebras"
  | "fireworks"
  | "togetherai"
  | "openrouter"
  | "openai-compatible";

/** Available models per provider, shown in the settings dropdown. */
export const PROVIDER_MODELS: Record<Provider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3", "o4-mini"],
  anthropic: [
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
  ],
  google: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview",
  ],
  mistral: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
  cohere: ["command-r-plus", "command-r", "command-light"],
  xai: ["grok-3", "grok-3-mini"],
  groq: ["llama-3.3-70b-versatile", "gemma2-9b-it", "mixtral-8x7b-32768"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  cerebras: ["llama-4-scout-17b-16e-instruct"],
  fireworks: [
    "accounts/fireworks/models/llama-v3p3-70b-instruct",
    "accounts/fireworks/models/mixtral-8x22b-instruct",
  ],
  togetherai: [
    "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  ],
  openrouter: [
    "anthropic/claude-sonnet-4",
    "google/gemini-2.5-flash",
    "meta-llama/llama-3.3-70b-instruct",
    "openai/gpt-4o",
  ],
  "openai-compatible": ["llama3", "mistral", "codellama", "gemma2"],
};

/** Display labels for the settings UI. */
export const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  mistral: "Mistral",
  cohere: "Cohere",
  xai: "xAI (Grok)",
  groq: "Groq",
  deepseek: "DeepSeek",
  cerebras: "Cerebras",
  fireworks: "Fireworks",
  togetherai: "Together AI",
  openrouter: "OpenRouter",
  "openai-compatible": "OpenAI Compatible (Ollama, LM Studio, etc.)",
};

/** API key placeholder hints per provider. */
export const PROVIDER_KEY_HINTS: Record<Provider, string> = {
  openai: "sk-...",
  anthropic: "sk-ant-...",
  google: "AI...",
  mistral: "...",
  cohere: "...",
  xai: "xai-...",
  groq: "gsk_...",
  deepseek: "sk-...",
  cerebras: "csk-...",
  fireworks: "fw_...",
  togetherai: "...",
  openrouter: "sk-or-...",
  "openai-compatible": "(optional)",
};

/** Default model per provider, used as fallback when no model is specified. */
export const DEFAULT_MODEL: Record<Provider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-2.5-flash",
  mistral: "mistral-large-latest",
  cohere: "command-r-plus",
  xai: "grok-3-mini",
  groq: "llama-3.3-70b-versatile",
  deepseek: "deepseek-chat",
  cerebras: "llama-4-scout-17b-16e-instruct",
  fireworks: "accounts/fireworks/models/llama-v3p3-70b-instruct",
  togetherai: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
  openrouter: "anthropic/claude-sonnet-4",
  "openai-compatible": "llama3",
};
