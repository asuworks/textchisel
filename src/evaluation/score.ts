import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { EvaluationScoreSchema } from "@shared/types";
import type { Dimension, EvaluationScore } from "@shared/types";

const SYSTEM_PROMPT = `You are a rigorous text evaluator. You will evaluate a piece of text on a single dimension.

Your evaluation must:
- Focus ONLY on the specified dimension
- The rubric defines what each score (1-5) means for THIS dimension — follow it exactly
- Dimensions may measure quantity, quality, style, or any other property — do not assume "higher = better quality"
- For example, if a rubric says "1=none, 5=many", score based on COUNT, not quality
- Provide a brief, specific justification referencing concrete aspects of the text

Be precise and literal. Match the rubric definitions exactly.`;

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

  let prompt: string;

  // Build calibration anchors from examples if available
  let examplesSection = "";
  if (dimension.examples) {
    const exampleLines = Object.entries(dimension.examples)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([level, ex]) => `  Level ${level}: "${ex}"`)
      .join("\n");
    examplesSection = `\n\nCalibration anchors (text that would score at each level):\n${exampleLines}`;
  }

  if (dimension.evalPrompt) {
    // Tier 1: use generated evaluation methodology
    prompt = `${dimension.evalPrompt}${examplesSection}

Text to evaluate:
"""
${text}
"""

Apply the methodology above. Keep your reasoning brief (2-3 sentences).`;
  } else {
    // Fallback: generic template
    let rubricSection = "";
    if (dimension.rubric) {
      const rubricLines = Object.entries(dimension.rubric)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([level, desc]) => `  ${level}: ${desc}`)
        .join("\n");
      rubricSection = `\n\nRubric:\n${rubricLines}`;
    }

    prompt = `Evaluate the following text on the dimension "${dimension.name}".

Dimension: ${dimension.name}
Description: ${dimension.description}${rubricSection}${examplesSection}

Text to evaluate:
"""
${text}
"""

Evaluate step-by-step:
(1) Quote the 1-2 specific passages most relevant to this dimension.
(2) Classify what you found against the rubric levels — which level does your evidence match?
(3) Assign the score that matches your evidence, not your overall quality impression.
Apply the rubric literally — do not default to a generic quality judgment. Keep your reasoning brief (2-3 sentences).`;
  }

  const { object } = await generateObject({
    model,
    schema: EvaluationScoreSchema,
    schemaName: "EvaluationScore",
    schemaDescription:
      "A score from 1-5 with reasoning for a single evaluation dimension",
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0,
    maxRetries: 3,
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
