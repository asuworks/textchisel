# ADR-004: Move SuggestedDimension to shared/types.ts and Route Dimension CRUD Through Store

**Date:** 2026-04-07
**Status:** Accepted
**Scope:** shared/types.ts addition; src/store/index.ts; src/shell/App.tsx; src/shell/AddDimensionDialog.tsx

## Context

Two related invariant violations were identified in Session 2:

**Invariant 2 violation:** `src/shell/App.tsx` imported directly from `@/dimensions/crud`:
```ts
import { createDimensions } from "@/dimensions/crud";            // line 4
import { updateDimension as dbUpdateDimension } from "@/dimensions/crud"; // line 55
```
The shell module communicating directly with the dimensions module bypasses the store and violates "Modules never import from each other."

**Invariant 1 violation:** `SuggestedDimension` was defined locally in `src/store/index.ts` and exported from there. Shell components (`AddDimensionDialog.tsx`) imported it from `@/store` rather than `@shared/types`, violating "Modules import shared types ONLY from `shared/`."

## Decision

1. **Move `SuggestedDimension`** from `src/store/index.ts` to `shared/types.ts`. Import it in the store and all shell consumers from `@shared/types`.

2. **Add `createAndPersistDimensions` action** to the store that wraps `dbCreateDimensions` and updates in-memory state atomically. Shell calls this store action instead of calling the dimensions module directly.

3. **Extend `updateDimension` store action** to fire-and-forget `dbUpdateDimension` after the synchronous immer state update. Shell removes all direct `dbUpdateDimension` calls — the store handles persistence transparently.

4. **The store importing from `@/dimensions/crud`** is acceptable: the store is foundational infrastructure (analogous to `db`), not a peer module. This is not an Invariant 2 violation.

## Consequences

- `src/shell/` has zero imports from `@/dimensions/*` — invariant violation eliminated
- `SuggestedDimension` is now a proper shared contract type — available to any future module without creating cross-module imports
- `updateDimension` callers no longer need to manually persist — the store is the single source of truth for both memory and DB state
- Minor: `updateDimension` return type remains `void` (fire-and-forget persistence); callers that previously `await`-ed `dbUpdateDimension` no longer have a persistence confirmation signal (acceptable for this use case)
