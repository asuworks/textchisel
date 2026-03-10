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

/**
 * Create a LanguageModel from provider name, model ID, and optional credentials.
 * When apiKey is provided (from browser settings), it takes precedence over env vars.
 */
export function createModel(
  provider: string = "openai",
  modelId?: string,
  baseUrl?: string,
  apiKey?: string,
): ReturnType<typeof openai> {
  switch (provider) {
    case "openai": {
      if (apiKey || baseUrl) {
        const custom = createOpenAI({
          ...(apiKey ? { apiKey } : {}),
          ...(baseUrl ? { baseURL: baseUrl } : {}),
        });
        return custom(modelId ?? "gpt-4o");
      }
      return openai(modelId ?? "gpt-4o");
    }
    case "anthropic": {
      if (apiKey) {
        return createAnthropic({ apiKey })(
          modelId ?? "claude-sonnet-4-20250514",
        );
      }
      return anthropic(modelId ?? "claude-sonnet-4-20250514");
    }
    case "google": {
      if (apiKey) {
        return createGoogleGenerativeAI({ apiKey })(
          modelId ?? "gemini-2.5-flash",
        );
      }
      return google(modelId ?? "gemini-2.5-flash");
    }
    case "mistral": {
      if (apiKey) {
        return createMistral({ apiKey })(modelId ?? "mistral-large-latest");
      }
      return mistral(modelId ?? "mistral-large-latest");
    }
    case "cohere": {
      if (apiKey) {
        return createCohere({ apiKey })(modelId ?? "command-r-plus");
      }
      return cohere(modelId ?? "command-r-plus");
    }
    case "xai": {
      if (apiKey) {
        return createXai({ apiKey })(modelId ?? "grok-3-mini");
      }
      return xai(modelId ?? "grok-3-mini");
    }
    case "groq": {
      if (apiKey) {
        return createGroq({ apiKey })(modelId ?? "llama-3.3-70b-versatile");
      }
      return groq(modelId ?? "llama-3.3-70b-versatile");
    }
    case "deepseek": {
      if (apiKey) {
        return createDeepSeek({ apiKey })(modelId ?? "deepseek-chat");
      }
      return deepseek(modelId ?? "deepseek-chat");
    }
    case "cerebras": {
      if (apiKey) {
        return createCerebras({ apiKey })(
          modelId ?? "llama-4-scout-17b-16e-instruct",
        );
      }
      return cerebras(modelId ?? "llama-4-scout-17b-16e-instruct");
    }
    case "fireworks": {
      if (apiKey) {
        return createFireworks({ apiKey })(
          modelId ?? "accounts/fireworks/models/llama-v3p3-70b-instruct",
        );
      }
      return fireworks(
        modelId ?? "accounts/fireworks/models/llama-v3p3-70b-instruct",
      );
    }
    case "togetherai": {
      if (apiKey) {
        return createTogetherAI({ apiKey })(
          modelId ?? "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
        );
      }
      return togetherai(
        modelId ?? "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      );
    }
    case "openrouter": {
      const openrouter = createOpenRouter({
        apiKey: apiKey ?? process.env.OPENROUTER_API_KEY,
      });
      return openrouter.chat(modelId ?? "anthropic/claude-sonnet-4");
    }
    case "openai-compatible": {
      const custom = createOpenAI({
        baseURL: baseUrl || "http://localhost:11434/v1",
        apiKey: apiKey || "ollama",
      });
      return custom(modelId ?? "llama3");
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
