import type { EvaluationScore } from "@shared/types";

export interface LockDeviation {
  dimensionId: string;
  expected: number;
  actual: number;
  deviation: number;
}

export interface ConvergenceCheck {
  converged: boolean;
  maxDelta: number;
  deltas: Record<string, number>;
}

/**
 * Check whether current scores have converged to target scores.
 *
 * Convergence means every dimension's absolute delta (|target - current|)
 * is at most `tolerance`. Only dimensions present in both maps are checked.
 *
 * @param currentScores - Current evaluation scores keyed by dimension ID
 * @param targetScores - Target scores (1-5) keyed by dimension ID
 * @param tolerance - Maximum allowed delta per dimension (default 0 = exact match)
 * @returns ConvergenceCheck with per-dimension deltas
 */
export function checkConvergence(
  currentScores: Record<string, EvaluationScore>,
  targetScores: Record<string, number>,
  tolerance: number = 0,
): ConvergenceCheck {
  const deltas: Record<string, number> = {};
  let maxDelta = 0;
  let hasDimensions = false;

  for (const [dimId, target] of Object.entries(targetScores)) {
    const current = currentScores[dimId]?.score;
    if (current !== undefined) {
      hasDimensions = true;
      const delta = Math.abs(target - current);
      deltas[dimId] = delta;
      maxDelta = Math.max(maxDelta, delta);
    }
  }

  return {
    converged: hasDimensions ? maxDelta <= tolerance : true,
    maxDelta,
    deltas,
  };
}

/**
 * Check whether locked dimensions have drifted beyond tolerance.
 *
 * Compares scores before and after a rewrite for locked dimensions only.
 * Returns deviations that exceed the tolerance threshold.
 *
 * @param previousScores - Scores before the rewrite
 * @param currentScores - Scores after the rewrite
 * @param lockedDimensionIds - Set of dimension IDs that are locked
 * @param tolerance - Maximum allowed drift (default 0 = any change is a deviation)
 * @returns Array of deviations exceeding tolerance
 */
export function checkLockFidelity(
  previousScores: Record<string, EvaluationScore>,
  currentScores: Record<string, EvaluationScore>,
  lockedDimensionIds: Set<string>,
  tolerance: number = 0,
): LockDeviation[] {
  const deviations: LockDeviation[] = [];

  for (const dimId of lockedDimensionIds) {
    const expected = previousScores[dimId]?.score;
    const actual = currentScores[dimId]?.score;

    if (expected !== undefined && actual !== undefined) {
      const deviation = Math.abs(actual - expected);
      if (deviation > tolerance) {
        deviations.push({ dimensionId: dimId, expected, actual, deviation });
      }
    }
  }

  return deviations;
}
