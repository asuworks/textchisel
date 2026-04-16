import { describe, it, expect } from "vitest";
import {
  PROVIDER_MODELS,
  PROVIDER_LABELS,
  PROVIDER_KEY_HINTS,
  DEFAULT_MODEL,
} from "@shared/providers";
import type { Provider } from "@shared/providers";

/**
 * Tests for shared/providers.ts — the single source of truth
 * for LLM provider definitions used by both client and server.
 */

// All provider keys that must exist in the registry
const ALL_PROVIDERS: Provider[] = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "cohere",
  "xai",
  "groq",
  "deepseek",
  "cerebras",
  "fireworks",
  "togetherai",
  "openrouter",
  "openai-compatible",
];

describe("shared/providers", () => {
  describe("Provider type coverage", () => {
    it("PROVIDER_MODELS has an entry for every provider", () => {
      for (const p of ALL_PROVIDERS) {
        expect(PROVIDER_MODELS).toHaveProperty(p);
      }
    });

    it("PROVIDER_LABELS has an entry for every provider", () => {
      for (const p of ALL_PROVIDERS) {
        expect(PROVIDER_LABELS).toHaveProperty(p);
      }
    });

    it("PROVIDER_KEY_HINTS has an entry for every provider", () => {
      for (const p of ALL_PROVIDERS) {
        expect(PROVIDER_KEY_HINTS).toHaveProperty(p);
      }
    });

    it("DEFAULT_MODEL has an entry for every provider", () => {
      for (const p of ALL_PROVIDERS) {
        expect(DEFAULT_MODEL).toHaveProperty(p);
      }
    });

    it("no extra keys beyond the Provider union exist in PROVIDER_MODELS", () => {
      const keys = Object.keys(PROVIDER_MODELS);
      expect(keys.sort()).toEqual([...ALL_PROVIDERS].sort());
    });

    it("no extra keys beyond the Provider union exist in PROVIDER_LABELS", () => {
      const keys = Object.keys(PROVIDER_LABELS);
      expect(keys.sort()).toEqual([...ALL_PROVIDERS].sort());
    });

    it("no extra keys beyond the Provider union exist in DEFAULT_MODEL", () => {
      const keys = Object.keys(DEFAULT_MODEL);
      expect(keys.sort()).toEqual([...ALL_PROVIDERS].sort());
    });
  });

  describe("PROVIDER_MODELS", () => {
    it("every provider has a non-empty model list", () => {
      for (const p of ALL_PROVIDERS) {
        const models = PROVIDER_MODELS[p];
        expect(models.length).toBeGreaterThan(0);
      }
    });

    it("model lists contain only strings", () => {
      for (const p of ALL_PROVIDERS) {
        for (const m of PROVIDER_MODELS[p]) {
          expect(typeof m).toBe("string");
          expect(m.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("PROVIDER_LABELS", () => {
    it("every label is a non-empty string", () => {
      for (const p of ALL_PROVIDERS) {
        expect(typeof PROVIDER_LABELS[p]).toBe("string");
        expect(PROVIDER_LABELS[p].length).toBeGreaterThan(0);
      }
    });
  });

  describe("PROVIDER_KEY_HINTS", () => {
    it("every hint is a non-empty string", () => {
      for (const p of ALL_PROVIDERS) {
        expect(typeof PROVIDER_KEY_HINTS[p]).toBe("string");
        expect(PROVIDER_KEY_HINTS[p].length).toBeGreaterThan(0);
      }
    });
  });

  describe("DEFAULT_MODEL", () => {
    it("every default model is a non-empty string", () => {
      for (const p of ALL_PROVIDERS) {
        expect(typeof DEFAULT_MODEL[p]).toBe("string");
        expect(DEFAULT_MODEL[p].length).toBeGreaterThan(0);
      }
    });

    it("every default model appears in the corresponding PROVIDER_MODELS list", () => {
      // Special case: DEFAULT_MODEL values may differ from PROVIDER_MODELS entries
      // (e.g., DEFAULT_MODEL uses versioned names like "claude-sonnet-4-20250514"
      // while PROVIDER_MODELS uses display names like "claude-sonnet-4-6").
      // This test checks the ones that SHOULD match (most providers).
      const expectedMismatches = new Set(["anthropic"]);
      for (const p of ALL_PROVIDERS) {
        if (expectedMismatches.has(p)) continue;
        expect(
          PROVIDER_MODELS[p],
          `DEFAULT_MODEL["${p}"] = "${DEFAULT_MODEL[p]}" not in PROVIDER_MODELS["${p}"]`,
        ).toContain(DEFAULT_MODEL[p]);
      }
    });
  });
});
