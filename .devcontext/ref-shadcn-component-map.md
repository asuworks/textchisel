# shadcn/ui Component Map — textchisel

**Generated:** 2026-03-08
**Purpose:** Maps every UI zone to its shadcn/ui component. Follow this for all UI work.

---

## Installed Components (19)

`badge`, `button`, `card`, `input`, `scroll-area`, `separator`, `skeleton`, `textarea`, `tooltip`, `switch`, `collapsible`, `alert-dialog`, `sonner`, `dialog`, `select`, `tabs`, `popover`, `slider`, `inline-edit` (custom)

---

## Component-to-UI Map

### Left Sidebar

| UI Element            | Component                                       | Phase | Notes                                           |
| --------------------- | ----------------------------------------------- | ----- | ----------------------------------------------- |
| Intent textarea       | `Textarea`                                      | ✓ P1  | Always-editable, persistent border              |
| Generate button       | `Button`                                        | ✓ P1  | Primary style, full-width                       |
| Dimension name        | `InlineEdit` (custom)                           | P4    | Click-to-edit, dotted underline on hover        |
| Dimension description | `InlineEdit` multiline                          | P4    | Multi-line variant                              |
| Dimension score badge | `Badge` variant="secondary"                     | ✓ P1  | Shows current score (e.g., "3/5")               |
| Dimension lock toggle | `Switch`                                        | P4    | ON/OFF — universally understood binary state    |
| Dimension delete      | `Button` variant="ghost" size="icon" + `Trash2` | P4    | Hover-reveal only                               |
| Delete confirmation   | `AlertDialog`                                   | P4    | Cancel as default focus, destructive button red |
| Rubric/level details  | `Collapsible`                                   | P4    | Hidden by default, expand to see/edit levels    |
| Rubric level text     | `InlineEdit`                                    | P4    | Editable level descriptions inside Collapsible  |
| Add dimension         | `Button` variant="outline" + `Plus` icon        | P4    | At bottom of dimension list                     |
| Dimension list scroll | `ScrollArea`                                    | ✓ P1  | Vertical scroll for overflow                    |
| Section divider       | `Separator`                                     | ✓ P1  | Between intent and dimensions                   |

### Center Panel — Chart

| UI Element            | Component                          | Phase    | Notes                                  |
| --------------------- | ---------------------------------- | -------- | -------------------------------------- |
| Spider chart          | Chart.js `Radar` (react-chartjs-2) | Existing | Not a shadcn component                 |
| Chart/table toggle    | `Tabs`                             | P3       | Accessibility alternative (table view) |
| Empty state           | Plain text                         | Existing | "Generate dimensions to see the chart" |
| Locked axis indicator | Lucide `Lock` icon (custom render) | P3       | Overlaid on chart axis                 |

### Right Panel — Text

| UI Element           | Component                                     | Phase | Notes                                   |
| -------------------- | --------------------------------------------- | ----- | --------------------------------------- |
| Text area            | `Textarea`                                    | ✓ P1  | Flex-1 to fill height, resize-none      |
| Copy button          | `Button` size="icon" variant="ghost" + `Copy` | P7    | Label changes → "Copied!" for 2s        |
| Streaming cursor     | Custom CSS                                    | P5    | Blinking thin vertical bar              |
| Version timeline     | Custom + `ScrollArea` horizontal              | P6    | Scrollable, fade edges at overflow      |
| Version node tooltip | `Tooltip`                                     | P6    | Shows first 100 chars + scores on hover |
| Version detail popup | `Popover`                                     | P6    | Shows causal chart changes, diff link   |
| Restore confirmation | `AlertDialog`                                 | P6    | Warns about in-progress work            |
| Diff view            | Custom + `diff-match-patch` lib               | P6    | Word-level, inline or side-by-side      |

### Control Bar

| UI Element         | Component                           | Phase | Notes                                           |
| ------------------ | ----------------------------------- | ----- | ----------------------------------------------- |
| Evaluate button    | `Button` variant="secondary"        | ✓ P1  | Removed in P5 (auto-evaluate)                   |
| Refine button      | `Button` (default/primary)          | ✓ P1  | Becomes "Stop" during LLM op                    |
| Stop button        | `Button` variant="destructive"      | P5    | Same position, swapped during operation         |
| Auto-Refine button | `Button` variant="outline"          | ✓ P1  |                                                 |
| Process stepper    | Custom + `Separator` + lucide icons | P5    | No shadcn stepper exists                        |
| Convergence badge  | `Badge`                             | P5    | Green=converged, amber=improving, red=diverging |

