/**
 * Pure helper functions for rubric-level mutations.
 * No side effects — returns new objects.
 */

/** Remove a rubric level and reindex remaining levels + examples to be 1-based contiguous. */
export function deleteRubricLevel(
  rubric: Record<string, string>,
  examples: Record<string, string> | null,
  levelToDelete: string,
): { rubric: Record<string, string>; examples: Record<string, string> | null } {
  const entries = Object.entries(rubric)
    .sort(([a], [b]) => Number(a) - Number(b))
    .filter(([l]) => l !== levelToDelete);

  const newRubric: Record<string, string> = {};
  const newExamples: Record<string, string> = {};
  const oldExamples = examples ?? {};

  entries.forEach(([oldKey, desc], i) => {
    const newKey = String(i + 1);
    newRubric[newKey] = desc;
    if (oldExamples[oldKey] != null) {
      newExamples[newKey] = oldExamples[oldKey];
    }
  });

  return {
    rubric: newRubric,
    examples: Object.keys(newExamples).length > 0 ? newExamples : null,
  };
}

/** Add a new rubric level at the end with a placeholder description. */
export function addRubricLevel(
  rubric: Record<string, string>,
): Record<string, string> {
  const nextKey = String(Object.keys(rubric).length + 1);
  return { ...rubric, [nextKey]: `Level ${nextKey} description` };
}
