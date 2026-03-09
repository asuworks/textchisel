# ADR-003: Generated Evaluation and Rewrite Prompts (Meta-Prompting)

**Date:** 2026-03-08
**Status:** Accepted
**Scope:** New module, schema change, evaluation + rewriter pipeline

## Context

The current evaluation and rewriting pipeline uses generic template prompts that plug in dimension rubrics as data:

```
Evaluate on "Dash Usage". Rubric: 1=0 dashes, 2=1-2 dashes, ...
```

This has three structural problems:

1. **Rubrics-as-data < rubrics-as-methodology.** LLMs follow reasoning instructions far better than lookup tables. A prompt that says "count every em dash, en dash, and space-separated hyphen, then map the count to a score" dramatically outperforms "Rubric: 1=0 dashes."

2. **No dimension-specific evaluation epistemology.** The PRD (§5.2, §8.6) requires fundamentally different evaluation approaches per dimension — counting, ratio computation, reader simulation, speech act classification. A generic template cannot encode these methodologies.

3. **Rewriter receives score targets, not writing guidance.** "Move Urgency from 2→4" tells the LLM where to go but not what to do. A transition-aware instruction like "Replace 'when you get a chance' with specific deadlines; add one scarcity signal" tells it how to get there with minimum disruption.

## Decision

Implement a two-tier meta-prompting system using a dedicated meta-prompt LLM call (Option A).

### Tier 1 — Static Dimension Prompts (generated once, cached)

When a dimension is created or its rubric is edited, a meta-prompt call generates:

- **`evalPrompt`**: Evaluation methodology specific to this dimension. Encodes HOW to evaluate — what to count, classify, simulate, or measure — not just what scores mean.
- **`rewriteHint`**: Writing guide explaining what this dimension controls and how text changes at each level. Provides the rewriter with craft-level guidance.

Both are cached on the dimension record. Cost: one LLM call per dimension, amortized over all subsequent evaluation/rewrite cycles.

### Tier 2 — Dynamic Rewrite Instruction (generated per refinement)

Before each rewrite, a separate meta-prompt call analyzes:

- **Before state**: Current scores + evaluation reasoning for each dimension
- **After state**: Target scores (from user's slider/chart drag)
- **Locked dimensions**: What must not change
- **Dimension rewrite hints**: From Tier 1

And produces a **unified rewrite instruction** that:

1. Infers the user's transition intent from the delta pattern
2. Generates concrete writing guidance for achieving the transition
3. Specifies what to preserve (locked dimensions, working elements)

This is the "IK solver" — it computes the minimum writing transformation to achieve the desired movement in dimension space.

### Pipeline Change

```
BEFORE:
  generate dims → evaluate (generic template)
               → rewrite (generic template) → evaluate → loop

AFTER:
  generate dims → generate Tier 1 meta-prompts (once, cached)
               → evaluate (using dim.evalPrompt)
               → generate Tier 2 rewrite instruction (per refinement)
               → rewrite (using generated instruction)
               → evaluate → loop
```

## Schema Changes

Two nullable text columns on `dimensions`:

```sql
ALTER TABLE dimensions ADD COLUMN eval_prompt text;
ALTER TABLE dimensions ADD COLUMN rewrite_hint text;
```

Nullable so existing dimensions fall back to current template behavior. No data migration needed.

The `Dimension` TypeScript type automatically gains these fields (inferred from Drizzle schema).

## New Module: `src/prompts/`

```
src/prompts/
├── index.ts           # public API
├── generate.ts        # Tier 1: generateDimensionPrompts(dim, intent, model)
└── rewrite-planner.ts # Tier 2: generateRewriteInstruction(context, model)
```

### Tier 1 API

```typescript
interface DimensionPrompts {
  evalPrompt: string;
  rewriteHint: string;
}

function generateDimensionPrompts(
  dimension: {
    name: string;
    description: string;
    rubric: Record<string, string>;
  },
  intent: string,
  model: LanguageModel,
): Promise<DimensionPrompts>;
```

Uses `generateObject` with a schema for `{ evalPrompt, rewriteHint }`. Single call generates both.

### Tier 2 API

```typescript
interface RewritePlan {
  inferredIntent: string; // What the user is trying to achieve
  instructions: string; // Concrete writing guidance for the rewriter
}

interface RewritePlanContext {
  intent: string;
  dimensions: Dimension[];
  currentScores: Record<string, EvaluationScore>;
  targetScores: Record<string, number>;
  lockedDimensionIds: Set<string>;
}

function generateRewriteInstruction(
  context: RewritePlanContext,
  model: LanguageModel,
): Promise<RewritePlan>;
```

## Affected Modules

| Module                    | Change                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| `shared/schema.ts`        | Add `eval_prompt` and `rewrite_hint` columns to `dimensions`                    |
| `shared/types.ts`         | Add `RewritePlan` and `RewritePlanContext` types, `DimensionPromptsSchema`      |
| `src/prompts/`            | **NEW** — Tier 1 + Tier 2 meta-prompt generation                                |
| `src/evaluation/score.ts` | Use `dim.evalPrompt` when present; fall back to generic template                |
| `src/rewriter/prompt.ts`  | Accept Tier 2 `instructions` as primary rewrite guidance; fall back to template |
| `src/shell/App.tsx`       | Chain Tier 1 after dimension creation/edit; chain Tier 2 before rewrite         |
| `server/routes/llm.ts`    | Add `/api/llm/prompts/generate` and `/api/llm/rewrite/plan` endpoints           |

## Evaluation Fallback Strategy

```typescript
// score.ts
if (dimension.evalPrompt) {
  // Use generated evaluation methodology
  prompt = dimension.evalPrompt + `\n\nText:\n"""${text}"""`;
} else {
  // Fall back to current generic template
  prompt = buildGenericEvalPrompt(dimension, text);
}
```

Same pattern for rewriter: if Tier 2 instruction exists, use it; otherwise fall back to current template.

## Latency Budget

| Step               | Latency             | Frequency            |
| ------------------ | ------------------- | -------------------- |
| Tier 1 generation  | ~3-5s per dimension | Once per create/edit |
| Tier 2 instruction | ~2-3s               | Per refinement cycle |
| Evaluation         | ~2-3s per dimension | Per refinement cycle |
| Rewriting          | ~3-8s               | Per refinement cycle |

Tier 1 is amortized. Tier 2 adds ~2-3s per refinement cycle but produces dramatically better rewrites.

## Risks and Mitigations

| Risk                                  | Mitigation                                                                |
| ------------------------------------- | ------------------------------------------------------------------------- |
| Meta-prompt quality varies            | Careful prompt engineering + fallback to generic template                 |
| Extra latency per refinement (Tier 2) | Small structured output call; fast models usable for meta-prompt          |
| Harder to debug evaluation errors     | Generated prompts stored on dimension record for inspection               |
| Schema change on frozen contracts     | Additive (nullable columns), no breaking changes, ADR documents rationale |

## Consequences

- Evaluation accuracy dramatically improves: methodology-based prompts vs lookup tables
- Rewriting becomes transition-aware: the system understands what the user is trying to achieve
- Architecture supports the PRD's hard examples (§6.4-6.7) naturally — each dimension gets its own evaluation epistemology
- Dimensions become richer objects: they carry not just data (rubric) but intelligence (how to evaluate, how to guide writing)
- Existing dimensions degrade gracefully (nullable fields, template fallback)