### Header

| UI Element    | Component                                         | Phase | Notes                    |
| ------------- | ------------------------------------------------- | ----- | ------------------------ |
| App title     | Plain `h1`                                        | ✓ P1  | "textchisel"             |
| Settings gear | `Button` size="icon" variant="ghost" + `Settings` | P7    | Opens Dialog             |
| Error banner  | Custom div + `Button` variant="link"              | ✓ P1  | Destructive color scheme |

### Settings Dialog (Phase 7)

| UI Element        | Component                                                   | Notes                                   |
| ----------------- | ----------------------------------------------------------- | --------------------------------------- |
| Dialog container  | `Dialog` + `DialogContent` + `DialogHeader` + `DialogTitle` | Standard shadcn dialog                  |
| Provider selector | `Select`                                                    | OpenAI / Anthropic                      |
| Model selector    | `Select`                                                    | gpt-4o, claude-sonnet, etc.             |
| API key input     | `Input` type="password"                                     | With show/hide `Button` toggle          |
| Temperature       | `Slider`                                                    | Progressive disclosure (advanced panel) |
| Save button       | `Button`                                                    |                                         |

### Global Feedback

| UI Element         | Component         | Phase | Notes                                          |
| ------------------ | ----------------- | ----- | ---------------------------------------------- |
| Save confirmations | `Sonner` toast    | P4+   | "Saved ✓" — ephemeral, non-disruptive          |
| Clipboard copy     | Button label swap | P7    | "Copy" → "Copied!" for 2s (not toast)          |
| Error display      | Inline + banner   | ✓ P1  | Inline for field errors, banner for API errors |
| Loading skeletons  | `Skeleton`        | P5    | Dimension list, score values, chart outline    |

---

## Third-Party Libraries (Not shadcn)

| Library                        | Use Case                       | Phase                        |
| ------------------------------ | ------------------------------ | ---------------------------- |
| `@dnd-kit/core`                | Dimension reorder drag handles | P4                           |
| `diff-match-patch`             | Word-level text diffing        | P6                           |
| `chart.js` + `react-chartjs-2` | Spider chart                   | Existing                     |
| `chartjs-plugin-dragdata`      | Draggable chart points         | Existing                     |
| `lucide-react`                 | All icons                      | ✓ P1 (installed with shadcn) |

---

## Design Decisions

1. **`Switch` for locks, not toggle buttons.** Binary state is universally communicated without labels.

2. **`Collapsible` for rubrics.** Minimal by default (just name + score), rich on demand (expand to see/edit 5 level descriptions). Prevents sidebar clutter.

3. **`AlertDialog` for all destructive actions.** Cancel button gets default focus. Destructive button is red. Matches best practices §6.2 (error prevention).

4. **`Sonner` for ephemeral feedback.** Non-disruptive toasts. Does NOT interrupt layout. Used for saves, deletes, status changes.

5. **Custom `ProcessStepper`, not `Progress`.** LLM pipeline has discrete steps (Evaluating → Rewriting → Re-evaluating → Complete), not a continuous bar. Built from `Separator` + lucide step icons.

6. **`Tabs` for chart accessibility.** Some users can't interact with drag-based charts. Table view shows same data with direct numeric input.

7. **`InlineEdit` for all editable fields.** Never a modal for editing names/descriptions. Click-to-edit everywhere. Consistent interaction pattern per best practices §6.3.

8. **No dedicated stepper component needed.** Process visibility achieved through custom horizontal stepper with lucide icons (circle, check, loader, x) and step labels.

---

## Color Semantics (Consistent Everywhere)

| Color                 | Meaning             | Used In                                         |
| --------------------- | ------------------- | ----------------------------------------------- |
| Blue (`--chart-1`)    | Current state       | Chart current polygon, current score badges     |
| Pink/Red              | Target state        | Chart target polygon, target score indicators   |
| Green                 | Success/improvement | Convergence badge, score improvement delta      |
| Amber                 | Warning/pending     | "Changes pending" badge, score regression delta |
| Red (`--destructive`) | Error/destructive   | Error banner, delete buttons, stop button       |
| Grey (`--muted`)      | Disabled/locked     | Locked dimension points, disabled buttons       |

---

## Phase Installation Summary

All 19 components already installed. No additional `npx shadcn add` needed.

Third-party installs remaining:

```bash
# Phase 4
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Phase 6
npm install diff-match-patch
npm install -D @types/diff-match-patch
```
