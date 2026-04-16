# ADR-006: Variable Score Levels (1-N)

**Date:** 2026-04-07
**Status:** Accepted
**Scope:** shared/types.ts, evaluation, rewriter, chart

## Context

Invariant 8 stated "Spider chart values are integers 1-5." However, `EvaluationScoreSchema` already allowed `max(7)`, and the chart's `maxRubricLevel()` helper already computed dynamic max from rubric keys. The system prompt in `evaluation/score.ts` hardcoded "1-5", and `normalizeScore` hardcoded `max=5`, creating a mismatch for dimensions with more or fewer than 5 rubric levels.

## Decision

Relax Invariant 8 to: "Spider chart values are integers 1-N, where N is the max rubric level for a dimension (2 ≤ N ≤ 7)."

- `normalizeScore(raw, max)` accepts a `max` parameter (default 5)
- LLM evaluation prompts use dynamic "1 to N" based on dimension rubric key count
- Rewriter/planner prompts use `${current}/${maxLevel}` instead of hardcoded `/5`
- `GenerationRubricSchema` stays at 5 levels (default) — users add/remove levels in the UI
- `EvaluationScoreSchema` already allows max(7) — no Zod change needed
- Chart already uses `maxRubricLevel()` dynamically — no chart change needed

## Consequences

- Dimensions can now have 2-7 rubric levels with correct scoring
- LLM is instructed with the actual scale, not a hardcoded "1-5"
- `DEFAULT_SCORE = 3` remains the midpoint for 5-level rubrics; for other scales, it may not be the midpoint — acceptable for now
