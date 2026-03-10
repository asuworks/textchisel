import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { mistral } from "@ai-sdk/mistral";
import { cohere } from "@ai-sdk/cohere";
import { xai } from "@ai-sdk/xai";
import { groq } from "@ai-sdk/groq";
import { deepseek } from "@ai-sdk/deepseek";
import { cerebras } from "@ai-sdk/cerebras";
import { fireworks } from "@ai-sdk/fireworks";
import { togetherai } from "@ai-sdk/togetherai";
import { perplexity } from "@ai-sdk/perplexity";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
/**
 * Create a LanguageModel from provider name and model ID.
 * Defaults to openai/gpt-4o if not specified.
 *
 * Note: providers v1.x return LanguageModelV1 but ai@6 expects V2/V3.
 * AI SDK functions accept both at runtime; assertion avoids upgrading all providers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createModel(
  provider: string = "openai",
  modelId?: string,
): any {
  switch (provider) {
    case "openai":
      return openai(modelId ?? "gpt-4o");
    case "anthropic":
      return anthropic(modelId ?? "claude-sonnet-4-20250514");
    case "google":
      return google(modelId ?? "gemini-2.5-flash");
    case "mistral":
      return mistral(modelId ?? "mistral-large-latest");
    case "cohere":
      return cohere(modelId ?? "command-r-plus");
    case "xai":
      return xai(modelId ?? "grok-3-mini");
    case "groq":
      return groq(modelId ?? "llama-3.3-70b-versatile");
    case "deepseek":
      return deepseek(modelId ?? "deepseek-chat");
    case "cerebras":
      return cerebras(modelId ?? "llama-4-scout-17b-16e-instruct");
    case "fireworks":
      return fireworks(
        modelId ?? "accounts/fireworks/models/llama-v3p3-70b-instruct",
      );
    case "togetherai":
      return togetherai(
        modelId ?? "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      );
    case "perplexity":
      return perplexity(modelId ?? "sonar-pro");
    case "openrouter": {
      const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
      });
      return openrouter.chat(modelId ?? "anthropic/claude-sonnet-4");
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
