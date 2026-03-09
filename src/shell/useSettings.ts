import { useSyncExternalStore, useCallback } from "react";

export interface AppSettings {
  apiKey: string;
  provider: "openai" | "anthropic";
  model: string;
}

const STORAGE_KEY = "textchisel-settings";

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  provider: "openai",
  model: "gpt-4o",
};

const MODELS: Record<AppSettings["provider"], string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
};

export function getModelsForProvider(provider: AppSettings["provider"]) {
  return MODELS[provider];
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
    const next = { ...readSettings(), ...updates };
    // Reset model when provider changes if current model isn't valid
    if (updates.provider && !MODELS[next.provider].includes(next.model)) {
      next.model = MODELS[next.provider][0];
    }
    cache = next;
    writeSettings(next);
  }, []);

  return { settings, updateSettings };
}
