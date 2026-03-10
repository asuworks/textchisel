import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { DimensionPromptsSchema } from "@shared/types";
import type { DimensionPrompts } from "@shared/types";

const SYSTEM_PROMPT = `You generate evaluation and rewriting prompts for a text quality dimension.

Given a dimension (name, description, rubric levels) and the user's writing intent, produce:

1. **evalPrompt** — A step-by-step evaluation methodology that tells an LLM exactly HOW to evaluate text on this dimension. Must include:
   - What to look for (counts, patterns, classifications, ratios, simulations, etc.)
   - Concrete steps to follow (not just "rate from 1-5")
   - How to map evidence to each rubric level
   - Instruction to cite specific evidence from the text

   Example for a count-based dimension "Dash Usage" with rubric {1:"0 dashes", 5:"7+ dashes"}:
   "Count every em dash (—), en dash (–), and space-separated hyphen (- used as dash) in the text. Do not count hyphens in compound words (e.g., 'well-known'). After counting, map: 0→score 1, 1-2→score 2, 3-4→score 3, 5-6→score 4, 7+→score 5. In your reasoning, list each dash found with surrounding context."

2. **rewriteHint** — A writing guide explaining what this dimension controls and how to adjust text at each level. Written as craft-level advice, not as a rubric table. Should tell a writer what concrete changes to make.

   Example for "Dash Usage":
   "This dimension controls dash frequency. Dashes create emphasis, signal mid-sentence shifts, and fragment thoughts. At level 1 (none): use complete sentences, no interruptions. At level 3 (moderate): insert 3-4 dashes at natural pause points in longer sentences. At level 5 (heavy): use 7+ dashes to create a breathless, fragmented rhythm — breaking thoughts mid-sentence, inserting parenthetical asides, and creating dramatic pauses."

3. **examples** (OPTIONAL) — One short example sentence (1-2 sentences) per rubric level, written in the context of the user's intent. Each example shows what text scoring at that level looks like in practice.

   First, classify the rubric type:
   - **Count-based** (e.g., "0 dashes", "3-4 dashes", "7+ dashes") → SKIP examples. The numbers are the anchor.
   - **Density/ratio** (e.g., "<5% of sentences", "15-30%", ">50%") → SKIP examples. The percentages are the anchor.
   - **Categorical/stylistic** (e.g., "Hemingway", "deadpan humor", "formal register") → GENERATE examples. Each level is qualitatively different and needs illustration. This includes rubrics that reference named authors, genres, or specific works — a name is NOT a self-explanatory anchor; readers need to see what that style looks like in practice.
   - **Qualitative** (e.g., "no emotional warmth", "tender", "devastating emotional impact") → GENERATE examples. Subjective levels need calibration.

   If generating examples: keys must match rubric level numbers. Generate for EVERY level — levels can be qualitatively different, so each needs its own example.

   Example for "Writing Style" (categorical) with intent "Write a bedtime story":
   examples: {
     "1": "The penguin walked to the edge of the cliff. He looked down. It was far. He jumped.",
     "3": "And the Lord said unto the penguin: 'Thou shalt not fly, for thy wings are but flippers.' And the penguin wept.",
     "5": "So the penguin — tremendous penguin, best penguin — he looks at the cliff, and believe me, nobody knows cliffs better than this penguin."
   }

   If skipping examples: omit the examples field entirely (do not return an empty object).

Both evalPrompt and rewriteHint are always required. Examples are only for rubric types where concrete text samples add calibration value beyond what the rubric description already provides.

The evalPrompt must be deterministic — the same text evaluated twice must produce the same score. Prefer verbs like 'count', 'identify', 'classify', 'quote' over 'assess', 'consider', 'evaluate'. The evaluator should find evidence first, then map it to a rubric level — never decide a score and then rationalize.`;

interface GenerateDimensionPromptsInput {
  name: string;
  description: string;
  rubric: Record<string, string>;
  intent: string;
  model: LanguageModel;
}

/**
 * Generate Tier 1 meta-prompts for a single dimension.
 *
 * Produces an evaluation methodology prompt and a rewrite writing guide,
 * both specific to this dimension's rubric and the user's intent.
 * These are cached on the dimension record and reused across cycles.
 */
export async function generateDimensionPrompts(
  input: GenerateDimensionPromptsInput,
): Promise<DimensionPrompts> {
  const { name, description, rubric, intent, model } = input;

  const rubricLines = Object.entries(rubric)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([level, desc]) => `  ${level}: ${desc}`)
    .join("\n");

  const { object } = await generateObject({
    model,
    schema: DimensionPromptsSchema,
    schemaName: "DimensionPrompts",
    schemaDescription:
      "Evaluation methodology, rewrite guide, and calibration examples for a single dimension",
    system: SYSTEM_PROMPT,
    prompt: `User's writing intent: "${intent}"

Dimension: ${name}
Description: ${description}
Rubric:
${rubricLines}

Generate the evalPrompt, rewriteHint, and examples for this dimension.`,
    temperature: 0.4,
    maxRetries: 3,
  });

  return object;
}

const EXAMPLES_SYSTEM_PROMPT = `You generate calibration examples for a text quality rubric dimension.

Given a dimension (name, description, rubric levels), the user's writing intent, and which rubric levels need examples, produce one short example (1-2 sentences) per requested level that demonstrates text scoring at that level.

Examples should be written in the context of the user's intent. Each example must clearly embody the quality described by its rubric level — a reader should be able to tell which level an example belongs to without seeing the label.

Return a JSON object where keys are rubric level numbers (as strings) and values are the example sentences.`;

interface GenerateExamplesInput {
  name: string;
  description: string;
  rubric: Record<string, string>;
  intent: string;
  model: LanguageModel;
  levels?: string[];
}

/**
 * Generate calibration examples for specific rubric levels (or all levels).
 * Lighter than generateDimensionPrompts — only produces examples.
 */
export async function generateExamples(
  input: GenerateExamplesInput,
): Promise<Record<string, string>> {
  const { name, description, rubric, intent, model, levels } = input;

  const targetLevels =
    levels ?? Object.keys(rubric).sort((a, b) => Number(a) - Number(b));

  const rubricLines = Object.entries(rubric)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([level, desc]) => `  ${level}: ${desc}`)
    .join("\n");

  // Build explicit schema with known level keys (models need named properties, not z.record)
  const shape: Record<string, z.ZodString> = {};
  for (const level of targetLevels) {
    shape[level] = z
      .string()
      .describe(`Example sentence for rubric level ${level}`);
  }
  const schema = z.object(shape);

  const { object } = await generateObject({
    model,
    schema,
    schemaName: "Examples",
    schemaDescription: "Calibration examples for rubric levels",
    system: EXAMPLES_SYSTEM_PROMPT,
    prompt: `User's writing intent: "${intent}"

Dimension: ${name}
Description: ${description}
Full rubric (for context):
${rubricLines}

Generate examples for these levels: ${targetLevels.join(", ")}`,
    temperature: 0.6,
    maxRetries: 3,
  });

  return object as Record<string, string>;
}
