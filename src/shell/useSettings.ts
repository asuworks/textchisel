import { useSyncExternalStore, useCallback } from "react";
import {
  PROVIDER_MODELS,
  PROVIDER_LABELS,
  PROVIDER_KEY_HINTS,
} from "@shared/providers";
import type { Provider } from "@shared/providers";

// Re-export for backward compatibility (SettingsDialog, etc. import from here)
export type { Provider };
export { PROVIDER_LABELS, PROVIDER_KEY_HINTS };

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

export function getModelsForProvider(provider: Provider) {
  return PROVIDER_MODELS[provider] ?? PROVIDER_MODELS.openai;
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
      next.model = PROVIDER_MODELS[next.provider][0];
    }
    cache = next;
    writeSettings(next);
  }, []);

  return { settings, updateSettings };
}
