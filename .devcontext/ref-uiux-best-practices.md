# UI/UX Best Practices Reference — textchisel

Generated: 2026-03-08
Purpose: Actionable guidelines for all UI work on textchisel, a single-page React+TypeScript app for iterative LLM-powered text refinement with a spider chart as the central interaction.

---

## Table of Contents

1. [Reactivity & State Persistence](#1-reactivity--state-persistence)
2. [Background Process Communication](#2-background-process-communication)
3. [Inline Editing UX](#3-inline-editing-ux)
4. [Version/History UI](#4-versionhistory-ui)
5. [Chart Interaction UX](#5-chart-interaction-ux)
6. [General Usability Principles](#6-general-usability-principles)
7. [Sources](#7-sources)

---

## 1. Reactivity & State Persistence

### 1.1 Data Persistence Architecture

textchisel has a two-tier persistence model: PGlite (embedded Postgres via IndexedDB) for structured data, and Zustand persist middleware for UI state. Guidelines for each tier:

**PGlite (primary data store — sessions, prompt versions, dimensions, eval caches):**

| Guideline                                                                                         | Rationale                                                                                               |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Write to PGlite on every meaningful user action (intent submission, dimension edit, score change) | IndexedDB survives browser refresh, tab close, and crash recovery                                       |
| Use `useLiveQuery` for all data-bound components                                                  | Changes in PGlite automatically propagate to every subscribed component — no manual invalidation needed |
| Never cache PGlite data in React state as the source of truth                                     | Dual sources of truth cause drift; `useLiveQuery` already provides reactivity                           |
| Show a brief "Saving..." indicator after writes, transitioning to a checkmark                     | Confirms persistence happened; reduces anxiety about data loss                                          |

**Zustand persist (UI state — sidebar position, active panel, selected version):**

| Guideline                                                                            | Rationale                                                                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Persist to `localStorage` (not IndexedDB) for UI state                               | UI state is small (<10KB); localStorage is synchronous, avoiding hydration race conditions        |
| Use `partialize` to exclude transient state (hover, drag-in-progress, loading flags) | Prevents stale transient state from rehydrating on refresh                                        |
| Implement `onRehydrateStorage` to show a skeleton until hydration completes          | Prevents flash of default state on page load                                                      |
| Set `version` and `migrate` on the persist config from day one                       | Prevents broken state when schema changes; migration is trivial to add early, painful to retrofit |

### 1.2 Form Persistence — Never Lose User Input

**Rule: Any text the user has typed must survive a browser refresh.**

Implementation patterns:

1. **Debounced auto-persist for text fields.** On every keystroke, update Zustand (immediate, in-memory). Debounce the PGlite write by 500ms. This gives instant UI responsiveness while avoiding write thrashing.

```
User types → Zustand updates (0ms) → UI reflects change (0ms) → PGlite write (500ms debounce)
```

2. **Persist on blur as a safety net.** If the user clicks away from a text field, flush the debounce timer immediately and write to PGlite. This handles the case where the user types, then immediately closes the tab.

3. **Persist on `beforeunload`.** Register a `window.addEventListener('beforeunload', flush)` handler that synchronously writes critical state to localStorage as a last-resort backup. PGlite writes are async and may not complete during page unload.

4. **Draft recovery.** On app startup, check localStorage for a draft backup. If found and newer than PGlite data, prompt the user: "We recovered unsaved changes from your last session. Restore?" Never silently overwrite — let the user choose.

### 1.3 Optimistic Updates

Use React 19's `useOptimistic` for operations where the expected outcome is predictable:

| Operation                                  | Optimistic?        | Why                                                                      |
| ------------------------------------------ | ------------------ | ------------------------------------------------------------------------ |
| Editing dimension name                     | Yes                | User typed it; outcome is deterministic                                  |
| Locking/unlocking a chart axis             | Yes                | Toggle state; no server involved                                         |
| Reordering dimensions                      | Yes                | UI-only operation                                                        |
| Submitting intent for dimension generation | No                 | LLM response is unpredictable; show loading state instead                |
| Saving a prompt version                    | Yes, with rollback | Write to PGlite is expected to succeed, but show error toast if it fails |

**Rollback pattern:** Keep the previous state in a ref. If the write fails, restore from the ref and show an error toast. Never silently swallow persistence failures.

### 1.4 Reactive Cascading Updates

When one element changes, all dependent elements must update immediately:

| Trigger                      | What must update                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| User drags a chart point     | Score display next to dimension name, delta indicator ("+1" / "-2"), rewrite button enabled state    |
| New evaluation scores arrive | Spider chart polygon, score numbers, convergence indicator, version diff highlighting                |
| User edits intent text       | "Dimensions may be stale" warning badge on dimension list, "Re-generate dimensions" button highlight |
| New prompt version created   | Version timeline appends entry, "current" marker moves, diff view updates                            |

**Implementation:** Use Zustand selectors with `useShallow` for multi-value subscriptions. Components subscribe to exactly the fields they need — no over-rendering.

### 1.5 Debouncing vs. Immediate Updates

| Interaction type                     | Strategy                                      | Delay            | Rationale                                                                                     |
| ------------------------------------ | --------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| Text input (intent, dimension names) | Debounce PGlite write                         | 500ms            | Avoid write thrashing on every keystroke                                                      |
| Text input (intent, dimension names) | Immediate Zustand update                      | 0ms              | UI must feel instant                                                                          |
| Chart point drag                     | Immediate visual update via Chart.js mutation | 0ms              | Drag must track finger/cursor with zero lag                                                   |
| Chart point drag                     | Zustand sync only on `onDragEnd`              | 0ms (on release) | Updating state during drag causes re-render thrashing                                         |
| Toggle (lock/unlock axis)            | Immediate                                     | 0ms              | Binary state change; no reason to delay                                                       |
| Slider (if any, e.g., temperature)   | Throttle state update                         | 100ms            | Regular periodic updates during continuous input; safer than debounce for auto-save scenarios |
| Window resize                        | Throttle chart resize                         | 200ms            | Avoid layout thrashing                                                                        |

**Key distinction:** Use debounce when you want to wait for the user to stop (search, text input). Use throttle when you want regular updates during continuous interaction (scroll, slider, resize). For auto-save, prefer throttle — debounce can lose the last value if the page closes during the delay.

---

## 2. Background Process Communication

### 2.1 LLM Call Loading States

textchisel has four distinct LLM call types, each requiring different loading UX:

| LLM Call                                                  | Duration                           | Loading Pattern                                       |
| --------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `generateDimensions` (intent → dimensions)                | 2-5s                               | Skeleton shimmer in dimension list area               |
| `scorePrompt` (evaluate text on one dimension)            | 1-3s per call, up to 9 in parallel | Animated score placeholders on chart + dimension list |
| `modifyPrompt` (rewrite text)                             | 3-10s, streamed                    | Progressive text rendering with cursor                |
| Full orchestrator loop (evaluate → rewrite → re-evaluate) | 8-25s total                        | Multi-step progress stepper                           |

### 2.2 Skeleton Screens

Use skeletons instead of spinners for content that has a predictable shape:

**When to use skeletons:**

- Dimension list loading (3-6 rectangular bars mimicking dimension cards)
- Score values loading (small rectangular placeholders next to dimension names)
- Chart loading (a faded radar chart outline with no data points)

**When NOT to use skeletons:**

- Very short operations (<300ms) — show nothing, then reveal content; a skeleton that flashes for 200ms is worse than no indicator
- Operations with indeterminate length and no predictable shape — use a progress stepper instead

**Skeleton implementation rules:**

- Match the skeleton shape to the actual content layout (rectangle for text, circle for avatar, polygon for chart)
- Use a subtle shimmer animation (left-to-right gradient sweep, 1.5s cycle)
- Never show a skeleton for more than 10 seconds without additional feedback ("This is taking longer than usual...")
- Transition from skeleton to content with a brief fade-in (150ms opacity transition)

### 2.3 Streaming Text Display

For the rewriter's streamed output (`modifyPrompt`), follow these patterns:

**Progressive rendering:**

- Render text as it arrives, not character-by-character typewriter style. LLM tokens are multi-character; render each token chunk as it arrives.
- Batch rendering: accumulate tokens and render every 30-60ms or per ~20-60 characters to avoid reflow storms. Use `requestAnimationFrame` or a 33ms `setTimeout` for batching.
- Show a blinking cursor (thin vertical bar) at the end of streamed text to indicate "still generating."
- When streaming completes, remove the cursor with a brief fade-out (200ms).

**Container behavior during streaming:**

- The text container should auto-scroll to keep the latest text visible, but only if the user has not manually scrolled up. If they have scrolled up, show a "Jump to latest" pill button at the bottom.
- Pre-allocate a minimum height for the text container to prevent layout shift as content grows.
- Use `aria-live="polite"` on the container for screen reader accessibility, but batch updates to avoid spamming.

**Performance:**

- Use a single `<div>` with `textContent` or `innerHTML` updates, not individual `<span>` elements per token. DOM node count explosion kills performance.
- For markdown rendering during streaming, buffer until block boundaries (paragraph end, code fence close) to avoid partial rendering artifacts.

### 2.4 Interruption / Cancellation

**Every LLM operation must be cancellable.**

Implementation:

- Create an `AbortController` before each LLM call. Store it in a ref or Zustand state.
- Show a "Stop" button whenever an LLM operation is in progress. Place it where the "Generate" / "Rewrite" button normally lives (same position, different label + style).
- On click, call `controller.abort()`. Catch the `AbortError` in the fetch handler.
- After cancellation: keep whatever partial output has been generated (for streaming text). Show a subtle "Generation stopped" status message. Re-enable the "Rewrite" button.
- Never discard partial results on cancellation unless the user explicitly requests it.

**Button state machine:**

```
[Idle]          → "Rewrite"     (primary blue, enabled)
[In Progress]   → "Stop"        (red outline, enabled)
[Cancelling]    → "Stopping..." (red outline, disabled, brief)
[Cancelled]     → "Rewrite"     (primary blue, enabled) + "Stopped" status
[Complete]      → "Rewrite"     (primary blue, enabled) + results shown
[Error]         → "Retry"       (orange, enabled) + error message
```

### 2.5 Multi-Step Process Indicator

The orchestrator's evaluate-rewrite-re-evaluate loop is a multi-step pipeline. Display it as a horizontal stepper:

```
[1. Evaluating] ──── [2. Rewriting] ──── [3. Re-evaluating] ──── [4. Complete]
     ●━━━━━━━━━━━━━━━━○━━━━━━━━━━━━━━━━━○━━━━━━━━━━━━━━━━━━━━━○
   active           upcoming          upcoming              upcoming
```

**Design rules for the stepper:**

- Show step labels: "Evaluating", "Rewriting", "Re-evaluating", "Complete"
- Active step: filled circle + bold label + optional subtle pulse animation
- Completed step: checkmark icon + muted label
- Upcoming step: empty circle + muted label
- Failed step: X icon + red label + "Retry" link
- Show elapsed time on the active step ("Evaluating... 3s")
- Keep labels to 1-2 words. Use the step description area for details, not the label.
- Position the stepper above or below the text output area, never floating or in a modal.

**Convergence indicator:** After the re-evaluate step, show a convergence badge:

- "Converged" (green) — all scores within 1 point of targets
- "Improving" (amber) — some scores moved toward targets
- "Diverging" (red) — scores moved away from targets; suggest manual adjustment

---

## 3. Inline Editing UX

### 3.1 What Is Editable

| Element                           | Editable?             | Edit mode                             |
| --------------------------------- | --------------------- | ------------------------------------- |
| Intent text (main textarea)       | Always editable       | Standard textarea, always visible     |
| Dimension name                    | Click to edit         | Inline text field replacing the label |
| Dimension description             | Click to edit         | Inline text field, multi-line         |
| Dimension weight                  | Click to edit or drag | Inline number input or slider         |
| Score values (current evaluation) | NOT editable          | Read-only; output of LLM evaluation   |
| Target values (on chart)          | Drag to edit          | Chart point dragging                  |
| Rewritten text                    | NOT editable          | Read-only; output of LLM rewriter     |
| Session name                      | Click to edit         | Inline text field in header/sidebar   |

### 3.2 Visual Affordances for Editable Fields

The user must be able to distinguish editable from read-only elements at a glance.

**For click-to-edit fields (dimension name, description, session name):**

| State                          | Visual treatment                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| Default (read-only appearance) | Text with a subtle dotted bottom border or a faint pencil icon on hover. No visible input border.   |
| Hover                          | Bottom border becomes solid; pencil icon appears (if not already visible); cursor changes to `text` |
| Focus (editing)                | Full input border appears (2px solid accent color); background lightens slightly; pencil icon hides |
| Saving                         | Border briefly pulses or shows a micro-spinner; then returns to default state                       |

**Implementation details:**

- Use a single component (e.g., `<InlineEdit>`) that renders as a `<span>` in read mode and an `<input>` in edit mode.
- Enter edit mode on click or Enter key.
- Exit edit mode on blur, Enter (for single-line), or Escape.
- Escape reverts to the previous value. Enter/blur commits.
- Tab should advance to the next editable field (standard form behavior).

**For always-editable fields (intent textarea):**

- Show a persistent border. This is a primary input; it should look like an input at all times.
- Use placeholder text: "Describe what you want this text to achieve..."
- Show a character count if there is a limit.

### 3.3 Auto-Save vs. Explicit Save

**Use auto-save for all inline edits.** textchisel is a creative tool, not a form submission workflow. Requiring explicit save buttons adds friction without value.

**Auto-save rules:**

- Commit on blur (user clicks/tabs away from the field).
- Commit on Enter for single-line fields.
- Debounce-commit while typing (500ms) so the value is never more than 500ms stale.
- Show a brief, subtle "Saved" indicator (small checkmark that fades after 1.5s) near the field, not as a global toast.
- If the save fails, show an inline error below the field: "Could not save. [Retry]"

**Never use modals for confirming inline edits.** A modal interrupt for renaming a dimension would be a severe flow disruption.

### 3.4 Undo/Redo for Inline Edits

textchisel uses Zundo (Zustand temporal middleware) for undo/redo.

**What to include in undo history:**

- Dimension name changes
- Dimension description changes
- Target score changes (chart drag)
- Lock/unlock axis actions
- Intent text changes (debounced — one undo step per pause, not per keystroke)

**What to exclude from undo history:**

- UI state (sidebar toggle, panel resize, scroll position)
- Transient state (hover, drag-in-progress)
- LLM-generated content (scores, rewritten text) — these are derived, not user-authored

**Keyboard shortcuts:**

- `Cmd+Z` / `Ctrl+Z` — undo
- `Cmd+Shift+Z` / `Ctrl+Shift+Z` — redo (not `Ctrl+Y`, for cross-platform consistency)

**Visual feedback:**

- Show undo/redo buttons in the toolbar with disabled state when history is empty.
- After an undo, show a brief toast: "Undone: renamed dimension 'Clarity' → 'Clear Communication'" — describe WHAT was undone.
- The redo stack clears when the user makes a new edit after undoing. This is standard behavior; do not try to preserve the redo stack.

**Zundo configuration for textchisel:**

- `limit: 50` — sufficient history depth without memory bloat
- `handleSet` with 500ms debounce — groups rapid keystrokes into one undo step
- `partialize` — only track data fields, not UI state (see existing ref-zustand-zundo.md)

---

## 4. Version/History UI

### 4.1 Version Timeline

Display prompt versions as a horizontal or vertical timeline. Each node represents an immutable `PromptVersion` snapshot.

**Horizontal timeline (preferred for textchisel):**

```
v1          v2          v3 (current)
●───────────●───────────●
Baseline    +Clarity    +Structure
13:04       13:07       13:12
```

**Each timeline node shows:**

- Version number or label (auto-generated: v1, v2, v3...)
- Timestamp (relative: "3 min ago", or absolute: "13:07")
- Brief change summary (what triggered this version — e.g., "Rewrite: Clarity 3→5")
- Visual indicator for current version (larger dot, different color, or "current" badge)

**Interactions:**

- Click a version node to preview that version's text (in a read-only view)
- Double-click or "Restore" button to make that version current
- Hover shows a tooltip with the full text preview (first 100 chars) and all dimension scores

**Timeline overflow:**

- If more than ~8 versions, the timeline should be horizontally scrollable with fade-out edges indicating more content
- Show a "jump to current" button if the user has scrolled away from the latest version
- Consider collapsing middle versions when count exceeds 15: `v1 ● ... ● v12 ● v13 ● v14 (current)`

### 4.2 Diff Display

When comparing two versions, show differences at the word level, not the line level (prompts are prose, not code).

**Diff modes (offer both, default to inline):**

| Mode                 | When to use                         | Implementation                                                               |
| -------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| Inline (unified)     | Default. Best for short prompts.    | Single column. Deletions in red strikethrough, additions in green highlight. |
| Side-by-side (split) | User preference for longer prompts. | Two columns: "Before" and "After" with aligned change regions.               |

**Word-level diff rules:**

- Highlight changed words, not entire lines. Prompts are long sentences; line-level diff is too coarse.
- Use background color, not just text color, for accessibility: deletions = light red background + strikethrough; additions = light green background.
- Unchanged text appears in normal style with no highlighting.
- For large additions (new paragraphs), show them as a full green-highlighted block rather than word-by-word.

### 4.3 Linking Changes to Chart Adjustments

This is a unique opportunity in textchisel: every version change was motivated by specific spider chart adjustments. Surface this causality.

**For each version transition, show:**

- Which dimension(s) the user adjusted targets for (e.g., "Clarity: 3 → 5")
- The mini spider chart delta (a small inline chart showing the before/after polygon overlay, or just arrows)
- Which dimensions actually changed in the evaluation scores after rewriting

**Example version detail card:**

```
v2 → v3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Target adjustments:
  Clarity:    3 → 5  ↑
  Structure:  4 → 4  (unchanged)

Result:
  Clarity:    3.2 → 4.1  (+0.9) ✓ improved
  Structure:  4.0 → 3.8  (-0.2) ⚠ slight regression

[View diff] [Restore this version]
```

### 4.4 Version Switching UX

**Rules for version navigation:**

- Switching to a previous version is a preview, not a destructive action. The current version remains intact.
- To actually use a previous version, the user must explicitly click "Restore" or "Fork from here."
- "Restore" creates a new version (v_n+1) that is a copy of the selected old version. It does NOT delete any versions. Versions are immutable.
- Warn the user if restoring an old version will discard in-progress work: "You have unsaved changes. Restore v3 anyway? [Cancel] [Restore]"

---

## 5. Chart Interaction UX

### 5.1 Dual-Layer Visualization (Current vs. Target)

textchisel's spider chart overlays two polygons: current evaluation scores and target scores. These must be visually distinct but not cluttered.

**Visual hierarchy:**

| Layer          | Visual treatment                                                                                 | Interactive?                     | Draw order              |
| -------------- | ------------------------------------------------------------------------------------------------ | -------------------------------- | ----------------------- |
| Target scores  | Dashed border, light red/pink fill (8-10% opacity), triangle point markers, smaller points (4px) | Draggable (primary interaction)  | Behind (drawn first)    |
| Current scores | Solid border, blue fill (15% opacity), circle point markers, larger points (6px)                 | NOT draggable (read-only output) | In front (drawn second) |

**Key design decisions:**

- The **target** polygon is draggable because that is the user's input — "where I want to go."
- The **current** polygon is read-only because it represents LLM evaluation output — "where I am."
- This is counterintuitive (the foreground layer is read-only, the background layer is interactive). Mitigate with clear labeling in the legend and distinct point styles.
- Use `pointHitRadius: 25` on the target dataset for comfortable touch/click targeting even though the points are visually small.

**Alternative considered:** Making the current scores the draggable layer (user adjusts scores and system rewrites to match). Rejected because the mental model is "I set my goals, the system tries to reach them" — targets are the user's intent.

### 5.2 Handling Overlapping Points

When current and target scores are equal or close on a dimension, their points overlap and become hard to distinguish or click.

**Solutions (implement all):**

1. **Distinct point shapes:** Current = circle, Target = triangle. Even when overlapping, the shapes are distinguishable.
2. **Point offset:** When two points are within 0.3 units on the same axis, offset the target point slightly outward along the axis. This is a visual-only adjustment; the data value remains accurate.
3. **Tooltip disambiguation:** On hover near an overlapping region, show both values: "Clarity — Current: 3, Target: 5"
4. **Cursor change:** When hovering over a draggable target point, show `cursor: grab`. When over a non-draggable current point, show `cursor: default`. This provides immediate feedback about which point responds to drag.

### 5.3 Drag Interaction Details

**During drag:**

- The dragged point must track the cursor with zero perceptible lag. Do NOT update React state during drag — let Chart.js mutate its internal data directly.
- Show a tooltip with the current value updating in real-time: "Clarity: 4"
- Snap to integer values (`round: 0` + `magnet: { to: Math.round }`). Spider chart values are 1-5 integers.
- Clamp to valid range (1-5) in the `onDrag` callback. Return the clamped value.
- Show a subtle radial guide line along the axis being dragged (the angle line can brighten/thicken).

**On drag end:**

- Sync the final value to Zustand state in `onDragEnd`.
- If the new target differs from the current score on that dimension, highlight the dimension in the list with a delta indicator: "Clarity: 3 → 5 (+2)".
- The "Rewrite" button should become enabled/highlighted if any target differs from the current score.

**Locked axes:**

- A locked axis prevents dragging. The `onDragStart` callback returns `false` for locked axes.
- Locked points should have a distinct visual: a small lock icon, grey fill, or reduced opacity.
- User can lock/unlock by clicking a lock toggle next to the dimension name in the list, or by right-clicking/long-pressing a chart point.

### 5.4 Chart Accessibility

- All axis labels (`pointLabels`) must be readable at the default zoom level. Use 13px+ bold font.
- Provide a text-based alternative view: a table of dimension names, current scores, and target scores. Toggle between chart and table view.
- Chart should not be the only way to set targets. Allow direct numeric input in the dimension list as well.
- Use `aria-label` on the chart container: "Spider chart showing evaluation scores across [N] dimensions. Current and target scores are displayed."

---

## 6. General Usability Principles

Applied specifically to textchisel:

### 6.1 Visibility of System Status

| Principle                            | textchisel application                                                                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Always show what the system is doing | During LLM calls, show the stepper (which step), elapsed time, and a cancel button                                                                                                      |
| Show data freshness                  | After evaluation, show "Scores from 2 min ago" or "Scores current" near the chart                                                                                                       |
| Indicate unsaved state               | If the user has changed targets but not yet clicked Rewrite, show a "Changes pending" badge                                                                                             |
| Show connection/API status           | If the LLM provider is unreachable, show a persistent banner: "Cannot reach OpenAI. Check API key and network." Do not let the user click Rewrite only to get an error 5 seconds later. |

### 6.2 User Control and Freedom

| Principle                                   | textchisel application                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Every action is undoable                    | Undo/redo for all user-authored changes (Zundo). For LLM-generated content, version history serves as undo.            |
| Cancel long operations                      | Stop button for all LLM calls, with partial result preservation.                                                       |
| No destructive actions without confirmation | Deleting a session or dimension requires confirmation. Restoring a version warns about in-progress work.               |
| Emergency exit                              | Escape key closes modals, cancels inline edits (reverting to previous value), and deselects chart elements.            |
| Never auto-navigate                         | After a long operation completes, show results in place. Never redirect the user to another view without their action. |

### 6.3 Consistency and Standards

| Principle                       | textchisel application                                                                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consistent color semantics      | Blue = current state, Red/Pink = target state, Green = improvement/success, Amber = warning, Grey = disabled/locked. Use these EVERYWHERE — chart, dimension list, version timeline, status badges. |
| Consistent interaction patterns | Click-to-edit works the same way for all inline-editable fields: click → edit → blur to save → Escape to cancel. No field should behave differently.                                                |
| Standard keyboard shortcuts     | Cmd+Z undo, Cmd+Shift+Z redo, Escape cancel, Enter confirm (single-line), Tab advance. No custom shortcuts that conflict with browser defaults.                                                     |
| Consistent loading patterns     | Skeleton for content loading, stepper for multi-step processes, inline spinner for save operations. Never mix these for the same type of operation.                                                 |
| Platform conventions            | Use system font stack. Respect `prefers-color-scheme` (if implementing dark mode). Scrollbars should match OS style.                                                                                |

### 6.4 Error Prevention

| Principle                            | textchisel application                                                                                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validate before expensive operations | Before triggering LLM rewrite, verify: intent is non-empty, at least one dimension exists, at least one target differs from current. Show a disabled button with tooltip explaining what is missing. |
| Prevent double-submission            | Disable the Rewrite/Evaluate button immediately on click. Re-enable only when the operation completes, fails, or is cancelled.                                                                       |
| Graceful degradation for API errors  | Rate limit → show "API rate limited. Retrying in 8s..." with countdown. Invalid key → show setup instructions. Network error → show "Network error. Your work is saved locally."                     |
| Confirm destructive actions          | "Delete this session and all its versions? This cannot be undone. [Cancel] [Delete]" — destructive button in red, cancel button as the default/prominent option.                                     |
| Prevent data loss on navigation      | If the user tries to close the tab during an active LLM operation, show the browser's `beforeunload` confirmation.                                                                                   |

### 6.5 Recognition Over Recall

| Principle                       | textchisel application                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Show, don't require remembering | Display dimension names on the chart axes, not just numbers. Show the actual score values next to dimension names in the list, not just on the chart.                                                              |
| Contextual help                 | First-time user: show a brief callout on the chart: "Drag the triangle points to set your quality targets." Dismiss on first successful drag. Store dismissal in localStorage.                                     |
| Visual state encoding           | Locked dimensions: lock icon + grey text. Stale dimensions (intent changed): warning badge. Converged dimensions: checkmark. The user should never have to wonder "is this locked?" or "are these scores current?" |
| Descriptive labels, not jargon  | "Rewrite to match targets" not "Execute regeneration loop." "Quality dimensions" not "Evaluation rubric." "Score" not "G-Eval output."                                                                             |

### 6.6 Flexibility and Efficiency of Use

| Principle                      | textchisel application                                                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multiple interaction paths     | Set targets via chart drag OR numeric input in dimension list. Both must stay in sync.                                                                                                    |
| Keyboard-first for power users | Tab through dimensions, arrow keys to adjust targets (up/down = +1/-1), Enter to trigger rewrite.                                                                                         |
| Batch operations               | "Set all targets to 5" button. "Lock all dimensions" toggle. "Reset targets to current scores" quick action.                                                                              |
| Remember user preferences      | Last-used LLM provider, temperature, chart view vs. table view — persist across sessions.                                                                                                 |
| Progressive disclosure         | Show basic controls (intent, chart, rewrite button) by default. Advanced controls (temperature, model selection, evaluation method, dimension weights) in a collapsible "Advanced" panel. |

### 6.7 Aesthetic and Minimalist Design

| Principle                                         | textchisel application                                                                                                                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Information density without clutter               | The spider chart is the visual center. Dimension list and text panels flank it. No unnecessary chrome.                                                                                                                              |
| Visual hierarchy through contrast, not decoration | Use whitespace, font weight, and subtle background differences to separate sections. No borders between adjacent panels; use 8px+ gaps.                                                                                             |
| One primary action per view                       | The "Rewrite" button is the primary action. It should be the most visually prominent element (large, solid color, in a consistent position). All other buttons are secondary (outline style or text-only).                          |
| Reduce visual noise                               | Hide zero-state elements. If no dimensions exist yet, don't show an empty dimension list — show a single call-to-action: "Enter your intent above to generate quality dimensions."                                                  |
| Color restraint                                   | Use the accent color (blue) sparingly — primary actions and the current-score polygon. Everything else in neutral greys. The target polygon in red/pink is the second color. Two accent colors maximum.                             |
| Animation restraint                               | Use animation for state transitions (skeleton → content, button state changes) and for user feedback (chart drag), NOT for decoration. No entrance animations, no parallax, no gratuitous motion. Respect `prefers-reduced-motion`. |

### 6.8 Help Users Recognize, Diagnose, and Recover from Errors

| Error type                             | Display pattern                                                                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inline field validation                | Red border + message below the field: "Dimension name cannot be empty"                                                                                                                         |
| API / network error                    | Banner at the top of the app (not a modal) with the error, a human-readable explanation, and a retry action. "Could not connect to OpenAI. Check your API key in Settings. [Retry] [Settings]" |
| LLM returned unexpected output         | Show the raw response in a collapsed "Details" section below the error message. "The AI returned an unexpected response. [Show details] [Retry]"                                               |
| Rate limiting                          | Countdown timer: "Rate limited. Retrying in 8s..." Auto-retry when timer expires.                                                                                                              |
| Partial failure in parallel evaluation | Show successful scores; mark failed dimensions with an error icon and "Retry" link. Do not fail the entire evaluation because one dimension errored.                                           |

---

## 7. Sources

### Reactivity & State Persistence

- [React useOptimistic Hook](https://react.dev/reference/react/useOptimistic)
- [How to Use the Optimistic UI Pattern with useOptimistic](https://www.freecodecamp.org/news/how-to-use-the-optimistic-ui-pattern-with-the-useoptimistic-hook-in-react/)
- [Optimistic Updates — TanStack Query](https://tanstack.com/query/v4/docs/framework/react/guides/optimistic-updates)
- [React State Management in 2025](https://www.developerway.com/posts/react-state-management-2025)
- [Concurrent Optimistic Updates in React Query — TkDodo](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
- [Persist your React State in the Browser](https://dev.to/ajejey/persist-your-react-state-in-the-browser-2bgm)
- [localStorage vs IndexedDB: JavaScript Guide](https://dev.to/tene/localstorage-vs-indexeddb-javascript-guide-storage-limits-best-practices-fl5)
- [Zustand persist with IndexedDB — GitHub Discussion #1721](https://github.com/pmndrs/zustand/discussions/1721)
- [zustand-indexeddb — Official Zustand IndexedDB Storage](https://github.com/zustandjs/zustand-indexeddb)
- [Making Zustand Persist Play Nice with Async Storage](https://dev.to/finalgirl321/making-zustand-persist-play-nice-with-async-storage-react-suspense-part-12-58l1)

### Debouncing & Throttling

- [How and when to debounce or throttle in React — LogRocket](https://blog.logrocket.com/how-and-when-to-debounce-or-throttle-in-react/)
- [How to debounce and throttle in React without losing your mind](https://www.developerway.com/posts/debouncing-in-react)
- [Debouncing and Throttling in React](https://medium.com/@ignatovich.dm/debouncing-and-throttling-in-react-whats-the-difference-and-how-to-implement-them-0a500b649235)

### Background Process Communication

- [Streaming LLM Responses: Building Snappy Real-Time UX](https://medium.com/@sonitanishk2003/streaming-responses-how-to-build-snappy-real-time-llm-ux-00a92dbb7b3e)
- [Consuming Streamed LLM Responses on the Frontend — Deep Dive into SSE](https://tpiros.dev/blog/streaming-llm-responses-a-deep-dive/)
- [Complete Guide to Streaming LLM Responses in Web Applications](https://dev.to/pockit_tools/the-complete-guide-to-streaming-llm-responses-in-web-applications-from-sse-to-real-time-ui-3534)
- [Build interactive React UIs for LLM outputs using llm-ui](https://blog.logrocket.com/react-llm-ui/)
- [FlowToken — Animate and style streaming LLM output](https://github.com/Ephibbs/flowtoken)
- [AbortController: abort() method — MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort)
- [Don't Sleep on AbortController](https://kettanaito.com/blog/dont-sleep-on-abort-controller)

### Skeleton Screens & Loading States

- [Implementing Skeleton Screens In React — Smashing Magazine](https://www.smashingmagazine.com/2020/04/skeleton-screens-react/)
- [Handling React loading states with React Loading Skeleton — LogRocket](https://blog.logrocket.com/handling-react-loading-states-react-loading-skeleton/)
- [Improve React UX with skeleton UI — LogRocket](https://blog.logrocket.com/improve-react-ux-skeleton-ui/)
- [react-loading-skeleton — GitHub](https://github.com/dvtng/react-loading-skeleton)

### Multi-Step Progress Indicators

- [PatternFly Progress Stepper — Design Guidelines](https://www.patternfly.org/components/progress-stepper/design-guidelines/)
- [U.S. Web Design System — Step Indicator](https://designsystem.digital.gov/components/step-indicator/)
- [Carbon Design System — Progress Indicator](https://carbondesignsystem.com/components/progress-indicator/usage/)
- [Beyond the Progress Bar: The Art of Stepper UI Design — Lollypop](https://lollypop.design/blog/2026/february/beyond-the-progress-bar-the-art-of-stepper-ui-design/)
- [32 Stepper UI Examples and What Makes Them Work — Eleken](https://www.eleken.co/blog-posts/stepper-ui-examples)

### Inline Editing

- [Inline Edit — Atlassian Design System](https://atlassian.design/components/inline-edit/)
- [Inline Edit — Cloudscape Design System](https://cloudscape.design/patterns/resource-management/edit/inline-edit/)
- [Inline Edit — PatternFly](https://www.patternfly.org/components/inline-edit/design-guidelines/)
- [The Inline Edit Design Pattern — Andrew Coyle](https://coyleandrew.medium.com/the-inline-edit-design-pattern-e6d46c933804)
- [Best Practices for Inline Editing in Table Design](https://uxdworld.com/inline-editing-in-tables-design/)
- [Giving Your Users Freedom with Editable Input Fields — IxDF](https://www.interaction-design.org/literature/article/giving-your-users-freedom-with-editable-input-fields)

### Visual Affordances

- [Text fields & Forms design — UI components series](https://uxdesign.cc/text-fields-forms-design-ui-components-series-2b32b2beebd0)
- [Stronger Visual Cues for Text Fields — UXMovement](https://uxmovement.com/forms/stronger-visual-cues-for-text-fields/)
- [Carbon Design System — Read-Only States Pattern](https://carbondesignsystem.com/patterns/read-only-states-pattern/)
- [54 Input Field Design Examples with Expert Tips — Eleken](https://www.eleken.co/blog-posts/input-field-design)

### Version History & Diff

- [Understanding Diff Formats: A Developer's Guide](https://dev.to/shrsv/understanding-diff-formats-a-developers-guide-to-making-sense-of-changes-414o)
- [react-diff-view — npm](https://www.npmjs.com/package/react-diff-view)
- [diff2html — Pretty diff to HTML](https://github.com/rtfpessoa/diff2html)
- [SaaS Timeline & History Design Inspiration — NicelyDone](https://nicelydone.club/components/timeline-history)
- [Timeline: What is Timeline in UI Design — UIKits](https://www.uinkits.com/blog-post/timeline-what-is-timeline-in-ui-design-and-how-to-use-it)

### Chart Interaction

- [How To Draw Radar Charts In Web — Smashing Magazine](https://www.smashingmagazine.com/2024/02/draw-radar-charts-web/)
- [Chart.js Radar Chart Documentation](https://www.chartjs.org/docs/latest/charts/radar.html)
- [chartjs-plugin-dragdata — GitHub](https://github.com/artus9033/chartjs-plugin-dragdata)
- [Chart.js Draggable Radar Points — CodePen](https://codepen.io/ianhulme/pen/roOOPR)
- [A different look for the D3.js radar chart — Visual Cinnamon](https://www.visualcinnamon.com/2015/10/different-look-d3-radar-chart/)

### Undo/Redo

- [Zundo — Undo/Redo middleware for Zustand](https://github.com/charkour/zundo)
- [You Don't Know Undo/Redo](https://dev.to/isaachagoel/you-dont-know-undoredo-4hol)
- [Native Undo & Redo for the Web](https://dev.to/chromiumdev/-native-undo--redo-for-the-web-3fl3)
- [Undo Design Pattern — UI-Patterns.com](https://ui-patterns.com/patterns/undo)

### Nielsen's Heuristics & Usability

- [10 Usability Heuristics for User Interface Design — Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Nielsen's 10 Usability Heuristics — Heurio](https://www.heurio.co/nielsens-10-usability-heuristics)
- [Heuristic Evaluation Guide: Master UX Design Assessment 2025 — OwleStudio](https://www.owlestudio.com/business-resilience-tips-2-2/12087/)
- [Applying Jakob Nielsen's 10 Usability Heuristics — Shift Asia](https://shiftasia.com/community/applying-jakob-nielsens-10-usability-heuristics-for-better-ux-design/)
