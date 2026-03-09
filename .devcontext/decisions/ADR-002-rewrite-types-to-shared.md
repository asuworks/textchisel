# ADR-002: Move RewriteContext and RewritePrompt to shared/types.ts

**Date:** 2026-03-08
**Status:** Accepted
**Scope:** shared/types.ts contract change

## Context

`RewriteContext` and `RewritePrompt` are defined in `src/rewriter/prompt.ts` and re-exported from `src/rewriter/index.ts`. The orchestrator module (Wave 3) needs `RewriteContext` to construct rewrite calls.

Invariant #2: "Modules never import from each other. All cross-module communication goes through contracts in shared/."

Without this change, the orchestrator would need to import from `@/rewriter/prompt`, violating the module boundary invariant.

## Decision

Move `RewriteContext` and `RewritePrompt` interface definitions to `shared/types.ts`. The rewriter module imports them from shared instead of defining them locally.

## Consequences

- Orchestrator can import `RewriteContext` from `@shared/types` without violating invariant #2
- Rewriter module loses local ownership of these types — changes now require contract discipline
- `RewriteContext.targetScores` uses `Record<string, number>` (aligned with ADR-001)
- `RewriteContext.lockedDimensionIds` remains `Set<string>` (not serialized, runtime-only)
