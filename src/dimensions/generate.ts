import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import {
  DimensionGenerationSchema,
  type GeneratedDimensions,
} from "@shared/types";

const SYSTEM_PROMPT = `You are an expert writing evaluator. Given a user's writing intent, generate 4 to 6 evaluation dimensions that can be used to score and improve text written with that intent.

Each dimension should:
- Be independent and cover a different aspect relevant to the intent
- Have a clear, concise name (2-4 words)
- Have a description explaining what this dimension measures
- Include a rubric with keys "1" through "5" where each level has a CONCRETE, OPERATIONAL definition

CRITICAL — rubric rules:
- Do NOT use generic quality scales ("1=poor, 3=adequate, 5=excellent"). These are useless for evaluation.
- Each rubric level must describe observable, measurable features of the text.
- Different dimensions need different rubric types. Match the rubric type to what the dimension actually measures:
  • Count-based: "1=0 instances, 3=2-3 instances, 5=6+ instances"
  • Categorical/taxonomic: each level names a specific category or technique
  • Linguistic marker: each level describes specific language patterns to look for
  • Ratio/density: "1=<5% of sentences, 3=15-30%, 5=>50%"
- Higher scores do NOT always mean "better." A dimension might measure quantity, intensity, complexity, or any other property. Define what each score MEANS for this dimension.

Example — for intent "Write a cold email to an investor":

Dimension: "Urgency"
Description: "How strongly the text creates time pressure through linguistic framing"
Rubric:
  "1": "No temporal language or time references"
  "2": "Soft temporal framing ('at some point', 'when you have time')"
  "3": "Bounded time windows ('this quarter', 'in the next few weeks')"
  "4": "Specific deadlines or milestones ('our round closes March 15')"
  "5": "Scarcity or loss framing with deadlines ('only 2 spots remain, closing Friday')"

Dimension: "Personalization Depth"
Description: "Count of verifiable, recipient-specific claims woven into the argument (not mail-merge tokens like {name})"
Rubric:
  "1": "Zero recipient-specific references — pure template"
  "2": "1 generic reference (company name or job title only)"
  "3": "2-3 specific references showing basic research (recent funding, product area)"
  "4": "4-5 references demonstrating genuine knowledge (portfolio thesis, public statements)"
  "5": "6+ deeply researched references creating a narrative thread specific to this recipient"

Dimension: "Ask Directness"
Description: "Where the call-to-action lands on the speech-act spectrum"
Rubric:
  "1": "Implicit suggestion with no clear ask"
  "2": "Open-ended question ('would you be interested?')"
  "3": "Specific proposal ('I'd love 15 minutes to walk through our deck')"
  "4": "Binary forced choice ('Are you free Tuesday or Thursday?')"
  "5": "Presumptive close ('I'll send the calendar invite for Tuesday')"

Make dimensions specific to the user's stated intent. Each dimension should be independently measurable — high performance on one should not imply high performance on another.

The rubric object must have exactly keys "1", "2", "3", "4", "5" with string descriptions as values.`;

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
    temperature: 0.4,
    maxRetries: 3,
  });

  return object;
}
