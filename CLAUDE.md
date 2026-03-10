# textchisel

## What This Is

A prompt engineering workbench that helps users iteratively refine LLM prompts through visual feedback. Users describe their writing intent, the system generates evaluation dimensions, scores text against them on a spider chart, and uses a grammar layer to rewrite text toward target scores. Localhost-only, single-user.

## Tech Stack

- TypeScript monorepo (Vite + React 19 + Express)
- PGlite (embedded Postgres) + Drizzle ORM
- PGlite `useLiveQuery` for reactive data + Zustand (UI state + undo/redo via Zundo)
- Vercel AI SDK (`ai` + `@ai-sdk/openai` + `@ai-sdk/anthropic`)
- Chart.js + chartjs-plugin-dragdata (spider chart)
- qlty CLI (ESLint + Prettier + osv-scanner, pre-commit/pre-push hooks)

## Architecture Overview

Single-process Node.js app: Express serves UI + proxies LLM calls. Frontend is a React SPA with a spider chart as the central interaction. Users input intent → system generates evaluation dimensions → scores text → user drags chart points to set targets → system rewrites text to hit targets → loop until convergence. Data persists in PGlite (IndexedDB in browser, filesystem in Node).

## Module Map

| Module         | Responsibility                                                      | Status |
| -------------- | ------------------------------------------------------------------- | ------ |
| `shared`       | Contracts: Zod schemas, Drizzle table defs, TypeScript types        | done   |
| `db`           | PGlite lifecycle, Drizzle client, migrations, version snapshots     | done   |
| `store`        | Zustand slices (prompt, eval, ui), middleware composition           | done   |
| `dimensions`   | Generate dimensions from intent (generateObject), dimension CRUD    | done   |
| `evaluation`   | G-Eval scoring per dimension, score normalization, caching          | done   |
| `rewriter`     | Grammar layer meta-prompt, streaming text rewrite (streamText)      | done   |
| `orchestrator` | Regeneration loop, convergence detection, step coordination         | done   |
| `chart`        | SpiderChart component, drag/lock, target overlay                    | done   |
| `shell`        | App layout, panels, intent input, version timeline, provider config | done   |

## Current Phase

**Phase 6 (Prompt Enhancement)** — COMPLETE
Prompt quality improvements across all 5 LLM call sites. Few-shot examples per rubric level (auto-classified: only categorical/stylistic/qualitative rubrics get examples). Evidence-first evaluation. Target-prominent initial generation. User-specified dimensions via `#` lines in intent. Conflict resolution in rewrite planner. Remaining: manual LLM smoke test verification (requires API key).

See `.devcontext/phase.md` for detailed progress.

## Invariants (NEVER violate these)

1. Modules import shared types ONLY from `shared/`. Never define cross-module types locally.
2. Modules never import from each other. All cross-module communication goes through contracts in `shared/`.
3. One module per session. Never cross module boundaries in a single session.
4. Integration is a separate session. Never combine building a module with integrating it.
5. Contracts are frozen after Phase 2. Changing a contract requires a dedicated session and an ADR in `.devcontext/decisions/`.
6. PGlite runs in-process (no external database). Schema changes use raw SQL on startup (not drizzle-kit CLI in browser).
7. All LLM calls go through Vercel AI SDK. No direct HTTP to providers.
8. Spider chart values are integers 1-5. Scores are normalized to this range.
9. PromptVersions are immutable. Never mutate a snapshot — create a new version.
10. The orchestrator controls the evaluate→rewrite loop. No other module triggers LLM chains.
11. Zustand middleware order: devtools → persist → temporal → immer (outside to inside).
12. Server-side only: API keys, LLM calls. Client-side: UI, PGlite, chart interactions.

## Where To Find Context

- Architecture: `.devcontext/architecture.md`
- Reference docs: `.devcontext/ref-*.md`
- Phase progress: `.devcontext/phase.md`
- Module details: `.devcontext/modules.md`
- Methodology: `.devcontext/method.md`
- Decisions (ADRs): `.devcontext/decisions/`
- Contracts (Phase 2): `.devcontext/contracts/`
- Handoffs: `thoughts/shared/handoffs/`

## Session Rules

- You are working on ONE module at a time. Ask which if unclear.
- Declare your session type: test | build | integration | hardening | hotfix
- Import shared types ONLY from `shared/`. Never define cross-module types locally.
- If you need to change a contract, STOP and ask. Do not modify contracts unilaterally.
- After completing work, write a handoff note in `thoughts/shared/handoffs/`.
- Update the module status in this file when work is complete.
- Run all relevant tests before ending a session.

## Build Order

```
Phase 2+3 (Contracts + Foundation): shared → db → store (sequential)
Phase 4 (Construction):
  Wave 1: dimensions, evaluation, chart     (parallel, no deps on each other)
  Wave 2: rewriter                          (needs evaluation contract)
  Wave 3: orchestrator                      (needs evaluation + rewriter)
  Wave 4: shell                             (needs store + chart + orchestrator)
  Integration sessions after each wave.
```
