# Integration Plan: textchisel End-to-End Wiring

Generated: 2026-03-08

## Goal

Wire all 8 individually-built modules into a working end-to-end system. Currently, the shell module uses local React state (useState) with temporary crypto.randomUUID() IDs, no PGlite persistence, and no real LLM calls have been tested. This plan transforms the app from "8 isolated modules with 139 passing tests" into a functioning prompt engineering workbench.

## Current State Summary

**What works independently (mocked/unit-tested):**

- `dimensions/generate.ts` -- generateObject call to produce dimensions from intent
- `dimensions/crud.ts` -- PGlite CRUD (createDimensions, getDimensionsBySession, update, delete)
- `evaluation/score.ts` -- G-Eval scoring per dimension via generateObject
- `evaluation/cache.ts` -- PGlite eval step cache (read/write)
- `rewriter/prompt.ts` -- meta-prompt construction from RewriteContext
- `rewriter/stream.ts` -- streamText / rewriteTextFull via Vercel AI SDK
- `orchestrator/loop.ts` -- evaluate-then-rewrite loop with convergence detection (deps injected)
- `chart/SpiderChart.tsx` -- radar chart with drag/lock
- `store/index.ts` -- Zustand store (targetScores, lockedDimensions, UI state)
- `shell/App.tsx` -- full UI layout, wired to API endpoints, but uses local state
- `server/routes/llm.ts` -- 5 Express endpoints that import module functions directly

**What is NOT wired:**

1. PGlite is never initialized at app startup (initDatabase() never called)
2. Dimensions get temporary client-side UUIDs instead of PGlite-generated IDs
3. No session is created in PGlite -- sessionId is hardcoded "local"
4. No prompt versions are saved after rewrites
5. Shell App.tsx uses useState for intent, dimensions, currentText, currentScores
6. Store only holds targetScores, lockedDimensions, and UI flags -- not the primary data
7. No streaming rewrite in UI (uses apiRewriteFull)
8. No version timeline component
9. No provider config UI
10. Real LLM calls untested

## Architecture Decision: Where State Lives

This is the critical design question. The current architecture document says:

- **PGlite** = persistent data (sessions, dimensions, prompt versions, eval cache)
- **Zustand** = UI state + undo/redo (target scores, locked dimensions, sidebar, active session)
- **PGlite useLiveQuery** = reactive bridge (data changes in PGlite auto-update React)

The shell currently puts EVERYTHING in local React state. The integration must redistribute state to the correct layer:

| Data             | Current Location    | Target Location                                      | Reactive Mechanism                      |
| ---------------- | ------------------- | ---------------------------------------------------- | --------------------------------------- |
| intent           | useState in App.tsx | PGlite sessions table (intent column)                | useLiveQuery or load-on-mount           |
| dimensions       | useState in App.tsx | PGlite dimensions table                              | useLiveQuery                            |
| currentText      | useState in App.tsx | PGlite prompt_versions.generated_text                | load from latest version                |
| currentScores    | useState in App.tsx | PGlite eval_step_cache (or in-memory after evaluate) | local state OK (ephemeral until cached) |
| targetScores     | Zustand store       | Zustand store (keep)                                 | already wired                           |
| lockedDimensions | Zustand store       | Zustand store (keep)                                 | already wired                           |
| status           | useState in App.tsx | Zustand store (sessionStatus)                        | move to store                           |
| error            | useState in App.tsx | local state OK                                       | keep local                              |
| streamingText    | useState in App.tsx | local state OK (ephemeral)                           | keep local                              |

**Key insight:** We do NOT need to move everything to PGlite immediately. The MVP integration path is:

1. Initialize PGlite on mount
2. Create a session when user enters intent
3. Save dimensions to PGlite after generation (get real UUIDs back)
4. Save prompt versions after each rewrite
5. Keep currentScores and streamingText as local state (ephemeral, recalculated)

This avoids the complexity of useLiveQuery for V1 while getting persistence right.

---

## Phase 1: Database Initialization and Session Management

**Goal:** PGlite starts on app load, a session is created when the user first generates dimensions.

**Depends on:** Nothing (foundation work)

### Files to modify

- `src/main.tsx` -- Initialize PGlite before rendering App
- `src/shell/App.tsx` -- Create session on first generate, store sessionId
- `src/store/index.ts` -- Add intent to store state (optional, or keep in App)

### Step 1.1: Initialize PGlite on mount

In `src/main.tsx`, call `initDatabase()` before `createRoot().render()`:

```typescript
// src/main.tsx
import { initDatabase } from "@/db";

async function boot() {
  await initDatabase();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

boot();
```

