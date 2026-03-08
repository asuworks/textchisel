import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { EvaluationScoreSchema } from "@shared/types";
import type { Dimension, EvaluationScore } from "@shared/types";

const SYSTEM_PROMPT = `You are a rigorous text evaluator using the G-Eval framework. You will evaluate a piece of text on a single quality dimension.

Your evaluation must:
- Focus ONLY on the specified dimension
- Use the provided rubric (if available) to calibrate your score
- Assign an integer score from 1 (lowest) to 5 (highest)
- Provide a brief, specific justification referencing concrete aspects of the text

Be precise and consistent. Do not let one dimension influence another.`;

interface ScoreDimensionInput {
  text: string;
  dimension: Dimension;
  model: LanguageModel;
}

/**
 * Score a single dimension for a given text using G-Eval style prompting.
 *
 * Uses Vercel AI SDK `generateObject` with `EvaluationScoreSchema` to produce
 * a structured { score, reasoning } result.
 *
 * This function runs SERVER-SIDE (called from Express routes or orchestrator).
 *
 * @param input.text - The text to evaluate
 * @param input.dimension - The dimension to score against
 * @param input.model - The AI model to use
 * @returns EvaluationScore with integer score 1-5 and reasoning
 */
export async function scoreDimension(
  input: ScoreDimensionInput,
): Promise<EvaluationScore> {
  const { text, dimension, model } = input;

  let rubricSection = "";
  if (dimension.rubric) {
    const rubricLines = Object.entries(dimension.rubric)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([level, desc]) => `  ${level}: ${desc}`)
      .join("\n");
    rubricSection = `\n\nRubric:\n${rubricLines}`;
  }

  const prompt = `Evaluate the following text on the dimension "${dimension.name}".

Dimension: ${dimension.name}
Description: ${dimension.description}${rubricSection}

Text to evaluate:
"""
${text}
"""

Score the text from 1 to 5 on this dimension and provide brief reasoning.`;

  const { object } = await generateObject({
    model,
    schema: EvaluationScoreSchema,
    schemaName: "EvaluationScore",
    schemaDescription:
      "A score from 1-5 with reasoning for a single evaluation dimension",
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0,
  });

  return object;
}

interface ScoreAllDimensionsInput {
  text: string;
  dimensions: Dimension[];
  model: LanguageModel;
}

/**
 * Score all dimensions in parallel for a given text.
 *
 * Calls `scoreDimension` for each dimension via `Promise.all` and returns
 * a Map keyed by dimension ID.
 *
 * @param input.text - The text to evaluate
 * @param input.dimensions - All dimensions to score
 * @param input.model - The AI model to use
 * @returns Map from dimension ID to EvaluationScore
 */
export async function scoreAllDimensions(
  input: ScoreAllDimensionsInput,
): Promise<Map<string, EvaluationScore>> {
  const { text, dimensions, model } = input;

  if (dimensions.length === 0) {
    return new Map();
  }

  const results = await Promise.all(
    dimensions.map(async (dimension) => {
      const score = await scoreDimension({ text, dimension, model });
      return [dimension.id, score] as const;
    }),
  );

  return new Map(results);
}
