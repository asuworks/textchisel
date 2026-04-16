import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { RewritePlanSchema } from "@shared/types";
import type { Dimension, EvaluationScore, RewritePlan } from "@shared/types";
import { DEFAULT_SCORE } from "@/evaluation/constants";

const SYSTEM_PROMPT = `You are a writing transition planner. You analyze the gap between a text's current scores and the user's target scores, then produce concrete writing instructions.

Your job is to INFER what the user is trying to achieve from the pattern of changes:
- Which dimensions are being moved? In which direction?
- Which dimensions are locked? These represent qualities the user wants to preserve.
- What does the overall delta pattern mean? (e.g., "make it more urgent but keep it personal")

CRITICAL: Take ALL user targets at face value. Never question, soften, or editorialize about the user's choices. If the user sets "Number of deaths" to 5 ("the universe collapsed") in a children's story, that is an intentional creative choice — not a misunderstanding. Your job is to figure out HOW to achieve it, not WHETHER to achieve it. The rubric defines what the score means; honor it literally.

Then produce ACTIONABLE writing instructions — not score targets, but specific guidance about what to change in the text:
- What words/phrases/patterns to add, remove, or transform
- What structural changes to make (sentence length, paragraph breaks, etc.)
- What to preserve (from locked dimensions and from evaluation reasoning)
- How to balance competing dimensions

Your instructions should read like advice from an expert writing coach who has read the text and understands exactly what needs to change.

When dimensions conflict (e.g., increasing Humor while maintaining Professionalism), explicitly state the tradeoff: what can be achieved simultaneously, what requires compromise, and where the balance point should be. Do not pretend all targets can be hit independently when they pull in opposite directions.`;

export interface RewritePlanContext {
  intent: string;
  currentText: string;
  dimensions: Dimension[];
  currentScores: Record<string, EvaluationScore>;
  targetScores: Record<string, number>;
  lockedDimensionIds: Set<string>;
}

/**
 * Generate Tier 2 rewrite instruction — a transition-aware writing guide.
 *
 * Analyzes the before/after states, infers the user's intent from the
 * delta pattern, and produces concrete writing instructions that tell
 * the rewriter exactly what to change and what to preserve.
 */
export async function generateRewriteInstruction(
  context: RewritePlanContext,
  model: LanguageModel,
): Promise<RewritePlan> {
  const {
    intent,
    currentText,
    dimensions,
    currentScores,
    targetScores,
    lockedDimensionIds,
  } = context;

  const sorted = [...dimensions].sort((a, b) => a.sortOrder - b.sortOrder);

  const dimensionAnalysis = sorted.map((dim) => {
    const current = currentScores[dim.id]?.score ?? DEFAULT_SCORE;
    const target = targetScores[dim.id] ?? current;
    const locked = lockedDimensionIds.has(dim.id);
    const delta = target - current;
    const reasoning = currentScores[dim.id]?.reasoning ?? "not yet evaluated";

    let section = `**${dim.name}** (${dim.description})`;
    const maxLevel = dim.rubric ? Object.keys(dim.rubric).length : 5;
    section += `\n  Current: ${current}/${maxLevel} — "${reasoning}"`;
    section += `\n  Target: ${target}/${maxLevel} (delta: ${delta >= 0 ? "+" : ""}${delta})`;

    if (locked) {
      section += "\n  STATUS: LOCKED — must preserve at current level";
    } else if (delta === 0) {
      section += "\n  STATUS: no change requested";
    } else {
      section += `\n  STATUS: ${delta > 0 ? "INCREASE" : "DECREASE"} requested`;
    }

    // Include rewrite hint if available (Tier 1)
    if (dim.rewriteHint) {
      section += `\n  Writing guide: ${dim.rewriteHint}`;
    }

    // Include rubric context
    if (dim.rubric) {
      const levels = Object.entries(dim.rubric)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([lvl, desc]) => `${lvl}=${desc}`)
        .join(", ");
      section += `\n  Scale: ${levels}`;
    }

    if (dim.examples?.[String(target)]) {
      section += `\n  Example at target level: "${dim.examples[String(target)]}"`;
    }

    return section;
  });

  const { object } = await generateObject({
    model,
    schema: RewritePlanSchema,
    schemaName: "RewritePlan",
    schemaDescription:
      "Inferred user intent and concrete writing instructions for text refinement",
    system: SYSTEM_PROMPT,
    prompt: `**Writer's Intent:** ${intent}

**Current Text:**
"""
${currentText}
"""

**Dimension Analysis:**
${dimensionAnalysis.join("\n\n")}

Analyze the pattern of changes. What is the user trying to achieve? Then produce specific, actionable writing instructions.`,
    temperature: 0.3,
    maxRetries: 3,
  });

  return object;
}
