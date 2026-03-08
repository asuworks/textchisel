import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import {
  DimensionGenerationSchema,
  type GeneratedDimensions,
} from "@shared/types";

const SYSTEM_PROMPT = `You are an expert writing evaluator. Given a user's writing intent, generate 4 to 6 evaluation dimensions that can be used to score and improve text written with that intent.

Each dimension should:
- Be independent and cover a different aspect of writing quality relevant to the intent
- Have a clear, concise name (2-4 words)
- Have a description explaining what this dimension measures
- Include a rubric with keys "1" through "5" describing quality levels from worst to best

The rubric levels should be:
- "1": Lowest quality — significant deficiencies
- "2": Below average — noticeable weaknesses
- "3": Adequate — meets basic expectations
- "4": Good — exceeds expectations in meaningful ways
- "5": Excellent — exemplary quality

Make dimensions specific to the user's stated intent. Avoid generic dimensions that would apply to any text. Each dimension should be independently measurable — high performance on one should not imply high performance on another.`;

export interface GenerateDimensionsOptions {
  model: LanguageModel;
}

/**
 * Generate evaluation dimensions from a user's writing intent using Vercel AI SDK.
 *
 * This function runs SERVER-SIDE (called from Express routes).
 *
 * @param intent - The user's writing intent / description
 * @param options - Options including the AI model to use
 * @returns Generated dimensions with names, descriptions, and rubrics
 */
export async function generateDimensions(
  intent: string,
  options: GenerateDimensionsOptions,
): Promise<GeneratedDimensions> {
  if (!intent || intent.trim().length === 0) {
    throw new Error("Intent must be a non-empty string");
  }

  const { object } = await generateObject({
    model: options.model,
    schema: DimensionGenerationSchema,
    schemaName: "DimensionGeneration",
    schemaDescription:
      "Evaluation dimensions for scoring text against a writing intent",
    system: SYSTEM_PROMPT,
    prompt: `Generate evaluation dimensions for text written with the following intent:\n\n"${intent}"`,
    temperature: 0.7,
  });

  return object;
}
