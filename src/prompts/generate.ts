import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { DimensionPromptsSchema } from "@shared/types";
import type { DimensionPrompts } from "@shared/types";

const SYSTEM_PROMPT = `You generate evaluation and rewriting prompts for a text quality dimension.

Given a dimension (name, description, rubric levels 1-5) and the user's writing intent, produce two prompts:

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

Both prompts must be specific to THIS dimension — never generic. The rubric defines the measurement; your job is to turn it into actionable methodology (eval) and actionable writing advice (rewrite).`;

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
      "Evaluation methodology and rewrite guide for a single dimension",
    system: SYSTEM_PROMPT,
    prompt: `User's writing intent: "${intent}"

Dimension: ${name}
Description: ${description}
Rubric:
${rubricLines}

Generate the evalPrompt and rewriteHint for this dimension.`,
    temperature: 0.4,
    maxRetries: 3,
  });

  return object;
}
