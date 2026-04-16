import type { RewriteContext, RewritePrompt, RewritePlan } from "@shared/types";
import { DEFAULT_SCORE } from "@/evaluation/constants";

const SYSTEM_PROMPT = `You are a writing refinement engine. Your job is to write or rewrite text to match specific dimension targets while preserving the writer's original intent.

Each dimension has its own rubric that defines what scores 1-5 mean. Dimensions may measure quantity, quality, style, or any other property — do not assume "higher = better quality." For example, a dimension "Number of curse words" with rubric "1=none, 3=moderate, 5=many" means score 3 requires a moderate number of actual curse words in the text.

Rules:
- Output ONLY the text. No commentary, no explanations, no preamble.
- Follow each dimension's rubric LITERALLY to hit the target score.
- Preserve the writer's voice and intent as much as possible.
- Focus effort on dimensions with the largest deltas from current to target.
- For locked dimensions, maintain the current level — do not sacrifice them.`;

const TIER2_SYSTEM_PROMPT = `You are a writing refinement engine. You receive specific writing instructions from a transition planner that has analyzed what the user wants to change.

Rules:
- Output ONLY the text. No commentary, no explanations, no preamble.
- Follow the writing instructions precisely.
- Preserve the writer's voice and intent as much as possible.
- Make the minimum changes needed to achieve the requested transition.`;

export function buildRewritePrompt(
  context: RewriteContext,
  rewritePlan?: RewritePlan,
): RewritePrompt {
  const {
    intent,
    currentText,
    dimensions,
    currentScores,
    targetScores,
    lockedDimensionIds,
  } = context;

  // Tier 2: if a rewrite plan is provided, use the transition-aware instructions
  if (rewritePlan && currentText.trim().length > 0) {
    return {
      system: TIER2_SYSTEM_PROMPT,
      user: `**Writer's Intent:** ${intent}

**User's Goal:** ${rewritePlan.inferredIntent}

**Current Text:**
"""
${currentText}
"""

**Writing Instructions:**
${rewritePlan.instructions}

Apply the instructions above. Output only the rewritten text.`,
    };
  }

  // Fallback: template-based prompt (also used for initial generation when no text exists)
  const sorted = [...dimensions].sort((a, b) => a.sortOrder - b.sortOrder);

  const dimensionLines = sorted.map((dim) => {
    const current = currentScores[dim.id]?.score ?? DEFAULT_SCORE;
    const locked = lockedDimensionIds.has(dim.id);
    const rawTarget = targetScores[dim.id] ?? current;
    const target = locked ? current : rawTarget;
    const delta = target - current;

    let line = `- **${dim.name}** (${dim.description})`;
    line += `\n  Score: ${current}→${target} (${delta >= 0 ? "+" : ""}${delta})`;

    if (locked) {
      line += " [LOCKED — maintain current level]";
    }

    if (dim.rubric) {
      const levels = Object.entries(dim.rubric)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([lvl, desc]) => `${lvl}=${desc}`)
        .join(", ");
      line += `\n  Scale: ${levels}`;
      if (dim.rubric[String(target)]) {
        line += `\n  Target (${target}): "${dim.rubric[String(target)]}"`;
      }
    }

    if (dim.rewriteHint) {
      line += `\n  Writing guide: ${dim.rewriteHint}`;
    }

    if (dim.examples?.[String(target)]) {
      line += `\n  Example at target level: "${dim.examples[String(target)]}"`;
    }

    if (currentScores[dim.id]?.reasoning) {
      line += `\n  Current assessment: ${currentScores[dim.id].reasoning}`;
    }

    return line;
  });

  const hasExistingText = currentText.trim().length > 0;

  let user: string;
  if (hasExistingText) {
    user = `**Writer's Intent:** ${intent}

**Current Text:**
"""
${currentText}
"""

**Dimensions to optimize:**
${dimensionLines.join("\n\n")}

Rewrite the text to move scores toward the targets. For locked dimensions, maintain the current quality level. Focus most effort on dimensions with the largest positive deltas.`;
  } else {
    // Initial generation — target level is prominent, scale is context
    const initialLines = sorted.map((dim) => {
      const target = targetScores[dim.id] ?? 3;
      const maxLevel = dim.rubric ? Object.keys(dim.rubric).length : 5;
      let line = `- **${dim.name}** (${dim.description})`;
      if (dim.rubric) {
        const rubricAtTarget = dim.rubric[String(target)];
        if (rubricAtTarget) {
          line += `\n  → HIT THIS (${target}/${maxLevel}): "${rubricAtTarget}"`;
        } else {
          line += `\n  → Target: ${target}/${maxLevel}`;
        }
        // Show scale as compact context
        const contextLevels = Object.entries(dim.rubric)
          .sort(([a], [b]) => Number(a) - Number(b))
          .filter(([lvl]) => lvl !== String(target))
          .map(([lvl, desc]) => `${lvl}=${desc}`)
          .join(", ");
        if (contextLevels) {
          line += `\n  Scale context: ${contextLevels}`;
        }
      } else {
        line += `\n  → Target: ${target}/${maxLevel}`;
      }
      // Include Tier 1 writing guide when available
      if (dim.rewriteHint) {
        line += `\n  Writing guide: ${dim.rewriteHint}`;
      }
      if (dim.examples?.[String(target)]) {
        line += `\n  Example at target level: "${dim.examples[String(target)]}"`;
      }
      return line;
    });

    user = `**Writer's Intent:** ${intent}

**Dimensions and target levels:**
${initialLines.join("\n\n")}

Write a draft that fulfills the writer's intent. For each dimension, aim to match the target score according to its rubric scale. The rubric describes what each score level means — use it to calibrate your writing precisely.`;
  }

  return { system: SYSTEM_PROMPT, user };
}
