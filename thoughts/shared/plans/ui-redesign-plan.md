# UI Redesign Plan — textchisel MVP

**Date:** 2026-03-08
**Session type:** planning
**Inputs:** PRD §9.2, architecture.md, scout UI audit, oracle UX research, user requirements
**Reference:** `.devcontext/ref-uiux-best-practices.md` (597-line guidelines — follow for ALL UI work)

---

## Goal

Redesign the textchisel UI to be extremely user-friendly, fully reactive, and feature-complete for MVP. Switch to shadcn/ui. Fix all state management issues. Make the spider chart the hero. Add version history with diffs.

---

## Current State (from scout audit)

- Three-panel layout: sidebar | chart | text — **keep this**
- Pure Tailwind CSS v4, no component library
- Most state in `useState` in App.tsx — Zustand store fields orphaned
- DimensionList is read-only — no add/remove/edit
- Lock toggle is wired but broken (never fires)
- Streaming is wired but dead (UI calls non-streaming endpoint)
- `lockedDimensions` is a `Set` — not JSON-serializable, breaks on refresh
- No version timeline, no provider config, no export button
- 154 tests passing, typecheck clean

---

## Phases

### Phase 1: shadcn/ui Foundation

**Goal:** Replace raw Tailwind markup with shadcn/ui components. Establish the design system.

**Tasks:**

1. Install shadcn/ui + dependencies (Radix UI primitives, class-variance-authority, clsx, tailwind-merge)
2. Run `npx shadcn@latest init` — configure with existing Tailwind v4
3. Add core components: `Button`, `Input`, `Textarea`, `Card`, `Badge`, `Tooltip`, `Dialog`, `Separator`, `Tabs`, `ScrollArea`, `Skeleton`, `Progress`
4. Create `InlineEdit` component (click-to-edit pattern from ref-uiux §3.2):
   - Renders as `<span>` in read mode, `<Input>` in edit mode
   - Enter/blur = commit, Escape = revert
   - Subtle dotted underline on hover to signal editability
5. Replace all existing raw markup in shell components with shadcn/ui equivalents
6. Establish color tokens: blue=current, pink/red=target, green=success, amber=warning, grey=disabled

**Acceptance criteria:**

- All existing functionality preserved
- All 154 tests still pass
- Visual appearance is clean and consistent via shadcn/ui
- `InlineEdit` component works with keyboard (Enter, Escape, Tab)

**Files affected:** `src/shell/*.tsx`, `src/chart/SpiderChart.tsx`, new `src/components/ui/` directory

---

### Phase 2: State Architecture Refactor

**Goal:** Fix the dual-state problem. Single source of truth. Everything persists across refresh.

**Tasks:**

1. **Consolidate state into Zustand store:**
   - Move `intent`, `dimensions`, `currentText`, `currentScores`, `sessionId`, `error` from App.tsx `useState` to Zustand
   - Remove orphaned store fields (`systemPrompt`, `userTemplate` — or wire them properly)
   - App.tsx becomes a thin coordinator, not a state holder

2. **Fix `lockedDimensions` serialization:**
   - Change from `Set<string>` to `Record<string, boolean>` in Zustand
   - Or use custom serialize/deserialize in persist config
   - Test: lock a dimension → refresh → lock state preserved

3. **Wire PGlite as primary data store:**
   - Sessions, dimensions, prompt versions, eval cache → PGlite (already done in db module)
   - Zustand syncs from PGlite on load, writes to PGlite on meaningful actions
   - Consider `useLiveQuery` for reactive data (architecture doc specifies this) — evaluate if it's worth adding now vs. manual sync

4. **Debounced persistence for text fields:**
   - Intent: Zustand update immediate (0ms), PGlite write debounced (500ms)
   - Dimension edits: same pattern
   - Safety: flush on blur + `beforeunload`

5. **Reactive cascading updates:**
   - When spider chart target changes → dimension list score delta updates
   - When new scores arrive → chart polygon + score badges update
   - When version switches → chart + dimensions + text all update
   - Use Zustand selectors with `useShallow` to prevent over-rendering

**Acceptance criteria:**

- Zero `useState` in App.tsx for business state (only transient UI like dialog open/close)
- All user-set values survive browser refresh
- `lockedDimensions` survives refresh
- No orphaned Zustand fields

