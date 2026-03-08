import { streamText } from "ai";
import type { LanguageModel } from "ai";
import type { RewriteContext } from "./prompt";
import { buildRewritePrompt } from "./prompt";

export interface RewriteOptions extends RewriteContext {
  model: LanguageModel;
}

/**
 * Start a streaming text rewrite. Returns the streamText result object.
 *
 * The caller can consume via:
 * - `result.textStream` for async iteration / SSE
 * - `await result.text` for full text
 * - `result.toDataStreamResponse()` for Express SSE response
 */
export function rewriteText(options: RewriteOptions) {
  const { model, ...context } = options;
  const { system, user } = buildRewritePrompt(context);

  return streamText({
    model,
    system,
    prompt: user,
    temperature: 0.7,
  });
}

/**
 * Rewrite text and return the full result string.
 * Convenience wrapper around rewriteText that awaits completion.
 */
export async function rewriteTextFull(
  options: RewriteOptions,
): Promise<string> {
  const result = rewriteText(options);
  return await result.text;
}
