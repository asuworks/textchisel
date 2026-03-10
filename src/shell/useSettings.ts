import { useSyncExternalStore, useCallback } from "react";

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

export interface AppSettings {
  apiKey: string;
  provider: Provider;
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

const STORAGE_KEY = "textchisel-settings";

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  provider: "openai",
  model: "gpt-4o",
  baseUrl: "",
  temperature: 0.7,
  maxTokens: 4096,
};

const MODELS: Record<Provider, string[]> = {
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

/** Display labels for providers */
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

/** API key placeholder hints per provider */
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

export function getModelsForProvider(provider: Provider) {
  return MODELS[provider] ?? MODELS.openai;
}

/** Read current settings and return a ModelConfig for API calls. */
export function getModelConfig() {
  const s = readSettings();
  return {
    provider: s.provider,
    modelId: s.model,
    ...(s.baseUrl ? { baseUrl: s.baseUrl } : {}),
    ...(s.apiKey ? { apiKey: s.apiKey } : {}),
    temperature: s.temperature,
    maxTokens: s.maxTokens,
  };
}

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function writeSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  // Notify listeners
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

let cache: AppSettings = readSettings();

function subscribe(cb: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cache = readSettings();
      cb();
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getSnapshot() {
  return cache;
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    const prev = readSettings();
    const next = { ...prev, ...updates };
    // Reset model only when provider actually changed AND no explicit model in update
    if (
      updates.provider &&
      updates.provider !== prev.provider &&
      !updates.model
    ) {
      next.model = MODELS[next.provider][0];
    }
    cache = next;
    writeSettings(next);
  }, []);

  return { settings, updateSettings };
}