**Files affected:** `src/store/index.ts`, `src/store/slices/*`, `src/shell/App.tsx`

---

### Phase 3: Spider Chart Redesign

**Goal:** Make the chart the hero. Much bigger. Clear visual hierarchy. Fix overlapping points.

**Tasks:**

1. **Enlarge the chart:**
   - Chart panel takes at minimum 50% of the center area height
   - Dimension labels must be fully visible (13px+ bold font)
   - Level labels (1-5) visible on radial gridlines

2. **Dual-layer visual hierarchy (ref-uiux §5.1):**
   - **Current scores (background):** Solid blue border, blue fill at 10% opacity, circle markers (6px), NOT interactive — read-only evaluation output
   - **Target scores (foreground/hero):** Dashed pink/red border, pink fill at 8% opacity, triangle markers (4px), DRAGGABLE — user's intent
   - Draw order: target drawn first (behind), current drawn second (in front for visibility), but target has larger hit radius (25px) for comfortable dragging
   - **Key insight:** Current scores are informational backdrop. Target scores are the active UI element the user manipulates.

3. **Fix overlapping points (ref-uiux §5.2):**
   - Distinct point shapes (circle vs triangle)
   - Tooltip on hover near overlap: "Clarity — Current: 3, Target: 5"
   - `cursor: grab` on target points, `cursor: default` on current
   - `pointHitRadius: 25` on target dataset for easy targeting

4. **Drag interaction (ref-uiux §5.3):**
   - Zero-lag drag via direct Chart.js mutation (no React state during drag)
   - Snap to integers 1-5 (`magnet: { to: Math.round }`)
   - Real-time tooltip showing value during drag
   - On `dragEnd`: sync to Zustand, show delta in dimension list ("Clarity: 3 → 5")

5. **Lock visualization:**
   - Locked axes: lock icon on chart point, grey/reduced opacity
   - `onDragStart` returns `false` for locked axes
   - Lock toggle accessible from dimension list (not just chart)

6. **Accessibility:**
   - Table-based alternative view (toggle chart ↔ table)
   - `aria-label` on chart container
   - Axis labels readable at default zoom

**Acceptance criteria:**

- Chart fills available space, all labels readable
- Current scores clearly distinguished from target scores visually
- Dragging target points works with no lag, even when overlapping with current
- Locked dimensions prevent dragging and show lock icon
- Chart responds to store changes reactively

**Files affected:** `src/chart/SpiderChart.tsx`, `src/chart/types.ts`, new `src/chart/ChartTable.tsx`

---

### Phase 4: Dimension Management

**Goal:** Dimensions are fully editable, addable, removable. Changes propagate to LLM prompts.

**Tasks:**

1. **Inline-editable dimension names:**
   - Use `InlineEdit` component (Phase 1)
   - Click dimension name → inline input → Enter/blur saves → Escape cancels
   - Auto-save to PGlite (debounced 500ms)

2. **Inline-editable dimension descriptions:**
   - Multi-line `InlineEdit` variant
   - Shown below dimension name in the list

3. **Editable dimension level descriptions:**
   - Each dimension has rubric/level descriptions (what does 1 mean? what does 5 mean?)
   - Show as expandable section under each dimension
   - Editable inline
   - **Critical:** These level descriptions MUST propagate to the LLM evaluation prompt AND rewrite prompt
   - Wire: dimension rubric changes → evaluation `scoreText` prompt uses updated rubric → rewriter `buildMetaPrompt` uses updated rubric

4. **Add dimension:**
   - "Add dimension" button at bottom of dimension list
   - Creates a new dimension with placeholder name "New Dimension"
   - User edits name/description inline
   - Optional: "Generate more dimensions" button re-runs LLM generation

5. **Remove dimension:**
   - Delete icon (trash) on each dimension card (hover to reveal)
   - Confirmation dialog: "Remove dimension 'Clarity'? This will remove it from all future evaluations."
   - Removing a dimension updates the spider chart axes immediately

6. **Dimension reordering:**
   - Drag handle on each dimension card
   - Reorder updates `sortOrder` in PGlite
   - Chart axes update to match new order

