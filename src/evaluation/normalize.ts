import type { Dimension, EvaluationScore } from "@shared/types";

/**
 * Clamp and round a raw score to an integer in the 1-5 range.
 *
 * - Values below 1 are clamped to 1
 * - Values above 5 are clamped to 5
 * - Fractional values are rounded to the nearest integer (0.5 rounds up)
 *
 * @param raw - The raw numeric score
 * @returns Integer between 1 and 5
 */
export function normalizeScore(raw: number): number {
  const rounded = Math.round(raw);
  return Math.max(1, Math.min(5, rounded));
}

/**
 * Compute a weighted average of scores across dimensions.
 *
 * Each dimension's score is multiplied by its weight. The result is the
 * sum of weighted scores divided by the sum of weights. Dimensions that
 * have no corresponding score entry are skipped.
 *
 * @param scores - Map from dimension ID to EvaluationScore
 * @param dimensions - Array of Dimension records (provides weights)
 * @returns Weighted average score, or 0 if no scores match
 */
export function computeWeightedAverage(
  scores: Map<string, EvaluationScore>,
  dimensions: Dimension[],
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const dim of dimensions) {
    const score = scores.get(dim.id);
    if (score) {
      weightedSum += score.score * dim.weight;
      totalWeight += dim.weight;
    }
  }

  if (totalWeight === 0) {
    return 0;
  }

  return weightedSum / totalWeight;
}

/**
 * Compute the delta (difference) between current scores and target scores
 * for each dimension.
 *
 * Only computes deltas for dimensions present in BOTH the current scores
 * map and the target record.
 *
 * @param current - Map from dimension ID to current score (integer 1-5)
 * @param target - Record from dimension ID to target score (integer 1-5)
 * @returns Record from dimension ID to delta (target - current)
 */
export function scoreDelta(
  current: Map<string, number>,
  target: Record<string, number>,
): Record<string, number> {
  const deltas: Record<string, number> = {};

  for (const [dimId, targetScore] of Object.entries(target)) {
    const currentScore = current.get(dimId);
    if (currentScore !== undefined) {
      deltas[dimId] = targetScore - currentScore;
    }
  }

  return deltas;
}
