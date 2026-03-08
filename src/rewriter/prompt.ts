import type { Dimension, EvaluationScore } from "@shared/types";

export interface RewriteContext {
  intent: string;
  currentText: string;
  dimensions: Dimension[];
  currentScores: Record<string, EvaluationScore>;
  targetScores: Record<string, number>;
  lockedDimensionIds: Set<string>;
}

export interface RewritePrompt {
  system: string;
  user: string;
}

const SYSTEM_PROMPT = `You are a writing refinement engine. Your job is to rewrite text to improve specific quality dimensions while preserving the writer's original intent.

Each dimension is scored on a 1-5 integer scale:
1 = Lowest quality — significant deficiencies
2 = Below average — noticeable weaknesses
3 = Adequate — meets basic expectations
4 = Good — exceeds expectations
5 = Excellent — exemplary quality

Rules:
- Output ONLY the rewritten text. No commentary, no explanations, no preamble.
- Preserve the writer's voice and intent as much as possible.
- Focus improvement effort on dimensions with the largest positive deltas.
- For locked dimensions, maintain the current quality level — do not sacrifice them.
- Do not add content that wasn't implied by the original intent.`;

export function buildRewritePrompt(context: RewriteContext): RewritePrompt {
  const {
    intent,
    currentText,
    dimensions,
    currentScores,
    targetScores,
    lockedDimensionIds,
  } = context;

  const sorted = [...dimensions].sort((a, b) => a.sortOrder - b.sortOrder);

  const dimensionLines = sorted.map((dim) => {
    const current = currentScores[dim.id]?.score ?? 3;
    const locked = lockedDimensionIds.has(dim.id);
    const rawTarget = targetScores[dim.id] ?? current;
    const target = locked ? current : rawTarget;
    const delta = target - current;

    let line = `- **${dim.name}** (${dim.description})`;
    line += `\n  Score: ${current}→${target} (${delta >= 0 ? "+" : ""}${delta})`;

    if (locked) {
      line += " [LOCKED — maintain current level]";
    }

    if (dim.rubric && dim.rubric[String(target)]) {
      line += `\n  Target level: ${dim.rubric[String(target)]}`;
    }

    if (currentScores[dim.id]?.reasoning) {
      line += `\n  Current assessment: ${currentScores[dim.id].reasoning}`;
    }

    return line;
  });

  const user = `**Writer's Intent:** ${intent}

**Current Text:**
"""
${currentText}
"""

**Dimensions to optimize:**
${dimensionLines.join("\n\n")}

Rewrite the text to move scores toward the targets. For locked dimensions, maintain the current quality level. Focus most effort on dimensions with the largest positive deltas.`;

  return { system: SYSTEM_PROMPT, user };
}