7. **Prompt propagation verification:**
   - Write integration test: edit a dimension's rubric → trigger evaluation → verify the evaluation prompt contains the updated rubric text
   - Write integration test: edit dimension levels → trigger rewrite → verify the rewrite prompt contains updated level descriptions

**Acceptance criteria:**

- All dimension fields editable inline
- Add/remove dimensions works, chart updates reactively
- Changed dimension rubrics are used in LLM prompts (verified by test)
- Dimension edits persist across refresh

**Files affected:** `src/shell/DimensionList.tsx` (major rewrite), `src/dimensions/generate.ts`, `src/evaluation/score.ts`, `src/rewriter/prompt.ts`, `src/store/slices/`

---

### Phase 5: Auto-Evaluation + Process Indicators

**Goal:** Remove manual "Evaluate" button. Auto-evaluate after refinement. Show what's happening.

**Tasks:**

1. **Auto-evaluate after refinement:**
   - When rewrite completes (streaming finishes), automatically trigger evaluation
   - Remove the separate "Evaluate" button from ControlBar
   - Keep "Refine" button (manual trigger for rewrite)
   - Flow: User drags chart → clicks "Refine" → text rewrites (streamed) → auto-evaluate → scores update on chart

2. **Enable streaming display:**
   - Switch from `apiRewriteFull` (non-streaming) to `apiRewriteStream` (SSE)
   - Progressive text rendering with blinking cursor (ref-uiux §2.3)
   - Batch rendering every 30-60ms for performance
   - Auto-scroll container unless user has scrolled up

3. **Multi-step progress stepper (ref-uiux §2.5):**
   - Horizontal stepper above text panel: [Rewriting...] → [Evaluating...] → [Complete]
   - Active step: filled dot + bold + elapsed time
   - Completed: checkmark + muted
   - Show convergence badge after re-evaluate: "Converged" / "Improving" / "Diverging"

4. **Cancellation (ref-uiux §2.4):**
   - "Refine" button becomes "Stop" during LLM operation
   - `AbortController` on every LLM call
   - Partial results preserved on cancel
   - Button state machine: Idle → In Progress → Cancelling → Complete/Error

5. **Skeleton loading:**
   - Dimension list: shimmer bars while generating
   - Score values: animated placeholders while evaluating
   - Chart: faded outline while scores load
   - Never show skeleton for <300ms

6. **API status indicator:**
   - If provider unreachable, persistent banner: "Cannot reach OpenAI. Check API key."
   - Don't let user click Refine only to fail 5 seconds later
   - Rate limit: countdown timer + auto-retry

**Acceptance criteria:**

- Evaluation happens automatically after rewrite (no manual "Evaluate" click)
- Streaming text renders progressively with cursor
- Stepper shows current pipeline stage
- All LLM operations cancellable
- Skeleton loading for appropriate durations

**Files affected:** `src/shell/ControlBar.tsx`, `src/shell/App.tsx`, `src/shell/TextPanel.tsx`, new `src/shell/ProcessStepper.tsx`, `src/shell/api.ts`

---

### Phase 6: Version Timeline + Diffs

**Goal:** Display version history. Compare versions with word-level diffs. Reactive version switching.

**Tasks:**

1. **Horizontal version timeline (ref-uiux §4.1):**
   - Position: below the text panel or at the bottom of the right pane
   - Each node: version number, timestamp, brief change summary
   - Current version: highlighted/larger dot
   - Scrollable with fade edges when >8 versions
   - Click to preview, "Restore" button to fork from old version

2. **Word-level diff display (ref-uiux §4.2):**
   - Default: inline/unified diff
   - Deletions: light red background + strikethrough
   - Additions: light green background
   - Use `diff-match-patch` or similar library for word-level diffing
   - Toggle between "Current text" and "Diff vs previous" views

3. **Causal change links (ref-uiux §4.3):**
   - Each version stores which target adjustments triggered it
   - Version detail card shows: "Target: Clarity 3→5" + "Result: Clarity 3.2→4.1 (+0.9)"
   - Mini spider chart delta (optional, nice-to-have)

4. **Reactive version switching:**
   - Click a version → text panel shows that version's text
   - Spider chart updates to that version's scores AND targets
   - Dimension list updates score badges
   - **This is a preview, not destructive.** Current version stays intact.
   - "Restore" creates new version (immutable versions per invariant 9)

