# Module Map

## Dependency Graph

```
shared/ (contracts — all modules depend on this)
  │
  ├── db (PGlite + Drizzle)
  │     └── used by: store, dimensions, evaluation, orchestrator
  │
  ├── store (Zustand)
  │     ├── imports: dimensions/crud (persistence bridge, ADR-004)
  │     └── used by: chart, shell
  │
  ├── dimensions (generateObject)
  │     └── used by: orchestrator
  │
  ├── evaluation (generateObject)
  │     └── used by: orchestrator
  │
  ├── rewriter (streamText)
  │     └── used by: orchestrator
  │
  ├── orchestrator (loop coordinator)
  │     └── used by: shell
  │
  ├── chart (SpiderChart React component)
  │     └── used by: shell
  │
  ├── prompts (meta-prompt generation)
  │     └── used by: server/routes/llm.ts
  │
  └── shell (app chrome)
       └── top-level, no dependents
```

## Build Order

### Foundation (Phase 2+3)

| Order | Module | Why First                              |
| ----- | ------ | -------------------------------------- |
| 1     | shared | All modules depend on contracts        |
| 2     | db     | Data layer, no logic dependencies      |
| 3     | store  | UI state, depends only on shared types |

### Construction (Phase 4)

| Wave | Modules                       | Parallel? | Dependencies                       |
| ---- | ----------------------------- | --------- | ---------------------------------- |
| 1    | dimensions, evaluation, chart | Yes       | shared only                        |
| 2    | rewriter                      | No        | needs evaluation contract          |
| 3    | orchestrator                  | No        | needs evaluation + rewriter        |
| 4    | shell                         | No        | needs store + chart + orchestrator |

### Integration Sessions

| After      | Integration Test                                              |
| ---------- | ------------------------------------------------------------- |
| Foundation | db ↔ store (live queries update store)                       |
| Wave 1     | dimensions → evaluation (generated dims can be scored)        |
| Wave 2     | evaluation → rewriter (scores inform rewrite prompt)          |
| Wave 3     | orchestrator ↔ evaluation + rewriter (loop works end-to-end) |
| Wave 4     | Full system (shell drives orchestrator through store)         |

---

## Module Details

### shared/

- **Status:** done
- **Files:** `shared/types.ts`, `shared/schema.ts`, `shared/providers.ts` (ADR-005)
- **Contracts:**
  - `Session` — { id, intent, status, createdAt }
  - `Dimension` — { id, sessionId, name, description, weight, rubric, evalPrompt, rewriteHint, examples }
  - `EvaluationScore` — { score, reasoning }
  - `DimensionPrompts` — { evalPrompt, rewriteHint }
  - `RewritePlan` — { inferredIntent, instructions }
  - `RewriteContext` — { intent, currentText, dimensions, currentScores, targetScores, lockedDimensionIds }
  - `SuggestedDimension` — { name, description, rubric } (ADR-004)
  - `PromptVersion` — { id, sessionId, versionNum, systemPrompt, userTemplate, scores, text }
  - `EvalStepCache` — { versionId, dimensionId, score, reasoning, model, cached }
  - `TargetScores` — Record<dimensionId, number> (ADR-001)
  - `LockSet` — Set<dimensionId>
  - `Provider`, `PROVIDER_MODELS`, `PROVIDER_LABELS`, `PROVIDER_KEY_HINTS` (ADR-005)

### db

- **Status:** done
- **Responsibility:** PGlite lifecycle, Drizzle client setup, schema migration (raw SQL), query helpers, version snapshot persistence
- **Key files:** `src/db/client.ts`, `src/db/migrations.ts`, `src/db/queries.ts`
- **Test strategy:** In-memory PGlite instance, no mocks needed
- **Extension points:** New tables, new query helpers

### store

