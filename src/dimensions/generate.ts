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

Example — for intent "Write a horror story for teens":

Dimension: "Dread Pacing"
Description: "How long threats linger unresolved before payoff"
Rubric:
  "1": "Each threat introduced and resolved within the same paragraph"
  "2": "Threats linger 1-2 paragraphs before resolution"
  "3": "Threats build across 3-5 paragraphs with false resolutions"
  "4": "Multiple unresolved threats overlap, resolved only at climax"
  "5": "Central threat introduced early and never fully resolved — lingering dread"

Dimension: "Sensory Grounding"
Description: "How many senses the prose engages per scene"
Rubric:
  "1": "Visual descriptions only — no other senses"
  "2": "Visual + one other sense (usually sound)"
  "3": "Three senses per scene (e.g., sight, sound, smell)"
  "4": "Four senses woven naturally into action"
  "5": "All five senses present; synesthetic blending (e.g., 'the darkness tasted metallic')"

Example — for intent "Write installation instructions for a CLI tool":

Dimension: "Prerequisite Explicitness"
Description: "How thoroughly the text enumerates what the reader needs before starting"
Rubric:
  "1": "No prerequisites mentioned — assumes reader has everything"
  "2": "Lists tool names without versions ('requires Node.js')"
  "3": "Lists tools with version ranges and OS compatibility"
  "4": "Includes verification commands ('run node -v to confirm')"
  "5": "Full environment setup: tools, versions, verification, and troubleshooting for common mismatches"

IMPORTANT — User-specified dimensions:
If the user's intent contains lines starting with "#", treat each as a user-requested dimension. Use the text after "#" as the dimension name (or as guidance for naming). If the user provides rubric levels (e.g., "1: ...", "2: ...") under a "#" line, use them as-is for that dimension's rubric. Generate proper descriptions and fill in any missing rubric levels, but ALWAYS honor the user's explicit dimension requests first. Only generate additional dimensions if the user's "#" lines don't cover enough aspects of the intent (aim for 4-6 total).

If the intent contains no "#" lines, generate all dimensions yourself as described above.

Make dimensions specific to the user's stated intent. Each dimension should be independently measurable — high performance on one should not imply high performance on another. Verify that improving one dimension does not mechanically force another to change; if it does, redesign them as truly independent axes.

The rubric object must have exactly keys "1", "2", "3", "4", "5" with string descriptions as values.`;

export interface GenerateDimensionsOptions {
  model: LanguageModel;
  /** Total number of dimensions to generate (default: 4-6 via system prompt) */
  count?: number;
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
/**
 * Generate a single dimension with description and rubric, given a dimension name and intent.
 * Used when a user types their own dimension name in the "Add Dimension" dialog.
 */
/**
 * Generate suggestion dimensions that complement existing ones.
 * Returns 3 new dimensions orthogonal to what already exists.
 */
export async function generateSuggestionDimensions(
  intent: string,
  existingNames: string[],
  options: { model: LanguageModel },
): Promise<GeneratedDimensions> {
  const { object } = await generateObject({
    model: options.model,
    schema: DimensionGenerationSchema,
    schemaName: "DimensionGeneration",
    schemaDescription:
      "Evaluation dimensions for scoring text against a writing intent",
    system: SYSTEM_PROMPT,
    prompt: `Generate exactly 3 NEW evaluation dimensions for text written with the following intent:\n\n"${intent}"\n\nThese dimensions ALREADY EXIST — do NOT duplicate or overlap with them:\n${existingNames.map((n) => `- ${n}`).join("\n")}\n\nGenerate 3 dimensions that cover DIFFERENT aspects not yet measured by the existing set.`,
    temperature: 0.6,
    maxRetries: 3,
  });

  return object;
}

export async function generateSingleDimension(
  name: string,
  intent: string,
  options: { model: LanguageModel },
): Promise<{
  name: string;
  description: string;
  rubric: Record<string, string>;
}> {
  const { object } = await generateObject({
    model: options.model,
    schema: DimensionGenerationSchema,
    schemaName: "DimensionGeneration",
    schemaDescription:
      "Evaluation dimensions for scoring text against a writing intent",
    system: SYSTEM_PROMPT,
    prompt: `Generate exactly 1 evaluation dimension named "${name}" for text written with the following intent:\n\n"${intent}"\n\nThe dimension MUST be named "${name}" (or a close variant). Generate a description and a full 5-level rubric for it.`,
    temperature: 0.4,
    maxRetries: 3,
  });

  return object.dimensions[0];
}

export async function generateDimensions(
  intent: string,
  options: GenerateDimensionsOptions,
): Promise<GeneratedDimensions> {
  if (!intent || intent.trim().length === 0) {
    throw new Error("Intent must be a non-empty string");
  }

  const countInstruction = options.count
    ? `\n\nGenerate exactly ${options.count} dimensions.`
    : "";

  const { object } = await generateObject({
    model: options.model,
    schema: DimensionGenerationSchema,
    schemaName: "DimensionGeneration",
    schemaDescription:
      "Evaluation dimensions for scoring text against a writing intent",
    system: SYSTEM_PROMPT,
    prompt: `Generate evaluation dimensions for text written with the following intent:\n\n"${intent}"${countInstruction}`,
    temperature: 0.4,
    maxRetries: 3,
  });

  return object;
}