5. **Store integration:**
   - Add `selectedVersionId` to Zustand
   - Add `versions` list loaded from PGlite
   - Version selection drives all reactive updates
   - Creating a new version (rewrite) auto-selects it

**Acceptance criteria:**

- Version timeline renders all saved versions
- Clicking a version updates ALL UI elements (chart, scores, text)
- Diff view shows word-level changes between adjacent versions
- "Restore" creates a new version (never mutates old ones)
- Timeline scrolls for many versions

**Files affected:** New `src/shell/VersionTimeline.tsx`, new `src/shell/DiffView.tsx`, `src/shell/TextPanel.tsx`, `src/store/slices/`

---

### Phase 7: Provider Config + Export

**Goal:** Users can configure their API key and model. Export final prompt.

**Tasks:**

1. **Settings dialog:**
   - Gear icon in header → opens shadcn/ui Dialog
   - API key input (password field with show/hide toggle)
   - Provider selection: OpenAI / Anthropic
   - Model selection: dropdown with common models
   - Temperature slider (optional, progressive disclosure)
   - Persist to localStorage (NOT to PGlite — sensitive data)

2. **First-run experience:**
   - If no API key set, show a setup prompt before allowing Refine
   - "Enter your OpenAI API key to get started" with link to key creation page
   - Validate key with a lightweight API call on save

3. **Export button:**
   - "Copy" button in text panel header
   - Copies current text to clipboard
   - Brief "Copied!" feedback (toast or button label change for 2s)
   - Optional: "Export as..." dropdown with markdown/plain text options

**Acceptance criteria:**

- API key configurable from UI (no env vars required for end users)
- Model selectable
- Key persists across sessions (localStorage)
- Export copies current text to clipboard
- First-run guides user to enter API key

**Files affected:** New `src/shell/SettingsDialog.tsx`, `src/shell/App.tsx`, `src/shell/TextPanel.tsx`, `server/model.ts`

---

## Build Order & Dependencies

```
Phase 1 (shadcn/ui)          ← foundation, must be first
    ↓
Phase 2 (state refactor)     ← must fix state before building features on it
    ↓
Phase 3 (chart redesign)  ←─┐
Phase 4 (dimensions)      ←─┤  can be parallel after Phase 2
Phase 7 (config + export)  ←─┘
    ↓
Phase 5 (auto-eval + streaming)  ← needs chart + dimensions working
    ↓
Phase 6 (version timeline)       ← needs everything else stable
```

**Estimated sessions:** 7 sessions (one per phase), each focused on one concern.

---

## Invariants (additions to CLAUDE.md)

13. All user-typed text survives browser refresh (debounced PGlite + beforeunload fallback).
14. UI follows ref-uiux-best-practices.md for all component design.
15. Spider chart: current scores = read-only background, target scores = interactive foreground.
16. Every LLM operation is cancellable (AbortController).
17. Evaluation is automatic after rewrite — no manual "Evaluate" button.
18. Version switching updates ALL UI elements reactively (chart, scores, text, dimensions).
19. Dimension rubric/level edits propagate to LLM evaluation and rewrite prompts.

---

## Open Decisions (for user confirmation)

1. **useLiveQuery vs manual sync:** Architecture doc specifies `useLiveQuery` for reactive PGlite data. Adding it now means changing the data layer. Manual sync (load from PGlite on action, write on change) works but is less reactive. **Recommendation:** Defer useLiveQuery for now; use manual sync. Add later if reactivity gaps emerge.

2. **Dimension count limit:** PRD MVP says exactly 3 dimensions. User wants add/remove. **Recommendation:** Allow 2-7 dimensions (PRD Phase 2 plans up to 7). Warn if >5 ("More dimensions may reduce rewrite quality").

3. **Dark mode:** shadcn/ui supports it easily. **Recommendation:** Defer. Not MVP.

4. **Auto-refine on chart drag:** User drags target → should we auto-trigger rewrite? **Recommendation:** No — keep manual "Refine" button. Auto-refine on drag would be expensive (LLM call per drag) and would violate user control. The user said "keep manual refine button."