- **Status:** done
- **Responsibility:** Zustand slices, middleware composition (devtools→persist→temporal→immer)
- **Key files:** `src/store/index.ts`, `src/store/slices/`
- **Slices:** promptSlice, evaluationSlice, uiSlice
- **Test strategy:** Unit test each slice in isolation with mock state
- **Extension points:** New slices, new derived selectors

### dimensions

- **Status:** done
- **Responsibility:** Generate evaluation dimensions from user intent via generateObject
- **Key files:** `src/dimensions/generate.ts`, `src/dimensions/crud.ts`, `src/dimensions/rubric-helpers.ts`
- **LLM pattern:** `generateObject` with Zod schema → Dimension[]
- **Test strategy:** Mock generateObject → test prompt construction + Zod parsing
- **Extension points:** New dimension sources (templates, presets)

### evaluation

- **Status:** done
- **Responsibility:** G-Eval style scoring per dimension, score normalization, eval caching
- **Key files:** `src/evaluation/score.ts`, `src/evaluation/normalize.ts`, `src/evaluation/cache.ts`, `src/evaluation/constants.ts`
- **LLM pattern:** `generateObject` per dimension → DimensionScore
- **Test strategy:** Mock generateObject → test G-Eval prompt + normalization logic
- **Extension points:** New evaluation strategies, custom rubrics

### rewriter

- **Status:** done
- **Responsibility:** Grammar layer meta-prompt construction, streaming text rewrite
- **Key files:** `src/rewriter/prompt.ts`, `src/rewriter/stream.ts`
- **LLM pattern:** `streamText` with meta-prompt → revised text
- **Test strategy:** Mock streamText → test prompt assembly + constraint injection
- **Extension points:** New rewriting strategies, style-specific prompts

### orchestrator

- **Status:** done
- **Responsibility:** Regeneration loop (evaluate→compare→rewrite→repeat), convergence detection
- **Key files:** `src/orchestrator/loop.ts`, `src/orchestrator/convergence.ts`
- **LLM pattern:** None directly — coordinates evaluation + rewriter
- **Test strategy:** Mock evaluation + rewriter → test loop logic, convergence, early exit
- **Extension points:** Custom convergence criteria, max iteration limits

### chart

- **Status:** done
- **Responsibility:** SpiderChart React component, drag/lock behavior, target overlay
- **Key files:** `src/chart/SpiderChart.tsx`, `src/chart/types.ts`
- **Test strategy:** Component tests with static data, visual regression
- **Extension points:** New chart interactions, additional overlays

### prompts

- **Status:** done
- **Responsibility:** Tier 1/2 meta-prompt generation — dimension evaluation prompts (evalPrompt), rewrite hints (rewriteHint), few-shot examples, and rewrite planner
- **Key files:** `src/prompts/generate.ts`, `src/prompts/rewrite-planner.ts`, `src/prompts/index.ts`
- **LLM pattern:** `generateObject` for Tier 1 (per-dimension meta-prompts) and Tier 2 (rewrite plan)
- **Test strategy:** Mock generateObject → test prompt construction + schema validation
- **Extension points:** New prompt tiers, custom rubric-type classifiers
- **Added by:** ADR-003

### shell

- **Status:** done
- **Responsibility:** App layout, panels, intent input form, version timeline, provider config
- **Key files:** `src/shell/App.tsx`, `src/shell/DimensionPopover.tsx`, `src/shell/useWorkflows.ts`, `src/shell/IntentPanel.tsx`, `src/shell/ChartPanel.tsx`, `src/shell/TextPanel.tsx`, `src/shell/SettingsDialog.tsx`, `src/shell/AddDimensionDialog.tsx`, `src/shell/api.ts`, `src/shell/useSettings.ts`
- **Server routes:** `server/routes/llm.ts` (5 endpoints), `server/model.ts` (model factory)
- **Test strategy:** Unit tests for components + API module (26 tests), integration tests with mock store
- **Extension points:** New panels, layout configurations, provider config UI, version timeline
