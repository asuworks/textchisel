import type { Dimension } from "@shared/types";

/**
 * Get the max rubric level across all dimensions (default 5).
 */
export function maxRubricLevel(dimensions: Dimension[]): number {
  let max = 5;
  for (const dim of dimensions) {
    if (dim.rubric) {
      const keys = Object.keys(dim.rubric).map(Number).filter(Number.isFinite);
      if (keys.length > 0) max = Math.max(max, Math.max(...keys));
    }
  }
  return max;
}

/**
 * Clamp a score to integer in the range [1, max].
 */
export function clampScore(value: number, max: number = 5): number {
  return Math.min(max, Math.max(1, Math.round(value)));
}

/**
 * Check if a dimension ID is locked.
 */
export function isLocked(
  lockedDimensions: Record<string, boolean>,
  dimensionId: string,
): boolean {
  return !!lockedDimensions[dimensionId];
}
