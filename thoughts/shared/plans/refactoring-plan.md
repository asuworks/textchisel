# Implementation Plan: Textchisel Codebase Refactoring

Generated: 2026-04-05

## Goal

Address 21 issues identified in a comprehensive code review of the textchisel prompt engineering workbench. Issues range from quick bug fixes and code hygiene through module boundary violations, large component decomposition, provider registry consolidation, test foundation, schema cleanup, and two new features (variable score levels, streaming rewrite). Organized into 8 independent sessions that respect the project's one-module-per-session invariant.

---

## Session 1: Quick Wins (Hotfix)

**Scope:** 3 isolated fixes across different modules. These are small enough to bundle as a hotfix session.
**Complexity:** S
**Dependencies:** None

### 1.1 Remove debug `console.log` in `src/rewriter/stream.ts`

**File:** `src/rewriter/stream.ts`

Lines 22-23 log the full system and user prompts on every rewrite call:
```ts
console.log("Rewrite system prompt:", system);
console.log("Rewrite user prompt:", user);
```

**Change:** Delete both lines. No replacement needed — the server route in `server/routes/llm.ts:35-36` already logs provider/model info at an appropriate level.

### 1.2 Fix module-level mutable `hoveredLabelIndex` in `src/chart/SpiderChart.tsx`

**File:** `src/chart/SpiderChart.tsx`

Line 77 declares `let hoveredLabelIndex = -1` at module scope. This is a shared mutable variable that would cause bugs if multiple SpiderChart instances existed (all share the same hover state). The `labelHoverPlugin` (line 80) reads and the mousemove handler (somewhere inside the component) writes this variable.

**Changes:**

1. Inside the `SpiderChart` component (starts line 121), add a ref:
   ```ts
   const hoveredLabelRef = useRef(-1);
   ```

2. Convert `labelHoverPlugin` from a module-level constant to a factory function that accepts the ref:
   ```ts
   function createLabelHoverPlugin(hoveredRef: React.RefObject<number>) {
     return {
       id: "underlineLabels",
       afterDraw(chart: ChartJS) {
         const idx = hoveredRef.current ?? -1;
         if (idx < 0) return;
         // ... rest of existing afterDraw logic, replacing hoveredLabelIndex with idx
       },
     };
   }
   ```

3. Inside the component, memoize the plugin instance:
   ```ts
   const labelHoverPlugin = useMemo(() => createLabelHoverPlugin(hoveredLabelRef), []);
   ```

4. Update all reads/writes of `hoveredLabelIndex` to use `hoveredLabelRef.current` instead.

5. Delete the module-level `let hoveredLabelIndex = -1` declaration.

### 1.3 Extract `DEFAULT_SCORE` constant

**Files to modify:**
- `src/evaluation/constants.ts` — create with constant (avoids contract freeze violation — see ADR note below)
- `src/rewriter/prompt.ts` — import and use
- `src/prompts/rewrite-planner.ts` — import and use
- `src/shell/App.tsx` — import and use

The magic number `3` appears as a default score fallback in three places:

- `src/rewriter/prompt.ts:59`: `const current = currentScores[dim.id]?.score ?? 3;`
- `src/prompts/rewrite-planner.ts:57`: `const current = currentScores[dim.id]?.score ?? 3;`
- `src/shell/App.tsx:217-218`: `targets[dim.id] = 3; setTargetScore(dim.id, 3);`

**Changes:**

1. Create `src/evaluation/constants.ts`:
   ```ts
   /** Default score used when no evaluation has been performed yet (midpoint of 1-5). */
   export const DEFAULT_SCORE = 3;
   ```

   **Why not `shared/types.ts`?** Invariant 5 freezes contracts after Phase 2. Adding a constant to `shared/` would require an ADR. Since `DEFAULT_SCORE` is an evaluation/display default (not a cross-module contract type), it belongs in the evaluation module and can be imported by `rewriter/prompt.ts`, `prompts/rewrite-planner.ts`, and `shell/App.tsx` without a contract change.

2. In each of the three files, replace the literal `3` with `DEFAULT_SCORE` imported from `@/evaluation/constants`.

### Verification

- `npx tsc --noEmit` passes
- `npx vitest run` passes (if any tests exist)
- Manual: trigger a rewrite and confirm no console.log output in terminal
- Manual: open dimension popover, hover labels — highlight still works

---

## Session 2: Module Boundary Fix (Hardening)

**Scope:** Fix Invariant 2 violation and relocate a domain type.
**Complexity:** M
**Dependencies:** None

### 2.1 Fix invariant violation: `shell/App.tsx` imports from `@/dimensions/crud`

