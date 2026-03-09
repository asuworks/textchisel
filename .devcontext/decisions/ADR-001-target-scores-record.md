# ADR-001: Change TargetScores from Map to Record

**Date:** 2026-03-08
**Status:** Accepted
**Scope:** shared/types.ts contract change

## Context

`TargetScores` was defined as `Map<string, number>` in `shared/types.ts`. However, every consumer uses `Record<string, number>`:

- **Store** (`src/store/index.ts`): Uses plain object `{}` with bracket assignment. Zustand persist (`JSON.stringify`) and Zundo temporal snapshots both require JSON-serializable state. `Map` serializes to `"{}"`, losing all data.
- **Rewriter** (`src/rewriter/prompt.ts`): `RewriteContext.targetScores` is typed as `Record<string, number>`.
- **Database** (`shared/schema.ts`): `promptVersions.scores` is `jsonb.$type<Record<string, number>>()`. JSONB deserializes to plain objects, not Maps.

No code in the project uses the Map type for target scores.

## Decision

Change `TargetScores` from `Map<string, number>` to `Record<string, number>`.

## Consequences

- Aligns the contract with all existing implementations
- Prevents data loss from Map serialization in Zustand persist/temporal
- No code changes needed in consumers (they already use Record)
- Loses Map's `.has()` / `.get()` API — but nobody was using it
