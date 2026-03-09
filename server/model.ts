import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Create a LanguageModel from provider name and model ID.
 * Defaults to openai/gpt-4o if not specified.
 */
export function createModel(
  provider: string = "openai",
  modelId?: string,
): LanguageModel {
  switch (provider) {
    case "openai":
      return openai(modelId ?? "gpt-4o");
    case "anthropic":
      return anthropic(modelId ?? "claude-sonnet-4-20250514");
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