**File:** `src/shell/App.tsx`

Lines 4 and 55 import directly from `@/dimensions/crud`:
```ts
import { createDimensions } from "@/dimensions/crud";            // line 4
import { updateDimension as dbUpdateDimension } from "@/dimensions/crud"; // line 55
```

This violates Invariant 2: "Modules never import from each other." The shell module should communicate with the dimensions module only through store actions.

**Why not server routes?** PGlite runs in-browser only (`idb://textchisel` via Web Worker). The Express server has no PGlite instance and cannot access the browser's IndexedDB. Server routes for dimension CRUD are architecturally impossible. The store-mediation approach keeps the client-side PGlite architecture intact.

**Changes:**

1. **Add dimension persistence to store actions** in `src/store/index.ts`:

   The store already has `updateDimension` and `setDimensions` actions for in-memory state. Extend them to also persist to PGlite:

   ```ts
   // In the store's action implementations:
   import { createDimensions as dbCreateDimensions, updateDimension as dbUpdateDimension } from "@/dimensions/crud";

   // New action: create dimensions and persist
   createAndPersistDimensions: async (sessionId, dims) => {
     const created = await dbCreateDimensions(sessionId, dims);
     if (created) set({ dimensions: created });
     return created;
   },

   // Extend existing updateDimension to also persist:
   updateDimension: (id, updates) => {
     set((state) => ({
       dimensions: state.dimensions.map((d) =>
         d.id === id ? { ...d, ...updates } : d
       ),
     }));
     // Fire-and-forget persistence
     dbUpdateDimension(id, updates);
   },
   ```

   The store is foundational infrastructure (like `db`), so importing from `dimensions/crud` is acceptable — it's not a peer module relationship.

2. **Update `src/shell/App.tsx`:**
   - Remove both imports from `@/dimensions/crud` (lines 4 and 55)
   - Replace `createDimensions(sid, result.dimensions)` with the store's `createAndPersistDimensions(sid, result.dimensions)`
   - Remove `dbUpdateDimension(dim.id, {...})` calls — the store's `updateDimension` now handles persistence
   - All dimension operations now go through the store, consistent with every other action

3. **Note:** `createSession`, `createPromptVersion`, `getNextVersionNum` are imported from `@/db` (line 3). The `db` module is foundational infrastructure, not a peer module — this is acceptable per the architecture (shell depends on db).

### 2.2 Move `SuggestedDimension` type to `shared/types.ts`

**Files to modify:**
- `shared/types.ts` — add the interface
- `src/store/index.ts` — import from `@shared/types` instead of defining locally

The `SuggestedDimension` interface at `src/store/index.ts:26-30` is a domain type:
```ts
export interface SuggestedDimension {
  name: string;
  description: string;
  rubric: Record<string, string>;
}
```

**Changes:**

1. Add to `shared/types.ts` (after `GeneratedDimensions`):
   ```ts
   /** Suggested dimension (precomputed but not yet added to session) */
   export interface SuggestedDimension {
     name: string;
     description: string;
     rubric: Record<string, string>;
   }
   ```

2. In `src/store/index.ts`, replace the local interface with:
   ```ts
   import type { ..., SuggestedDimension } from "@shared/types";
   ```

3. Update any other files that import `SuggestedDimension` from store to import from `@shared/types` instead.

**Contract change note:** This adds a new type to `shared/types.ts`. Per Invariant 5, this requires an ADR. Since this is moving an existing type (not changing a contract), a lightweight ADR noting the relocation is sufficient. Create `.devcontext/decisions/ADR-NNN-move-suggested-dimension-to-shared.md`.

### Verification

- `npx tsc --noEmit` passes
- No imports from `@/dimensions/*` remain in `src/shell/` (search to confirm)
- Manual: generate dimensions flow still works end-to-end
- Manual: update dimension name/description/rubric in popover still persists

---

## Session 3: App.tsx Decomposition (Build)

**Scope:** Extract components and hooks from the 1053-line `App.tsx`.
**Complexity:** L
**Dependencies:** Session 2 (module boundary fix must land first)

> **⚠️ BLOCKED on Session 2.** Do not extract until dimension CRUD calls go through the store. If you extract `DimensionPopover` before Session 2 lands, the illegal `import { updateDimension } from "@/dimensions/crud"` migrates into `DimensionPopover.tsx` — moving the invariant violation instead of fixing it.

### 3.1 Extract `DimensionPopover` component

**Files:**
- Create `src/shell/DimensionPopover.tsx`
- Modify `src/shell/App.tsx`

