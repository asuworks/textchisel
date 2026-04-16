import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { mistral, createMistral } from "@ai-sdk/mistral";
import { cohere, createCohere } from "@ai-sdk/cohere";
import { xai, createXai } from "@ai-sdk/xai";
import { groq, createGroq } from "@ai-sdk/groq";
import { deepseek, createDeepSeek } from "@ai-sdk/deepseek";
import { cerebras, createCerebras } from "@ai-sdk/cerebras";
import { fireworks, createFireworks } from "@ai-sdk/fireworks";
import { togetherai, createTogetherAI } from "@ai-sdk/togetherai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { DEFAULT_MODEL } from "@shared/providers";
import type { Provider } from "@shared/providers";

/**
 * Create a LanguageModel from provider name, model ID, and optional credentials.
 * When apiKey is provided (from browser settings), it takes precedence over env vars.
 */
export function createModel(
  provider: Provider = "openai",
  modelId?: string,
  baseUrl?: string,
  apiKey?: string,
): ReturnType<typeof openai> {
  const fallback = DEFAULT_MODEL[provider];
  switch (provider) {
    case "openai": {
      if (apiKey || baseUrl) {
        const custom = createOpenAI({
          ...(apiKey ? { apiKey } : {}),
          ...(baseUrl ? { baseURL: baseUrl } : {}),
        });
        return custom(modelId ?? fallback);
      }
      return openai(modelId ?? fallback);
    }
    case "anthropic": {
      if (apiKey) {
        return createAnthropic({ apiKey })(modelId ?? fallback);
      }
      return anthropic(modelId ?? fallback);
    }
    case "google": {
      if (apiKey) {
        return createGoogleGenerativeAI({ apiKey })(modelId ?? fallback);
      }
      return google(modelId ?? fallback);
    }
    case "mistral": {
      if (apiKey) {
        return createMistral({ apiKey })(modelId ?? fallback);
      }
      return mistral(modelId ?? fallback);
    }
    case "cohere": {
      if (apiKey) {
        return createCohere({ apiKey })(modelId ?? fallback);
      }
      return cohere(modelId ?? fallback);
    }
    case "xai": {
      if (apiKey) {
        return createXai({ apiKey })(modelId ?? fallback);
      }
      return xai(modelId ?? fallback);
    }
    case "groq": {
      if (apiKey) {
        return createGroq({ apiKey })(modelId ?? fallback);
      }
      return groq(modelId ?? fallback);
    }
    case "deepseek": {
      if (apiKey) {
        return createDeepSeek({ apiKey })(modelId ?? fallback);
      }
      return deepseek(modelId ?? fallback);
    }
    case "cerebras": {
      if (apiKey) {
        return createCerebras({ apiKey })(modelId ?? fallback);
      }
      return cerebras(modelId ?? fallback);
    }
    case "fireworks": {
      if (apiKey) {
        return createFireworks({ apiKey })(modelId ?? fallback);
      }
      return fireworks(modelId ?? fallback);
    }
    case "togetherai": {
      if (apiKey) {
        return createTogetherAI({ apiKey })(modelId ?? fallback);
      }
      return togetherai(modelId ?? fallback);
    }
    case "openrouter": {
      const openrouter = createOpenRouter({
        apiKey: apiKey ?? process.env.OPENROUTER_API_KEY,
      });
      return openrouter.chat(modelId ?? fallback);
    }
    case "openai-compatible": {
      const custom = createOpenAI({
        baseURL: baseUrl || "http://localhost:11434/v1",
        apiKey: apiKey || "ollama",
      });
      return custom(modelId ?? fallback);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