**Why async boot:** PGlite.create() is async (opens IndexedDB). The app must not render until the DB is ready, otherwise getDb() throws "Database not initialized."

### Step 1.2: Create session helper

Add a `createSession` function to the db module. The db module currently only has `initDatabase`, `getPglite`, and `getDb` in `src/db/index.ts`. We need a query layer.

Create `src/db/queries.ts` (new file):

```typescript
import { getDb } from "./index";
import { sessions } from "@shared/schema";
import type { Session } from "@shared/types";

export async function createSession(intent: string): Promise<Session> {
  const db = getDb();
  const result = await db.insert(sessions).values({ intent }).returning();
  return result[0];
}

export async function getSession(id: string): Promise<Session | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  return result[0] ?? null;
}
```

Update `src/db/index.ts` to re-export:

```typescript
export { initDatabase, getPglite, getDb } from "./client"; // rename if needed
export { createSession, getSession } from "./queries";
```

**Note:** The db module currently has `client.ts` as the only file, exported via `index.ts`. The `index.ts` barrel just re-exports from client.ts. We need to be careful about the import path since `dimensions/crud.ts` already imports `getDb` from `@/db` (which resolves to `src/db/index.ts`).

Currently `src/db/index.ts` content is identical to `src/db/client.ts` (it IS client.ts -- there's only one file). We need to either:

- Add queries.ts and update index.ts to re-export both, OR
- Put session queries directly in App.tsx using getDb() (simpler for MVP)

**Recommendation:** Add `src/db/queries.ts` for session CRUD, update `src/db/index.ts` to re-export. This follows the same pattern as `dimensions/crud.ts` (which uses `getDb()` from `@/db`).

**However:** This creates a cross-module import concern. The invariant says "modules never import from each other." But `db` is a foundation module that all other modules use. The `dimensions/crud.ts` already imports from `@/db`. So adding session queries to `src/db/queries.ts` is consistent.

### Step 1.3: Wire session creation into App.tsx

Modify `handleGenerate` in `src/shell/App.tsx`:

```typescript
// Before (current):
const dims: Dimension[] = result.dimensions.map((d, i) => ({
  id: crypto.randomUUID(),
  sessionId: "local",
  ...
}));

// After:
// 1. Create session in PGlite
const session = await createSession(intent);
setSessionId(session.id);
// 2. Save dimensions to PGlite (get real UUIDs)
const dims = await createDimensions(session.id, result.dimensions);
setDimensions(dims);
```

New state: `const [sessionId, setSessionId] = useState<string | null>(null);`

### Acceptance criteria

- [ ] App renders only after PGlite is initialized
- [ ] Generating dimensions creates a session row in PGlite
- [ ] Dimensions have PGlite-generated UUIDs (not crypto.randomUUID())
- [ ] Dimensions are persisted in PGlite dimensions table
- [ ] getDb() never throws "not initialized" during normal operation
- [ ] All 139 existing tests still pass

### Test strategy

- Unit test: `createSession` returns a session with UUID and intent
- Unit test: `getSession` retrieves by ID
- Integration test: boot sequence (initDatabase -> createSession -> createDimensions -> getDimensionsBySession)
- File: `tests/integration/session-lifecycle.test.ts`

---

## Phase 2: Dimension Persistence via PGlite

**Goal:** When dimensions are generated via the LLM API, they are persisted in PGlite with real UUIDs. The evaluate and rewrite flows use PGlite-stored dimensions.

**Depends on:** Phase 1 (session exists in PGlite)

### Files to modify

- `src/shell/App.tsx` -- Replace temporary UUID logic with PGlite persistence
- `src/shell/api.ts` -- No changes needed (API returns raw LLM output, persistence is client-side)

### Step 2.1: Wire dimension persistence in handleGenerate

The `handleGenerate` callback in App.tsx currently:

1. Calls `apiGenerateDimensions(intent)` to get raw LLM output (names, descriptions, rubrics)
2. Maps results to `Dimension[]` with `crypto.randomUUID()` IDs and `sessionId: "local"`
3. Sets local state

After integration:

1. Calls `apiGenerateDimensions(intent)` (unchanged)
2. If no session exists, calls `createSession(intent)` to get a PGlite session
3. Calls `createDimensions(sessionId, result.dimensions)` to persist in PGlite
4. Sets local state from the returned PGlite rows (which have real UUIDs)

```typescript
const handleGenerate = useCallback(async () => {
  setStatus("generating");
  setError(null);
  try {
    const result = await apiGenerateDimensions(intent);

    // Create or reuse session
    let sid = sessionId;
    if (!sid) {
      const session = await createSession(intent);
      sid = session.id;
      setSessionId(sid);
    }

    // Persist dimensions in PGlite (returns rows with real UUIDs)
    const dims = await createDimensions(sid, result.dimensions);
    setDimensions(dims);

    // Initialize target scores
    for (const dim of dims) {
      setTargetScore(dim.id, 3);
    }
    setCurrentScores({});
    setStatus("idle");
  } catch (err) {
    setError(String(err));
    setStatus("error");
  }
}, [intent, sessionId, setTargetScore]);
```

### Step 2.2: Handle re-generation (intent change)

When the user edits the intent and re-generates dimensions:

- Option A: Create a new session (clean slate)
- Option B: Delete old dimensions, insert new ones in same session

**Recommendation:** Option A (new session). Simpler, matches the immutable-version philosophy. The old session and dimensions remain in PGlite for history.

```typescript
// Clear old state, create new session
setSessionId(null); // Forces new session creation in handleGenerate
setDimensions([]);
setCurrentText("");
setCurrentScores({});
```

### Acceptance criteria

- [ ] Dimensions returned from PGlite have real UUID primary keys
- [ ] Dimensions are queryable via `getDimensionsBySession(sessionId)`
- [ ] Dimension IDs used in targetScores (Zustand) match PGlite IDs
- [ ] Re-generating dimensions creates a new session
- [ ] Chart renders correctly with PGlite-sourced dimension IDs
- [ ] Evaluate and rewrite use PGlite dimension IDs (consistency check)

### Test strategy

- Integration test: generate -> persist -> retrieve -> verify IDs match
- Integration test: re-generate creates new session, old dimensions preserved
- File: extend `tests/integration/session-lifecycle.test.ts`

---

## Phase 3: Prompt Version Persistence

**Goal:** After each rewrite (or orchestration), save the result as an immutable PromptVersion in PGlite. Build the foundation for version timeline.

**Depends on:** Phase 2 (session + dimensions exist in PGlite)

### Files to create/modify

- `src/db/queries.ts` -- Add prompt version CRUD functions
- `src/shell/App.tsx` -- Save prompt version after rewrite completes

### Step 3.1: Add prompt version queries

Add to `src/db/queries.ts`:

```typescript
import { promptVersions } from "@shared/schema";
import { eq, desc, max } from "drizzle-orm";
import type { PromptVersion, NewPromptVersion } from "@shared/types";

export async function createPromptVersion(
  data: Omit<NewPromptVersion, "id" | "createdAt">,
): Promise<PromptVersion> {
  const db = getDb();
  const result = await db.insert(promptVersions).values(data).returning();
  return result[0];
}

export async function getLatestVersion(
  sessionId: string,
): Promise<PromptVersion | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.sessionId, sessionId))
    .orderBy(desc(promptVersions.versionNum))
    .limit(1);
  return result[0] ?? null;
}

export async function getVersionsBySession(
  sessionId: string,
): Promise<PromptVersion[]> {
  const db = getDb();
  return db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.sessionId, sessionId))
    .orderBy(desc(promptVersions.versionNum));
}

export async function getNextVersionNum(sessionId: string): Promise<number> {
  const latest = await getLatestVersion(sessionId);
  return (latest?.versionNum ?? 0) + 1;
}
```

### Step 3.2: Save prompt version after rewrite

In App.tsx `handleRefine`, after getting the rewritten text:

```typescript
const handleRefine = useCallback(async () => {
  setStatus("refining");
  setError(null);
  try {
    const text = await apiRewriteFull({ ... });
    setCurrentText(text);

    // Save as immutable prompt version
    if (sessionId) {
      const versionNum = await getNextVersionNum(sessionId);
      await createPromptVersion({
        sessionId,
        versionNum,
        systemPrompt: "", // Could store the rewrite system prompt
        userTemplate: intent,
        generatedText: text,
        scores: Object.fromEntries(
          Object.entries(currentScores).map(([id, s]) => [id, s.score])
        ),
      });
    }

    setStatus("idle");
  } catch (err) { ... }
}, [...]);
```

### Step 3.3: Track version count in local state

Add `const [versionCount, setVersionCount] = useState(0)` and increment after each save. This will later feed the version timeline UI.

### Acceptance criteria

- [ ] Each rewrite creates a new row in prompt_versions table
- [ ] Version numbers increment sequentially within a session
- [ ] generatedText stores the full rewritten text
- [ ] scores JSONB stores the evaluation scores at time of rewrite
- [ ] Prompt versions are immutable (never updated)
- [ ] Version history is queryable by session ID

### Test strategy

- Unit test: `createPromptVersion` returns correct shape
- Unit test: `getNextVersionNum` increments correctly
- Integration test: rewrite -> save version -> verify retrieval
- File: `tests/integration/prompt-versions.test.ts`

---

## Phase 4: Store Wiring (Move Status to Zustand)

**Goal:** Move session-level state from local useState to Zustand store for consistency and undo/redo support.

**Depends on:** Phase 1-3 (persistence works)

### Files to modify

- `src/store/index.ts` -- Add intent, dimensions, currentText, currentScores, status slices
- `src/shell/App.tsx` -- Replace useState with useAppStore selectors

### Step 4.1: Extend Zustand store with data slices

The current store has three slices: PromptState, EvaluationState, UIState. We need to add data that's currently in useState:

```typescript
interface DataState {
  sessionId: string | null;
  intent: string;
  dimensions: Dimension[];
  currentText: string;
  currentScores: Record<string, EvaluationScore>;
  streamingText: string;
  status: "idle" | "generating" | "evaluating" | "refining" | "error";
  error: string | null;

  setSessionId: (id: string | null) => void;
  setIntent: (intent: string) => void;
  setDimensions: (dims: Dimension[]) => void;
  setCurrentText: (text: string) => void;
  setCurrentScores: (scores: Record<string, EvaluationScore>) => void;
  setStreamingText: (text: string) => void;
  setStatus: (status: DataState["status"]) => void;
  setError: (error: string | null) => void;
  resetSession: () => void;
}
```

**Important considerations:**

1. **Temporal (undo/redo) partialize:** Currently tracks systemPrompt, userTemplate, targetScores. We should add currentText and intent to enable undo on text changes. Do NOT add status, error, streamingText (ephemeral).

2. **Persist partialize:** Currently saves systemPrompt, userTemplate, targetScores, sidebarOpen. We should add sessionId, intent. Do NOT persist dimensions, currentText, currentScores (these come from PGlite on load).

3. **Set serialization:** lockedDimensions is a `Set<string>` which is not JSON-serializable. The current persist config does NOT include it, so this is OK. But if we add dimensions (which have Date fields), we need to handle serialization.

**Recommendation for MVP:** Keep dimensions, currentText, and currentScores as local state in App.tsx for now. Only move intent and status to the store. The full store migration is a follow-up hardening task.

**Revised approach -- Minimal store changes:**

```typescript
// Add to UIState (already exists):
interface UIState {
  // ... existing fields ...
  status: "idle" | "generating" | "evaluating" | "refining" | "error";
  setStatus: (status: UIState["status"]) => void;
}
```

Move only `status` to the store (so ControlBar and other components can read it without prop drilling). Keep data in local state for now.

### Step 4.2: Wire App.tsx to use store for status

Replace `const [status, setStatus] = useState<Status>("idle")` with:

```typescript
const status = useAppStore((s) => s.status);
const setStatus = useAppStore((s) => s.setStatus);
```

### Acceptance criteria

- [ ] Status is readable from the store (no prop drilling for status)
- [ ] Temporal undo/redo partialize is unchanged or explicitly updated
- [ ] Persist partialize does not include non-serializable data
- [ ] All existing store tests still pass
- [ ] Shell component tests still pass with store mocking

### Test strategy

- Update existing store tests to cover new status slice
- Verify shell component tests still pass (they use props, not store directly, except ChartPanel)
- File: update `tests/unit/smoke.test.ts` (store tests are here or inline)

---

## Phase 5: Real LLM Call Verification

**Goal:** Verify that the full API pipeline works with real LLM providers (OpenAI and/or Anthropic).

**Depends on:** Phase 1-2 (persistence works so we can test the full flow)

### Prerequisites

- `.env` file with valid `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- Server running (`npm run dev:server` on port 3001)

### Step 5.1: Manual smoke test script

Create `scripts/smoke-test-llm.ts` -- a CLI script that calls the server endpoints:

```typescript
// scripts/smoke-test-llm.ts
// Run: npx tsx scripts/smoke-test-llm.ts

const BASE = "http://localhost:3001/api/llm";

async function main() {
  console.log("1. Generate dimensions...");
  const dimRes = await fetch(`${BASE}/dimensions/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "Write a professional email declining a meeting",
    }),
  });
  const dims = await dimRes.json();
  console.log(
    `   Generated ${dims.dimensions.length} dimensions:`,
    dims.dimensions.map((d) => d.name),
  );

  // Build Dimension objects with fake IDs for evaluation
  const dimensions = dims.dimensions.map((d, i) => ({
    id: `dim-${i}`,
    sessionId: "smoke",
    name: d.name,
    description: d.description,
    weight: 1.0,
    locked: false,
    rubric: d.rubric,
    sortOrder: i,
    createdAt: new Date().toISOString(),
  }));

  const sampleText =
    "Hi, I won't be able to make the meeting tomorrow. Sorry about that.";

  console.log("\n2. Evaluate text...");
  const evalRes = await fetch(`${BASE}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: sampleText, dimensions }),
  });
  const scores = await evalRes.json();
  console.log(
    "   Scores:",
    Object.entries(scores).map(([id, s]) => `${id}: ${s.score}/5`),
  );

  console.log("\n3. Rewrite text (full)...");
  const targetScores = {};
  for (const dim of dimensions) {
    targetScores[dim.id] = 5;
  }
  const rewriteRes = await fetch(`${BASE}/rewrite/full`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "Write a professional email declining a meeting",
      currentText: sampleText,
      dimensions,
      currentScores: scores,
      targetScores,
      lockedDimensionIds: [],
    }),
  });
  const rewriteData = await rewriteRes.json();
  console.log(
    "   Rewritten text:",
    rewriteData.text?.substring(0, 200) + "...",
  );

  console.log("\n4. Orchestrate (evaluate->rewrite loop)...");
  const orchRes = await fetch(`${BASE}/orchestrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "Write a professional email declining a meeting",
      currentText: sampleText,
      dimensions,
      currentScores: scores,
      targetScores,
      lockedDimensionIds: [],
      maxIterations: 2,
    }),
  });
  const orchData = await orchRes.json();
  console.log(
    `   ${orchData.totalIterations} iterations, converged: ${orchData.converged}`,
  );
  console.log("   Final text:", orchData.finalText?.substring(0, 200) + "...");

  console.log("\nSmoke test complete.");
}

main().catch(console.error);
```

### Step 5.2: Integration test with real LLM (optional, tagged)

Create `tests/integration/llm-live.test.ts` -- skipped by default (requires API key):

```typescript
import { describe, it, expect } from "vitest";

const SKIP = !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY;

describe.skipIf(SKIP)("Live LLM integration", () => {
  it("should generate dimensions from intent", async () => {
    // Direct function call (not via HTTP)
    const { generateDimensions } = await import("@/dimensions/generate");
    const { createModel } = await import("../../server/model");
    const model = createModel();
    const result = await generateDimensions("Write a persuasive essay", {
      model,
    });
    expect(result.dimensions.length).toBeGreaterThanOrEqual(3);
    expect(result.dimensions.length).toBeLessThanOrEqual(6);
  }, 30000);
});
```

### Step 5.3: Verify error handling

Test these failure scenarios:

- Invalid/missing API key (should return 500 with meaningful error)
- Empty intent (should return 400)
- Empty dimensions array for evaluation (should handle gracefully)
- Network timeout (long LLM response)

### Acceptance criteria

- [ ] `scripts/smoke-test-llm.ts` runs end-to-end with a valid API key
- [ ] Dimension generation returns 4-6 dimensions with names, descriptions, rubrics
- [ ] Evaluation returns integer scores 1-5 with reasoning for each dimension
- [ ] Rewrite returns modified text (non-empty, different from input)
- [ ] Orchestrate completes within maxIterations
- [ ] Error responses have meaningful error messages
- [ ] Streaming endpoint (/api/llm/rewrite) returns SSE data

### Test strategy

- Manual: `npx tsx scripts/smoke-test-llm.ts` (requires server running + API key)
- Automated: `tests/integration/llm-live.test.ts` (skipped without API key)
- Cost consideration: each full smoke test ~10-15 API calls, ~$0.05-0.15

---

## Phase 6: Orchestrator E2E Wiring

**Goal:** The orchestrate button/flow works through the server, running the evaluate-then-rewrite loop and returning the final result to the UI.

**Depends on:** Phase 5 (LLM calls work)

### Files to modify

- `src/shell/App.tsx` -- Add orchestrate handler
- `src/shell/ControlBar.tsx` -- Add "Auto-Refine" button (or repurpose "Refine")

### Step 6.1: Add orchestrate flow to App.tsx

Currently, the "Refine" button calls `apiRewriteFull` (single rewrite). For the orchestrator, we add an "Auto-Refine" option that calls `apiOrchestrate`:

```typescript
const handleOrchestrate = useCallback(async () => {
  setStatus("refining");
  setError(null);
  try {
    const result = await apiOrchestrate({
      intent,
      currentText,
      dimensions,
      currentScores,
      targetScores,
      lockedDimensionIds: Array.from(lockedDimensions),
      maxIterations: 3,
      convergenceTolerance: 1,
      lockTolerance: 1,
    });

    setCurrentText(result.finalText);
    setCurrentScores(result.finalScores);

    // Save final version to PGlite
    if (sessionId) {
      const versionNum = await getNextVersionNum(sessionId);
      await createPromptVersion({
        sessionId,
        versionNum,
        systemPrompt: "",
        userTemplate: intent,
        generatedText: result.finalText,
        scores: Object.fromEntries(
          Object.entries(result.finalScores).map(([id, s]) => [id, s.score]),
        ),
      });
    }

    setStatus("idle");
  } catch (err) {
    setError(String(err));
    setStatus("error");
  }
}, [
  intent,
  currentText,
  dimensions,
  currentScores,
  targetScores,
  lockedDimensions,
  sessionId,
]);
```

### Step 6.2: Add auto-refine button to ControlBar

Extend ControlBar props:

```typescript
interface ControlBarProps {
  // ... existing ...
  canOrchestrate: boolean;
  onOrchestrate: () => void;
}
```

Add a third button: "Auto-Refine" (runs full loop) vs existing "Refine" (single pass).

### Step 6.3: Update chart after orchestration

After orchestration completes, the chart should update to show the final scores. Since `setCurrentScores(result.finalScores)` is called, and ChartPanel reads currentScores from props, this should work automatically.

### Acceptance criteria

- [ ] Auto-Refine button triggers the orchestrator endpoint
- [ ] Loop runs up to maxIterations and returns final text + scores
- [ ] Chart updates to show final evaluation scores
- [ ] Final version is saved to PGlite prompt_versions
- [ ] Lock fidelity is respected (locked dimension scores don't drift)
- [ ] UI shows "refining" status during orchestration

### Test strategy

- Integration test with mocked LLM: verify orchestrate flow saves version
- Manual test with real LLM: verify convergence behavior
- File: `tests/integration/orchestrator-e2e.test.ts`

---

## Phase 7: Full System Flow (UI to Chart Update)

**Goal:** The complete user journey works: intent -> generate -> evaluate -> drag chart -> refine -> chart updates.

**Depends on:** Phases 1-6

### The complete flow

```
1. User types intent ("Write a professional email declining a meeting")
2. User clicks "Generate Dimensions"
   -> API call to /api/llm/dimensions/generate
   -> LLM returns 4-6 dimensions with rubrics
   -> Session created in PGlite
   -> Dimensions saved to PGlite
   -> Chart renders with dimensions as axes, targets at 3
3. User types/pastes text in TextPanel
4. User clicks "Evaluate"
   -> API call to /api/llm/evaluate
   -> LLM scores each dimension (parallel)
   -> Chart shows blue (current) scores
5. User drags chart points to set targets
   -> targetScores updated in Zustand store
   -> Chart shows orange (target) overlay
6. User clicks "Refine" (single) or "Auto-Refine" (loop)
   -> API call to /api/llm/rewrite/full or /api/llm/orchestrate
   -> LLM rewrites text toward targets
   -> TextPanel updates with new text
   -> Prompt version saved to PGlite
7. User clicks "Evaluate" again
   -> New scores shown on chart
   -> Loop repeats from step 5
```

### Files to modify

- `src/shell/App.tsx` -- Final wiring, auto-evaluate after rewrite
- `src/shell/ChartPanel.tsx` -- Verify chart updates reactively

### Step 7.1: Auto-evaluate after rewrite (optional UX improvement)

After a rewrite completes, automatically trigger evaluation so the user sees updated scores without clicking "Evaluate":

```typescript
// In handleRefine, after setCurrentText(text):
// Auto-evaluate the rewritten text
const scores = await apiEvaluate(text, dimensions);
setCurrentScores(scores);
```

This makes the flow: Refine -> see new text AND new scores simultaneously.

### Step 7.2: Streaming rewrite (enhancement)

Switch from `apiRewriteFull` to `apiRewriteStream` for real-time feedback:

```typescript
const handleRefine = useCallback(async () => {
  setStatus("refining");
  setStreamingText("");
  setError(null);
  try {
    const stream = await apiRewriteStream({ ... });
    let fullText = "";
    for await (const chunk of stream) {
      fullText += chunk;
      setStreamingText(fullText);
    }
    setCurrentText(fullText);
    setStreamingText("");
    setStatus("idle");
  } catch (err) { ... }
}, [...]);
```

**Note:** The `apiRewriteStream` function already exists in `src/shell/api.ts` and returns a `ReadableStream<string>`. However, Vercel AI SDK's `pipeDataStreamToResponse` uses a specific wire format (data stream protocol), not raw text. The client needs to use the AI SDK's data stream parsing, OR the server needs to use `result.toTextStreamResponse()` instead of `result.pipeDataStreamToResponse()`.

**Issue to investigate:** The server currently uses `result.pipeDataStreamToResponse(res)` which sends the Vercel AI data stream format (prefixed lines). The client's `apiRewriteStream` does `res.body.pipeThrough(new TextDecoderStream())` which would receive the raw protocol, not clean text. This needs to be reconciled:

- Option A: Server uses `result.toTextStreamResponse(res)` for plain text streaming
- Option B: Client uses Vercel AI SDK's `useChat` or `readDataStream` to parse the protocol

**Recommendation:** Option A is simpler. Change server to pipe plain text. The data stream protocol is designed for `useChat`/`useCompletion` hooks, which we're not using.

### Step 7.3: Verify chart reactivity

Ensure the ChartPanel re-renders when:

- `dimensions` changes (new dimensions generated)
- `currentScores` changes (after evaluation)
- `targetScores` changes (from drag or store update)

Currently ChartPanel receives dimensions and currentScores as props, reads targetScores from store. This should work correctly as long as the parent (App.tsx) passes the updated state.

### Acceptance criteria

- [ ] Full user journey works end-to-end (manual test)
- [ ] Chart shows current scores (blue) after evaluation
- [ ] Chart shows target scores (orange) that are draggable
- [ ] Refine updates text and optionally auto-evaluates
- [ ] Version number increments visible somewhere (badge, toast, or timeline placeholder)
- [ ] Error states show meaningful messages to the user
- [ ] No console errors during normal operation

### Test strategy

- Manual E2E test with real LLM (documented test script)
- Cypress or Playwright E2E test (future, not in this integration)
- Verify no regressions: `npm run test:run` passes all 139+ tests

---

## Phase 8: Cleanup and Hardening

**Goal:** Fix any issues found during integration, add missing error handling, update documentation.

**Depends on:** Phases 1-7

### Step 8.1: Error boundary

Add a React error boundary around the App to catch rendering errors:

```typescript
// src/shell/ErrorBoundary.tsx
class ErrorBoundary extends React.Component { ... }
```

### Step 8.2: Loading state

Show a loading indicator while PGlite initializes (Phase 1 boot sequence):

```typescript
// src/main.tsx
function BootLoader() {
  const [ready, setReady] = useState(false);
  useEffect(() => { initDatabase().then(() => setReady(true)); }, []);
  if (!ready) return <div>Loading database...</div>;
  return <App />;
}
```

### Step 8.3: Update CLAUDE.md

Update module statuses, add "Phase 5: Integration" to phase tracker, document any new decisions.

### Step 8.4: Write handoff note

Create `thoughts/shared/handoffs/general/YYYY-MM-DD_HH-MM_integration.yaml` documenting what was done, decisions made, and what's left.

### Acceptance criteria

- [ ] Error boundary catches rendering errors gracefully
- [ ] Loading state shown during PGlite init
- [ ] CLAUDE.md updated with integration status
- [ ] Handoff note written
- [ ] All tests pass (139 existing + new integration tests)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No lint errors (`npm run lint`)

---

## Risk Areas and Mitigation

### Risk 1: PGlite Initialization Timing (HIGH)

**Problem:** If React renders before PGlite is ready, any component that calls getDb() will throw. The dimensions/crud module, db/queries module, and evaluation/cache module all call getDb().

**Mitigation:** Async boot in main.tsx. PGlite must be initialized before createRoot().render(). Use a BootLoader component if needed.

**Fallback:** Add a `dbReady` flag to the store and guard all db calls with it.

### Risk 2: Streaming Protocol Mismatch (MEDIUM)

**Problem:** Server uses `pipeDataStreamToResponse()` (Vercel AI data stream format) but client expects raw text via `TextDecoderStream`. The data stream protocol includes prefixed lines like `0:"text chunk"\n` which are not raw text.

**Mitigation:** Either:

- Change server endpoint to use `result.toTextStreamResponse(res)` for plain text
- Or add a new `/api/llm/rewrite/stream-text` endpoint that sends plain text
- Do NOT change the existing `/api/llm/rewrite` endpoint if other consumers rely on it

**Impact:** Streaming rewrite will show protocol artifacts in the TextPanel if not fixed.

### Risk 3: Dimension ID Mismatch (MEDIUM)

**Problem:** When dimensions are generated, the server returns raw LLM output (no IDs). The client currently assigns crypto.randomUUID() IDs. After integration, PGlite assigns IDs. If the evaluate/rewrite API calls use client-assigned IDs but PGlite has different IDs, score lookups fail.

**Mitigation:** After Phase 2, ALL dimension IDs come from PGlite. The client never assigns IDs. Ensure the API calls to /evaluate and /rewrite send the PGlite-sourced dimensions (with real IDs). Since the server endpoints accept dimensions as JSON in the request body, the IDs will be whatever the client sends. This is already correct -- we just need to make sure `setDimensions(dims)` uses the PGlite-returned rows.

### Risk 4: PGlite IndexedDB in Tests (LOW)

**Problem:** Unit tests run in jsdom which supports IndexedDB via jsdom mocks. PGlite uses `idb://textchisel` for browser persistence. In tests, we use in-memory PGlite (no dataDir).

**Mitigation:** Existing integration tests already use in-memory PGlite successfully. New tests should follow the same pattern (see `tests/integration/dimensions-evaluation.test.ts`).

### Risk 5: Concurrent LLM Calls During Orchestration (LOW)

**Problem:** The orchestrator calls `scoreAllDimensions` which runs `Promise.all` over all dimensions (4-6 parallel API calls). Some providers may rate-limit.

**Mitigation:** Default maxIterations is 3, with 4-6 dimensions = 12-18 evaluation calls + 3 rewrite calls. This is within reasonable limits for OpenAI/Anthropic. Add retry logic in a follow-up hardening session if needed.

### Risk 6: Store Set Serialization (LOW)

**Problem:** `lockedDimensions` is a `Set<string>` in the Zustand store. The persist middleware uses `JSON.stringify`. Set is not JSON-serializable. Currently, lockedDimensions is excluded from the persist partialize, so this is not an issue. But if someone adds it to partialize, locks would be lost on reload.

**Mitigation:** Document this in CLAUDE.md invariants. If locks need persistence, convert to `string[]` in the persist layer.

---

## Testing Strategy Summary

| Phase | Test Type                 | File                                                              | What It Verifies                       |
| ----- | ------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| 1     | Unit + Integration        | `tests/integration/session-lifecycle.test.ts`                     | PGlite init, session CRUD              |
| 2     | Integration               | `tests/integration/session-lifecycle.test.ts`                     | Dimension persistence with real UUIDs  |
| 3     | Integration               | `tests/integration/prompt-versions.test.ts`                       | Version CRUD, immutability             |
| 4     | Unit                      | Update existing store/shell tests                                 | Status in store, no regressions        |
| 5     | Manual + Opt. Integration | `scripts/smoke-test-llm.ts`, `tests/integration/llm-live.test.ts` | Real LLM endpoints                     |
| 6     | Integration               | `tests/integration/orchestrator-e2e.test.ts`                      | Full orchestrate loop with persistence |
| 7     | Manual E2E                | Documented test script                                            | Full user journey                      |
| 8     | All                       | `npm run test:run && npm run typecheck`                           | No regressions                         |

**Test count estimate:** 139 existing + ~20 new = ~159 tests

---

## Estimated Complexity

| Phase                    | Effort | Files Changed | New Files | Risk   |
| ------------------------ | ------ | ------------- | --------- | ------ |
| 1: DB Init + Session     | Small  | 2-3           | 1         | Low    |
| 2: Dimension Persistence | Small  | 1-2           | 0         | Low    |
| 3: Prompt Versions       | Medium | 2-3           | 1         | Low    |
| 4: Store Wiring          | Small  | 2             | 0         | Low    |
| 5: Real LLM Testing      | Medium | 0             | 2         | Medium |
| 6: Orchestrator E2E      | Medium | 2-3           | 1         | Medium |
| 7: Full System Flow      | Medium | 2-3           | 0         | Medium |
| 8: Cleanup               | Small  | 3-4           | 1         | Low    |

**Total estimated effort:** 3-4 focused integration sessions

**Recommended session breakdown:**

- Session 1: Phases 1-3 (persistence layer, ~2 hours)
- Session 2: Phases 4-5 (store + LLM testing, ~1.5 hours)
- Session 3: Phases 6-7 (orchestrator + full flow, ~2 hours)
- Session 4: Phase 8 (cleanup + hardening, ~1 hour)

---

## Definition of Done

The integration is complete when ALL of the following are true:

1. **Persistence:** Sessions, dimensions, and prompt versions are stored in PGlite with real UUIDs
2. **Data flow:** UI -> API -> LLM -> response -> chart update -> drag -> re-evaluate works end-to-end
3. **Orchestration:** The evaluate-then-rewrite loop runs through the server and returns converged results
4. **State management:** targetScores and lockedDimensions are in Zustand; primary data flows through PGlite
5. **Tests:** All existing 139 tests pass + new integration tests for persistence and E2E flow
6. **Type safety:** `npm run typecheck` passes with zero errors
7. **Lint:** `npm run lint` passes with zero errors
8. **Manual verification:** A human can enter an intent, generate dimensions, evaluate text, drag chart targets, refine text, and see updated scores -- all with real LLM calls
9. **Documentation:** CLAUDE.md updated, handoff note written, phase tracker reflects integration complete