Lines ~527-1017 of App.tsx contain the entire `<Popover>` block for editing a dimension (name, description, rubric levels, examples, lock/delete). This is ~490 lines of JSX.

**New component props:**
```ts
interface DimensionPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: { getBoundingClientRect: () => DOMRect } | undefined;
  dimension: Dimension | undefined;
  currentScore: EvaluationScore | undefined;
  targetScore: number | undefined;
  isLocked: boolean;
  onTargetChange: (dimId: string, score: number) => void;
  onLockToggle: (dimId: string) => void;
  onRemove: (dimId: string) => void;
  onUpdate: (dimId: string, updates: Partial<Dimension>) => void;
  onGenerateExamples: (levels?: string[]) => void;
  generatingExamples: Set<string>;
  generatingAllExamples: boolean;
}
```

**Changes:**
1. Create `DimensionPopover.tsx` with the extracted JSX
2. Move the rubric-level inline edit, delete-level, add-level, example generation UI into it
3. In `App.tsx`, replace the ~490 lines with `<DimensionPopover ... />`

### 3.2 Extract `useWorkflows` custom hook

**File:** Create `src/shell/useWorkflows.ts`
**Modify:** `src/shell/App.tsx`

Extract the four workflow callbacks from App.tsx into a single hook:

- `handleGenerate` (lines 157-260) — generate dimensions + initial text + auto-evaluate
- `handleRegenerate` (lines 289-337) — regenerate from scratch
- `handleRefine` (lines 339-408) — plan + rewrite + evaluate
- `handleOrchestrate` (lines 410-468) — orchestration loop
- `handleEvaluate` (lines 272-287) — standalone evaluation

These all follow the same pattern: read state, call API, write state. They also share common dependencies (status, error, sessionId, intent, dimensions, scores, etc.).

**Hook signature:**
```ts
export function useWorkflows() {
  // Read all needed state from useAppStore selectors
  // Return { handleGenerate, handleEvaluate, handleRegenerate, handleRefine, handleOrchestrate }
}
```

**Changes:**
1. Create `useWorkflows.ts` with the five callbacks
2. In `App.tsx`, replace the inline callbacks with `const { handleGenerate, ... } = useWorkflows()`
3. This removes ~300 lines from App.tsx

### 3.3 Normalize Zustand `getState()` calls

**File:** `src/shell/App.tsx` (and the new `DimensionPopover.tsx` after extraction)

There are 9+ locations where `useAppStore.getState().someAction()` is called inside JSX event handlers (e.g., lines 133-135, 542-544, 580-582, 636-638, 654-656, 706-709, 769-782, 821-826, 839-844, 862-878, 965-969). This is inconsistent with the component top where actions are properly extracted via selectors (lines 76-85).

**Changes:**

For each action used via `getState()`, add a selector at the component top:
```ts
const updateDimension = useAppStore((s) => s.updateDimension);
const removeDimension = useAppStore((s) => s.removeDimension);
const toggleLock = useAppStore((s) => s.toggleLock);
```

Then replace all `useAppStore.getState().updateDimension(...)` with `updateDimension(...)`, etc.

**Note:** After extracting `DimensionPopover`, most of these will be in the new component. The actions should be passed as props or selected inside the new component.

### 3.4 Move rubric mutation helpers to `src/dimensions/`

