/**
 * Clamp a score to integer in the range [1, 5].
 */
export function clampScore(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}

/**
 * Check if a dimension ID is in the locked set.
 */
export function isLocked(
  lockedDimensions: Set<string>,
  dimensionId: string,
): boolean {
  return lockedDimensions.has(dimensionId);
}
