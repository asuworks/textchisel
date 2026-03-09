# Phase Tracker

## Current Phase: 4 (Construction) — IN PROGRESS

Next action: Wave 3 — orchestrator module (evaluate→rewrite loop, convergence detection)

---

## Phase History

### Phase 0: Discovery — COMPLETE

- [x] Stakeholder interview (tech stack decisions locked)
- [x] System description (architecture.md — 8 sections)
- [x] Module map (8 modules identified + shared contracts)
- [x] Risk list (4 tigers from pre-mortem, 3 mitigated)
- [x] Technology choices locked
- [x] Data flow documented
- [x] Reference docs gathered (5 ref-\*.md files)

### Phase 1: Exploration — SKIPPED

Rationale: Key risks were mitigated during Discovery via targeted oracle research:

- PGlite + Drizzle: validated, TanStack DB eliminated
- Chart.js dragdata: confirmed radial-only drag, lock = return false
- Zustand middleware order: confirmed devtools→persist→temporal→immer
- Vercel AI SDK: generateObject + streamText patterns documented

Remaining risks (provider-aware parallelism, lock fidelity retry) are implementation concerns that can be addressed during construction without throwaway spikes.

### Phase 2+3: Contracts + Foundation — COMPLETE

Combined because textchisel is a small single-user app. Contracts defined inline with scaffold.

TODO:

- [x] Define shared Zod schemas for all cross-module types (shared/types.ts)
- [x] Define Drizzle table schemas (shared/schema.ts — sessions, dimensions, prompt_versions, eval_step_cache)
- [x] Scaffold Vite + React 19 + Express + TS monorepo
- [x] Set up module directory structure (8 modules with barrel exports)
- [x] Set up test framework (Vitest + jsdom + @testing-library/react)
- [x] Set up Tailwind CSS v4
- [x] Create CLAUDE.md
- [x] Verify: compiles, tests pass with zero functionality
- [x] Set up PGlite + Drizzle client (src/db/ — initDatabase, migration SQL, getDb/getPglite)
- [x] Set up Zustand + middleware skeleton (src/store/ — devtools→persist→temporal→immer, 3 slices)
- [x] Set up linting + formatting (qlty CLI: ESLint + Prettier + pre-commit/pre-push hooks)
- [x] Tag golden commit (v0.0.0-skeleton — cd57523)

### Phase 4: Construction — IN PROGRESS

- [x] Wave 1: dimensions, evaluation, chart (parallel)
- [x] Wave 1 integration: dimensions → evaluation pipeline
- [x] Wave 2: rewriter
- [x] Contract reconciliation: ADR-001 (TargetScores Map→Record), ADR-002 (RewriteContext to shared)
- [x] Wave 3: orchestrator
- [ ] Wave 4: shell

See `.devcontext/modules.md` for per-module build plan and status.

### Phase 5-8: Future

Not planned yet. Will be scoped after construction is underway.

---

## Open Questions

| Question                   | Recommendation                       | Status              |
| -------------------------- | ------------------------------------ | ------------------- |
| Styling approach           | Tailwind CSS v4                      | decided — installed |
| Testing framework          | Vitest + jsdom                       | decided — installed |
| Browser migration strategy | Raw SQL on startup via PGlite exec() | decided             |

## Decisions Log

| Date       | Decision                    | Rationale                                                              |
| ---------- | --------------------------- | ---------------------------------------------------------------------- |
| 2026-03-08 | PGlite over SQLite          | Full Postgres, pgvector path for Phase 2                               |
| 2026-03-08 | No TanStack DB              | Maintainers confirmed PGlite overlap                                   |
| 2026-03-08 | No agentic framework        | Pipeline is deterministic, not agent loop                              |
| 2026-03-08 | Zustand for UI state        | + Zundo for undo/redo, PGlite for persistent data                      |
| 2026-03-08 | 8-module split              | Capability-aligned for testability + extensibility                     |
| 2026-03-08 | Skip Phase 1                | Risks mitigated via oracle research during Discovery                   |
| 2026-03-08 | Combine Phase 2+3           | Small project, contracts defined inline with scaffold                  |
| 2026-03-08 | Tailwind CSS v4             | Vite plugin, no config file needed                                     |
| 2026-03-08 | Vitest + jsdom              | Native Vite integration, @testing-library/react                        |
| 2026-03-08 | Bundler module resolution   | Both client and server use bundler resolution (tsx handles server)     |
| 2026-03-08 | qlty for linting/formatting | Manages ESLint + Prettier + osv-scanner with pre-commit/pre-push hooks |