**Files:**
- Create `src/dimensions/rubric-helpers.ts`
- Modify `DimensionPopover.tsx` (or `App.tsx` if extraction hasn't happened)

The inline handlers for delete-level (lines 727-795), rename-level (via InlineEdit onCommit, lines 701-711), and add-level (lines 957-969) contain reindex logic that should be pure utility functions:

```ts
/** Remove a rubric level and reindex remaining levels + examples */
export function deleteRubricLevel(
  rubric: Record<string, string>,
  examples: Record<string, string> | null,
  levelToDelete: string,
): { rubric: Record<string, string>; examples: Record<string, string> | null } { ... }

/** Add a new rubric level at the end */
export function addRubricLevel(
  rubric: Record<string, string>,
): Record<string, string> { ... }
```

### Verification

- `npx tsc --noEmit` passes
- `npx vitest run` passes
- App.tsx should be under 300 lines after extraction
- Manual: all popover interactions work (edit name, edit description, edit rubric, delete level, add level, generate examples, lock, delete dimension)
- Manual: all workflow buttons work (Generate, Evaluate, Regenerate, Refine, Orchestrate)

---

## Session 4: Provider Registry (Build)

**Scope:** Extract provider definitions into a shared module.
**Complexity:** S
**Dependencies:** None (can run in parallel with Sessions 1-3)

### 4.1 Create `shared/providers.ts`

**Files:**
- Create `shared/providers.ts`
- Modify `src/shell/useSettings.ts`
- Modify `server/model.ts`

Currently, provider definitions live in `src/shell/useSettings.ts` (lines 3-107):
- `Provider` type union (lines 3-16)
- `MODELS` record (lines 38-73)
- `PROVIDER_LABELS` record (lines 76-90)
- `PROVIDER_KEY_HINTS` record (lines 93-107)

And `server/model.ts` has its own `switch` statement (line 24) with hardcoded provider names. Adding a new provider requires editing 3+ files.

**Changes:**

1. Create `shared/providers.ts`:
   ```ts
   export type Provider = "openai" | "anthropic" | "google" | ... | "openai-compatible";

   export const PROVIDER_MODELS: Record<Provider, string[]> = { ... };
   export const PROVIDER_LABELS: Record<Provider, string> = { ... };
   export const PROVIDER_KEY_HINTS: Record<Provider, string> = { ... };
   export const DEFAULT_MODEL: Record<Provider, string> = {
     openai: "gpt-4o",
     anthropic: "claude-sonnet-4-20250514",
     // ... extract from server/model.ts switch defaults
   };
   ```

2. Update `src/shell/useSettings.ts`:
   - Remove `Provider`, `MODELS`, `PROVIDER_LABELS`, `PROVIDER_KEY_HINTS` definitions
   - Import from `@shared/providers`
   - Re-export for backward compatibility if other shell files import from here

3. Update `server/model.ts`:
   - Import `Provider`, `DEFAULT_MODEL` from `../../shared/providers.js`
   - Use `DEFAULT_MODEL[provider]` as fallback in each switch case instead of hardcoded strings

**Contract change note:** This creates a new file in `shared/`. Requires a lightweight ADR.

### Verification

- `npx tsc --noEmit` passes
- Manual: settings dialog still shows correct provider names, models, and key hints
- Manual: test connection works for at least one provider
- Confirm: adding a hypothetical new provider now requires editing only `shared/providers.ts` + `server/model.ts` (SDK import)

---

## Session 5: Test Foundation (Test)

**Scope:** Add unit tests for pure functions. No mocking needed.
**Complexity:** M
**Dependencies:** Session 1 (for `DEFAULT_SCORE` constant, if tests reference it)

### 5.1 Test `src/orchestrator/convergence.ts`

**File:** Create `src/orchestrator/__tests__/convergence.test.ts`

Functions to test:
- `checkConvergence(currentScores, targetScores, tolerance)` — returns `{ converged, maxDelta, deltas }`
- `checkLockFidelity(previousScores, currentScores, lockedDimensionIds, tolerance)` — returns `LockDeviation[]`

**Test cases for `checkConvergence`:**
- All scores match targets exactly (tolerance 0) -> converged: true
- One score off by 1 (tolerance 0) -> converged: false, maxDelta: 1
- One score off by 1 (tolerance 1) -> converged: true
- Empty targetScores -> converged: true (vacuous truth)
- Dimension in targets but not in currentScores -> skipped
- Multiple dimensions with varying deltas -> maxDelta is the largest

**Test cases for `checkLockFidelity`:**
- No locked dimensions -> empty array
- Locked dimension unchanged -> empty array
- Locked dimension drifted by 1 (tolerance 0) -> deviation reported
- Locked dimension drifted by 1 (tolerance 1) -> empty array
- Multiple locked dims, some drifted -> only drifted ones reported

### 5.2 Test `src/evaluation/normalize.ts`

**File:** Create `src/evaluation/__tests__/normalize.test.ts`

Functions to test:
- `normalizeScore(raw)` — clamp + round to 1-5
- `computeWeightedAverage(scores, dimensions)` — weighted average
- `scoreDelta(current, target)` — delta computation

**Test cases for `normalizeScore`:**
- 3 -> 3 (passthrough)
- 0.4 -> 1 (clamp low)
- 5.8 -> 5 (clamp high)
- 2.5 -> 3 (round up)
- 2.4 -> 2 (round down)
- -10 -> 1, 100 -> 5 (extreme values)

**Test cases for `computeWeightedAverage`:**
- Single dimension, weight 1 -> score itself
- Two dims, equal weight -> simple average
- Two dims, different weights -> weighted average
- No matching scores -> 0
- Empty dimensions -> 0

**Test cases for `scoreDelta`:**
- Simple case: current 3, target 5 -> delta 2
- Missing current dimension -> not included
- Multiple dimensions -> all deltas computed

### 5.3 Test `src/chart/helpers.ts`

**File:** Create `src/chart/__tests__/helpers.test.ts`

Functions to test:
- `maxRubricLevel(dimensions)` — returns max rubric key across all dimensions
- `clampScore(value, max)` — clamp + round to [1, max]
- `isLocked(lockedDimensions, dimensionId)` — boolean check

**Test cases for `maxRubricLevel`:**
- Empty array -> 5 (default)
- Dims with 5-level rubrics -> 5
- Dims with mixed levels (3, 5, 7) -> 7
- Dim with null rubric -> still returns 5

**Test cases for `clampScore`:**
- In range -> passthrough
- Below 1 -> 1
- Above max -> max
- Fractional -> rounded
- Default max (5) works

### 5.4 Test `src/rewriter/prompt.ts`

**File:** Create `src/rewriter/__tests__/prompt.test.ts`

Function to test:
- `buildRewritePrompt(context, rewritePlan?)` — returns `{ system, user }`

**Test cases:**
- Basic context -> system and user are non-empty strings
- With rewritePlan -> plan instructions appear in system prompt
- Without rewritePlan -> fallback template used
- Locked dimensions -> "[LOCKED]" marker appears in output
- Empty dimensions array -> no crash
- Context with existing text vs empty text (initial generation path)

### 5.5 Test orchestrator loop via DI

**File:** Create `src/orchestrator/__tests__/loop.test.ts`

The `runOrchestrationLoop` function accepts `OrchestratorDeps` for dependency injection. Tests can provide fake `scoreAll` and `rewrite` functions.

**Test cases:**
- Converges in 1 iteration -> returns immediately
- Converges in 2 iterations -> two steps
- Hits maxIterations -> stops and returns partial
- Lock deviation detected -> noted in step output
- planRewrite provided -> called before each rewrite

### Verification

- `npx vitest run` — all new tests pass
- `npx vitest run --coverage` — check coverage on tested modules

---

## Session 6: Schema/Migration Cleanup (Hardening)

**Scope:** Database migration infrastructure, field wiring, dead code cleanup, and documentation.
**Complexity:** M
**Dependencies:** None

### 6.1 Add `schema_version` table to `src/db/index.ts`

**File:** `src/db/index.ts`

Currently, the `MIGRATION_SQL` constant (line 13) uses `CREATE TABLE IF NOT EXISTS` for all tables. This works for initial setup but provides no way to run incremental migrations.

**Changes:**

1. Add a `schema_version` table to the migration SQL:
   ```sql
   CREATE TABLE IF NOT EXISTS schema_version (
     version INTEGER PRIMARY KEY,
     applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
     description TEXT
   );
   ```

2. Create a migration runner function:
   ```ts
   interface Migration {
     version: number;
     description: string;
     sql: string;
   }

   const MIGRATIONS: Migration[] = [
     { version: 1, description: "Initial schema", sql: MIGRATION_SQL },
     // Future migrations go here
   ];

   async function runMigrations(pg: AnyPGlite): Promise<void> {
     // Ensure schema_version table exists
     // Get current version
     // Run all migrations with version > current
     // Insert version record after each
   }
   ```

3. Call `runMigrations` from `doInit()` instead of running `MIGRATION_SQL` directly.

### 6.2 Wire `systemPrompt` field

**File:** `src/shell/App.tsx` (or `useWorkflows.ts` after Session 3)

Lines 247, 315, 381, 439 all pass `systemPrompt: ""` when creating prompt versions. The schema supports this field (`system_prompt TEXT NOT NULL` in `prompt_versions` table), but it's never populated.

**Changes:**

The actual system prompt is constructed server-side in the LLM route handlers. To capture it:

1. **Option A (simpler):** Have the `/api/llm/rewrite/full` and `/api/llm/evaluate` endpoints return the system prompt used alongside their result. Add `systemPrompt` to the response JSON.

2. **Option B (pragmatic):** Store a description string like `"rewrite-v1"` or `"evaluate-v1"` identifying which prompt template was used, rather than the full prompt text.

**Recommended:** Option A for the rewrite endpoint (most valuable for debugging), Option B for evaluate.

Update the `createPromptVersion` calls to pass the returned system prompt.

### 6.3 Resolve `SESSION_STATUS` enum usage

**Files:** Search all files for string literals `"idle"`, `"generating"`, `"evaluating"`, `"refining"`, `"error"`.

`shared/types.ts` defines `SESSION_STATUS` constants (lines 33-39) and `SessionStatus` type (lines 41-42). Verify whether all status string literals across the codebase use the constants or raw strings.

**Changes:**
- In `src/store/index.ts`: ensure the default `sessionStatus` value uses `SESSION_STATUS.IDLE`
- In `src/shell/App.tsx`: replace `setStatus("generating")`, `setStatus("idle")`, etc. with `setStatus(SESSION_STATUS.GENERATING)`, etc.
- Import `SESSION_STATUS` from `@shared/types` wherever needed
- If the constants are universally unused, decide: either adopt them everywhere or remove the `SESSION_STATUS` object and keep only the `SessionStatus` type

### 6.4 Remove or wire `normalizeScore`

**File:** `src/evaluation/normalize.ts`, `src/evaluation/index.ts`

`normalizeScore` is exported from both `normalize.ts` (line 13) and `index.ts` (line 6) but never imported anywhere else in the codebase (confirmed by search). It is not used in server routes either.

**Decision needed:**
- **Wire it:** Call `normalizeScore(raw)` in `scoreDimension` (in `evaluation/score.ts`) to clamp LLM-returned scores before returning. This adds safety against LLM returning out-of-range values.
- **Remove it:** Delete from both files if it's truly dead code.

**Recommended:** Wire it. Add `normalizeScore(object.score)` in `scoreDimension` after getting the LLM response.

### 6.5 Add undefined guard to `generateSingleDimension`

**File:** `src/dimensions/generate.ts`

Line 159: `return object.dimensions[0];` — if the LLM returns an empty `dimensions` array, this returns `undefined` but the function signature promises a non-optional return type `{ name, description, rubric }`.

**Change:**
```ts
const dim = object.dimensions[0];
if (!dim) {
  throw new Error(`LLM returned no dimensions for "${name}"`);
}
return dim;
```

### 6.6 Add `componentDidCatch` to ErrorBoundary

**File:** `src/shell/ErrorBoundary.tsx`

Currently uses only `getDerivedStateFromError` (line 14). Adding `componentDidCatch` enables error logging.

**Change:** Add after `getDerivedStateFromError`:
```ts
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  console.error("[ErrorBoundary]", error, errorInfo.componentStack);
}
```

### 6.7 Document `prompts` module in CLAUDE.md

**File:** `CLAUDE.md`

The `src/prompts/` module (containing `generate.ts`, `rewrite-planner.ts`, `index.ts`) is not listed in the Module Map table.

**Change:** Add row to the Module Map table:
```
| `prompts`      | Tier 1/2 meta-prompt generation: dimension eval/rewrite prompts, rewrite planner | done   |
```

### Verification

- `npx tsc --noEmit` passes
- `npx vitest run` passes
- Manual: create a session, generate dimensions, rewrite text — check that `prompt_versions` table now has non-empty `system_prompt` (if 6.2 implemented)
- Verify no remaining `normalizeScore` import warnings

---

## Session 7: Variable Score Levels 1-N (Build)

**Scope:** Support 2-7 rubric levels instead of hardcoded 1-5.
**Complexity:** L
**Dependencies:** Sessions 1 (DEFAULT_SCORE), 5 (tests to update), 6 (normalizeScore wiring)

**Important:** This requires relaxing Invariant 8 ("Spider chart values are integers 1-5"). Write ADR first.

### 7.1 Write ADR

**File:** Create `.devcontext/decisions/ADR-NNN-variable-score-levels.md`

Document:
- Current invariant: scores are 1-5
- New invariant: scores are integers 1-N where N is the max rubric level for a dimension (2 <= N <= 7)
- `EvaluationScoreSchema` already allows max(7) — no Zod change needed
- `DEFAULT_SCORE` constant now represents "midpoint" — may need to be a function: `defaultScore(maxLevel) = Math.ceil(maxLevel / 2)`

### 7.2 Update LLM prompts in `src/evaluation/score.ts`

**File:** `src/evaluation/score.ts`

Line 10 says "The rubric defines what each score (1-5) means" — hardcoded.

**Changes:**
- Pass the actual rubric level count into the system prompt: `"score from 1 to ${maxLevel}"`
- Compute maxLevel from `Object.keys(dimension.rubric).length`
- Update the `EvaluationScoreSchema` usage to dynamically set `.max(maxLevel)` via `z.number().int().min(1).max(maxLevel)` — this requires creating the schema inline per call or using `.refine()`

### 7.3 Update `GenerationRubricSchema` in `shared/types.ts`

**File:** `shared/types.ts`

Lines 54-60 define a fixed 5-key rubric schema. To support variable levels during generation, options:

**Option A:** Keep the 5-key generation schema as default (LLMs generate 5 levels), allow users to add/delete levels in the popover afterward (already partially works — add-level button exists, capped at 7).

**Option B:** Allow the LLM to generate 2-7 levels. This requires changing to `z.record()` with validation, but LLMs are less reliable with variable-length structured output.

**Recommended:** Option A. The generation schema stays at 5 levels. The runtime `RubricSchema` (line 47) already handles variable levels. Document this decision in the ADR.

### 7.4 Update spider chart rendering

**File:** `src/chart/SpiderChart.tsx`

The chart already reads `maxRubricLevel(dimensions)` from `chart/helpers.ts` for scale max. Verify that:
- The radar chart `scales.r.max` is set to `maxRubricLevel`
- Drag-data clamping uses the per-dimension max level
- `chartjs-plugin-dragdata` respects the dynamic max

**Changes (if needed):**
- Update chart config to use dynamic max from `maxRubricLevel(dimensions)`
- Update drag callbacks to clamp per the dimension's rubric level count (not global max)

### 7.5 Update score normalization

**File:** `src/evaluation/normalize.ts`

`normalizeScore` (line 13-16) hardcodes `Math.min(5, ...)`. Change to accept a `max` parameter:
```ts
export function normalizeScore(raw: number, max: number = 5): number {
  return Math.max(1, Math.min(max, Math.round(raw)));
}
```

### 7.6 Update display logic

**Files:** `src/shell/App.tsx`, `DimensionPopover.tsx` (after Session 3)

- Default target score initialization (line 217-218): use `DEFAULT_SCORE` or `Math.ceil(rubricLevels / 2)` based on dimension's rubric length
- Score display `{score}/5` -> `{score}/{maxLevel}` (already done in popover at line 564, but check elsewhere)

### 7.7 Update rewriter prompts

**Files:** `src/rewriter/prompt.ts`, `src/prompts/rewrite-planner.ts`

Line 64 in `rewrite-planner.ts` says `Current: ${current}/5`. Change to `Current: ${current}/${maxLevel}` where maxLevel comes from the dimension's rubric key count.

### Verification

- All existing tests still pass (update assertions for new parameter signatures)
- New tests: normalizeScore with max=7, clampScore with max=3, etc.
- Manual: create dimension with 3 rubric levels, evaluate — scores should be 1-3
- Manual: add levels to 7 in popover, re-evaluate — scores should be 1-7
- Manual: spider chart renders correctly with mixed-level dimensions

---

## Session 8: Streaming Rewrite (Build)

**Scope:** Implement streaming rewrite end-to-end. Despite existing stubs, this is 100% new integration work — no existing wiring connects the pieces.
**Complexity:** L
**Dependencies:** Session 3 (useWorkflows extraction makes this cleaner)

### Current State (stubs only — nothing is wired)

- **Store:** `streamingText` state exists (`src/store/index.ts:15`) — `setStreamingText` is never called by any workflow
- **Client API:** `apiRewriteStream` exists (`src/shell/api.ts:133-157`) — imported nowhere in App.tsx or any workflow
- **Server route:** `/api/llm/rewrite` uses `pipeTextStreamToResponse` — compatible with client's `TextDecoderStream` (verified, no format mismatch)
- **UI:** `TextPanel` accepts `streamingText` prop — but no code populates it

All three layers exist independently but have zero integration between them. This session connects them.

### 8.1 Verify/wire server streaming endpoint

**File:** `server/routes/llm.ts`

Check if the `/api/llm/rewrite` POST route uses `rewriteText()` (which returns a `streamText` result) and calls `result.toDataStreamResponse()`. If not, wire it:

```ts
llmRouter.post("/rewrite", async (req, res) => {
  const model = getModelConfig(req.body);
  const result = rewriteText({ model, ...req.body });
  // Use Vercel AI SDK's streaming response
  return result.pipeDataStreamToResponse(res);
});
```

### 8.2 Connect streaming to UI

**File:** `src/shell/TextPanel.tsx`

Currently `streamingText` is passed but may not be rendered. Add a typewriter display:

```tsx
// When streaming, show streamingText with a blinking cursor
{isStreaming && streamingText ? (
  <div className="prose">
    {streamingText}
    <span className="animate-pulse">|</span>
  </div>
) : (
  // existing text display
)}
```

### 8.3 Switch workflow handlers to streaming

**File:** `src/shell/useWorkflows.ts` (or `App.tsx`)

In `handleRefine`:

1. Replace `apiRewriteFull(...)` with `apiRewriteStream(...)`
2. Consume the stream incrementally:
   ```ts
   const stream = await apiRewriteStream({ ... }, getModelConfig());
   let accumulated = "";
   const reader = stream.getReader();
   while (true) {
     const { done, value } = await reader.read();
     if (done) break;
     accumulated += value;
     setStreamingText(accumulated);
   }
   setCurrentText(accumulated);
   setStreamingText("");
   ```

3. Keep `apiRewriteFull` as fallback (e.g., for orchestrator loop where streaming is not needed)

### 8.4 Handle stream errors gracefully

Add try/catch around the streaming read loop. If the stream errors mid-way:
- Keep whatever text was accumulated
- Set error state
- Clear streaming state

### Verification

- `npx tsc --noEmit` passes
- Manual: click Refine — text should appear incrementally in the TextPanel
- Manual: cancel/error during stream — graceful recovery
- Manual: orchestration loop still works (uses non-streaming path)

---

## Summary Table

| Session | Scope | Complexity | Dependencies | Key Files |
|---------|-------|-----------|--------------|-----------|
| 1 | Quick Wins | S | None | `rewriter/stream.ts`, `chart/SpiderChart.tsx`, `shared/types.ts`, `rewriter/prompt.ts`, `prompts/rewrite-planner.ts`, `shell/App.tsx` |
| 2 | Module Boundary Fix | M | None | `shell/App.tsx`, `store/index.ts`, `shared/types.ts` |
| 3 | App.tsx Decomposition | L | Session 2 (**BLOCKED**) | `shell/App.tsx` → `shell/DimensionPopover.tsx`, `shell/useWorkflows.ts`, `dimensions/rubric-helpers.ts` |
| 4 | Provider Registry | S | None | `shared/providers.ts` (new), `shell/useSettings.ts`, `server/model.ts` |
| 5 | Test Foundation | M | None | `orchestrator/__tests__/`, `evaluation/__tests__/`, `chart/__tests__/`, `rewriter/__tests__/` |
| 6 | Schema/Migration Cleanup | M | None | `db/index.ts`, `shell/App.tsx`, `evaluation/score.ts`, `dimensions/generate.ts`, `shell/ErrorBoundary.tsx`, `CLAUDE.md` |
| 7 | Variable Score Levels | L | Sessions 5, 6 | `shared/types.ts`, `evaluation/score.ts`, `evaluation/normalize.ts`, `chart/SpiderChart.tsx`, `rewriter/prompt.ts`, `prompts/rewrite-planner.ts` |
| 8 | Streaming Rewrite | L | Session 3 | `server/routes/llm.ts`, `shell/TextPanel.tsx`, `shell/useWorkflows.ts`, `shell/api.ts` |

## Parallelization

Sessions that can run in parallel (no dependencies between them):
- **Wave 1:** Sessions 1, 2, 4, 5, 6 (all independent — tests moved here for safety net)
- **Wave 2:** Sessions 3, 7 (3 blocked on 2; 7 depends on 5+6)
- **Wave 3:** Session 8 (depends on 3)

Moving Session 5 (tests) to Wave 1 ensures refactoring in Waves 2-3 has a safety net. Session 5's only prior dependency was on Session 1's `DEFAULT_SCORE` constant — tests can use the literal `3` initially and update after Session 1 lands.

## Risks

### Addressed by pre-mortem (2026-04-05)

1. **~~Session 2: Server routes impossible~~** — PGlite runs in-browser only. Server has no DB access. **Fixed:** Session 2.1 rewritten to use store-mediation approach instead of API routes.

2. **~~Session 3: Invariant violation migrates if extracted early~~** — **Fixed:** Explicit blocking note added. Session 3 cannot start until Session 2 lands.

3. **~~Session 8: Scope underestimated~~** — Streaming stubs exist but have zero integration. **Fixed:** Session 8 description updated to reflect this is full new integration, not glue work.

4. **~~No tests before refactoring~~** — **Fixed:** Session 5 promoted to Wave 1.

### Remaining risks

5. **Session 2 (store as coupling bottleneck):** The store now imports from `dimensions/crud`, making it the mediator for state + persistence + cross-module CRUD. Acceptable tradeoff — the store is foundational infrastructure. Monitor file size; consider splitting into slices if it grows past 300 lines.

6. **Session 7 (variable scores):** Blast radius is narrower than it appears (~5 string substitutions in LLM prompts + one signature change on `normalizeScore`). Chart and schema already support variable levels. Still requires comprehensive testing due to cross-module nature.

7. **Session 6.1 (migration bootstrap):** Existing deployed instances have all tables but no `schema_version` record. The migration runner must detect "tables exist, no version row" and insert version 1 without re-running SQL. Use `INSERT INTO schema_version ... ON CONFLICT DO NOTHING` or check table existence before running.
