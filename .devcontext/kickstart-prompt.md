# textchisel — Architecture Design Brief for AI Agent

## Your Role

You are an architecture designer for **textchisel**, a prompt sculpting app. Your job is to produce a complete, implementable architecture document — data models, API contracts, component structure, and LLM call specifications — that a development team can build from directly.

**Your first action must be the Tech Stack Interview (see STEP ZERO below).** Do not read the reference documents or begin designing until the founder has confirmed the tech stack. The rest of this brief assumes you have those answers.

You have two reference documents attached to this project. Read them in this order:

1. **`.devcontext/textchisel-prd.md`** — the Product Requirements Document. Read sections 1–5 carefully. Skim sections 6–7 (examples) for context on difficulty range. Read sections 9 (MVP) and 11 (Design Principles) word for word. These are your constraints.

2. **`.devcontext/technical-reference-guide.md`** — the Technical Reference Guide. This is your implementation toolbox. Do NOT read it front to back. Navigate it as follows:
   - **Start with** the "TOP 5 CRITICAL REFERENCES" section. These five entries define your core stack.
   - **Then read** the "IMPLEMENTATION ARCHITECTURE SYNTHESIS" section at the bottom. This gives you a recommended MVP stack, latency budget, and phase plan. **Reconcile these recommendations with the founder's confirmed tech stack choices from the interview — the founder's choices override any recommendation here.**
   - **Then pull from** individual AREA sections only as needed when designing specific components (e.g., read AREA 1 when designing the evaluation engine, AREA 5 when designing the spider chart, etc.)

Do NOT try to use every reference. Most are there for later phases. For the MVP, you need maybe 10–15 of the 60+ references. Choose deliberately.

---

## STEP ZERO: Tech Stack Interview (Do This BEFORE Designing Anything)

Before you read the reference documents, before you sketch a single component — **interview the founder about their tech stack preferences.** The reference guide contains recommendations, but the founder has final say on every technology choice. Do not assume any stack. Do not proceed to architecture design until this interview is complete.

Ask these questions in a single, organized message. Wait for answers before continuing.

### Questions to Ask

**1. Frontend Framework**
The reference guide suggests React (for Zustand state management, chartjs-plugin-dragdata, React 19 useOptimistic). But the founder may prefer otherwise.

- Ask: "What frontend framework do you want to build in? React, Vue, Svelte, SolidJS, or something else? Do you have an existing project or codebase this needs to integrate with?"

**2. Language & Runtime**

- Ask: "TypeScript or JavaScript? Node.js backend, Python backend, or both? Any preference between a monorepo (frontend + backend together) or separate services?"

**3. LLM Provider & Models**
This is critical — it determines API patterns, cost structure, latency, and whether features like log-probs (for G-Eval probability-weighted scoring) are available.

- Ask: "Which LLM provider(s) do you want to use? OpenAI, Anthropic, both, or open-source/self-hosted? Do you have a preference for specific models (e.g., GPT-4.1, Claude Sonnet, a smaller model for evaluation)? Should the architecture support swapping providers easily?"

**4. Hosting & Deployment**

- Ask: "Where do you want this deployed? Vercel, AWS, GCP, self-hosted, or local-first for now? Is this a web app, desktop app (Electron/Tauri), or CLI tool? For MVP, would you prefer a single-page app that calls LLM APIs directly from the browser, or a client-server architecture with a backend?"

**5. Database & Persistence**

- Ask: "For version history and session state — do you want a database (SQLite, Postgres, Supabase), local file storage, browser localStorage/IndexedDB, or no persistence for MVP (in-memory only, lost on refresh)?"

**6. State Management**
The reference guide recommends Zustand + Immer + Zundo for undo/redo. But this is React-specific.

- Ask: "Any preference for state management? The reference guide suggests Zustand with Zundo for undo/redo. Are you comfortable with that, or do you prefer Redux, Jotai, MobX, Pinia (Vue), or something else?"

**7. Visualization**
The radar/spider chart is the primary UI. Options range from quick-and-dirty to fully custom.

- Ask: "For the spider chart — do you want the fastest path (Chart.js + dragdata plugin), maximum customizability (D3.js), or a component library approach (Recharts, Apache ECharts)? Do you care about the visual polish of the chart for MVP, or is functional-first fine?"

**8. Styling**

- Ask: "CSS approach? Tailwind, CSS modules, styled-components, shadcn/ui, or something else? Any existing design system or brand guidelines?"

**9. Testing**

- Ask: "What level of testing for MVP? None (move fast), unit tests only, or full coverage including E2E? Any preferred testing frameworks?"

**10. Budget & Cost Sensitivity**
This affects model selection, evaluation strategy (how many scoring calls per regeneration), and caching strategy.

- Ask: "How cost-sensitive is the MVP? Each regeneration cycle involves 1 generation call + 3 scoring calls (one per dimension) × 3 samples for noise reduction = ~10 LLM calls. At GPT-4.1 pricing that's roughly $0.02–0.05 per cycle. Is that acceptable, or should we optimize for cost (smaller models for evaluation, fewer samples)?"

**11. Open Questions**

- Ask: "Anything else about the tech stack that matters to you? Any technologies you love, any you refuse to use? Any infrastructure you already have set up that we should build on?"

### How to Use the Answers

Once you have the founder's answers:

1. **Override** any reference guide recommendation that conflicts with the founder's preference. The reference guide is advisory; the founder's choices are binding.
2. **Flag trade-offs.** If the founder's choice creates a meaningful trade-off (e.g., choosing Vue means the Zustand + Zundo undo/redo stack isn't available), explain the trade-off and propose an equivalent solution in their chosen stack.
3. **Confirm the final stack** in a brief summary before proceeding to architecture design. Get explicit approval.
4. **Then proceed** to the architecture work described in the rest of this document, using the confirmed stack.

---

## The One Thing That Matters Most

The founder's stated priority:

> "Get as quick as possible to defining my dimensions and qualitative rubrics along these dimensions and being able to regenerate prompts accordingly."

This means the **critical path** is:

```
User types intent → System proposes dimensions + rubrics → User sees spider chart →
User locks dimensions → User moves one slider → System regenerates prompt →
System scores and updates chart → User evaluates → Repeat
```

Every architecture decision should be evaluated against: **does this make the critical path shorter, faster, or more reliable?** If it doesn't, defer it.

---

## Architecture Constraints

### Hard constraints (violating these means the architecture is wrong)

1. **Three-layer separation is mandatory.** The User Layer (dimensions, sliders, locks), Grammar Layer (prompt modification mechanics), and Evaluation Layer (rubric-based scoring) must be architecturally separate. They communicate through well-defined interfaces. No layer knows the internals of another.

2. **The loop must complete in under 8 seconds.** From the moment the user clicks "Regenerate" to the moment the spider chart updates with new scores. The latency budget in the reference guide (AREA 7) breaks this down. Design for it.

3. **Dimensions and rubrics are first-class data objects, not strings.** A dimension is not just a name. It has: a name (user's vocabulary), a rubric (measurement definition), a current score, a target score, a lock state, and a rubric type classification. A rubric is not just text — it has: a natural language description, auto-generated evaluation steps (G-Eval style), and a scoring output specification. Design the data models accordingly.

4. **The grammar layer is the IK solver.** It takes as input: the current prompt, the locked dimension values (constraints), and the target value for the free dimension. It outputs: a modified prompt that moves toward the target while respecting locks. It must prefer the **minimum-change solution** — the modification closest to the current prompt that achieves the target (continuity preservation, per the IK analogy).

5. **Everything is reversible.** Every state transition (slider move, regeneration, lock change) must be undoable. This means full state snapshots or a command log with inverse operations.

### Soft constraints (the architecture should support these but they're not MVP)

- Up to 7 dimensions (MVP has 3)
- User-defined dimensions (MVP uses system-generated only)
- Custom rubric editing (MVP auto-generates rubrics)
- Fine-grained text locking (MVP locks whole dimensions only)
- Batch exploration / multiple variants (MVP generates one at a time)
- Dimension coupling visualization (MVP doesn't show coupling)
- Confidence intervals on scores (MVP shows point estimates)
- Specialized evaluator chains per dimension (MVP uses a single evaluator pattern)

The architecture must have clear extension points for each of these. Design interfaces, not implementations, for the soft constraints.

---

## What to Design (Deliverables)

### 1. Data Models

Define the core entities. At minimum:

- **Session** — one sculpting session (user intent → final prompt)
- **Dimension** — name, rubric, scores, lock state, target
- **Rubric** — description, evaluation steps, scoring spec, rubric type
- **PromptVersion** — the full prompt text, all dimension scores, slider states, timestamp
- **GrammarInstruction** — the internal representation the grammar layer uses to modify prompts (the "joint angles")

Think carefully about what goes in each. The Rubric model is the most complex — it must support the 10+ rubric types listed in PRD section 5.2 (ordinal, count-based, taxonomic, extremum, graph-theoretic, ratio, simulation-based, narratological, dialectical, topological) even if MVP only uses the simpler ones.

### 2. The Dimension Generation Pipeline

When the user types their intent ("Write a cold email to a Series B investor about our AI infrastructure startup"), the system must:

1. Propose 3 dimensions with names and rubrics
2. Present them for user approval
3. On approval, initialize the spider chart

Design this pipeline. Key decisions:

- What prompt generates good dimensions? (Think: what makes a dimension "good" per the IK analogy — it should correspond to an independent, coherent mode of variation)
- What prompt generates good rubrics from dimension names? (Reference: DeepEval's G-Eval auto-generates evaluation steps; OpenRubrics' Contrastive Rubric Generation)
- How do you validate that proposed dimensions are sufficiently independent? (MVP: heuristic check. Phase 2: Jacobian analysis)
- Single LLM call or multi-step? (Consider latency)

### 3. The Evaluation Engine

After each regeneration, score the prompt on all dimensions. Design:

- The scoring prompt template (parameterized by rubric)
- How evaluation steps are generated and cached per dimension
- How scores are normalized across different rubric types (ordinal levels vs. counts vs. ratios)
- Parallel execution strategy (all dimensions scored simultaneously via async calls)
- Noise reduction strategy for MVP (multi-sample averaging with N=3 is the recommendation from the reference guide)

Key reference: G-Eval's probability-weighted scoring. Critical implementation detail: when log-probs are available, use them; when not, fall back to multi-sample averaging.

### 4. The Grammar Layer (IK Solver)

This is the hardest component. It takes:

- Current prompt text
- Locked dimensions with their scores
- Target value for the free dimension
- The rubric definition for the free dimension

And produces: a modified prompt.

Design decisions:

- **MVP approach:** Use a single LLM call with a carefully structured meta-prompt that includes the current prompt, the dimension to change, its rubric, the target direction, and explicit instructions to preserve locked aspects. This is the "rule-based" approach from the reference guide — not true IK, but a working approximation.
- **The meta-prompt structure:** This is the most important prompt in the entire system. It must communicate: what the prompt currently is, what one specific quality dimension means (via the rubric), which direction to move it, and what must NOT change (locked dimensions, described via their rubrics so the LLM understands what "locked" means in qualitative terms).
- **Extension point for Phase 2:** The interface should accept a `GrammarInstruction` object so that later phases can swap in TextGrad, CriSPO, or true IK-style optimization without changing the rest of the system.

### 5. The Regeneration Loop Orchestration

Design the full loop as a pipeline:

```
User adjusts slider →
  [Validate: is target within workspace?] →
  Grammar Layer generates modified prompt →
  [Stream prompt to UI for immediate display] →
  Evaluation Engine scores all dimensions in parallel →
  [Update spider chart with new scores] →
  [Save PromptVersion to history]
```

Key decisions:

- Do you stream the regenerated prompt while scoring runs in the background? (Yes — show the text immediately, update scores when ready)
- How do you handle score deviations on locked dimensions? (Show the deviation, flag if > threshold, offer to revert)
- What triggers regeneration — slider release, a button, or continuous tracking? (MVP: button. Phase 2: debounced slider release)

### 6. The UI Component Architecture

Design the component tree. Key components:

- **IntentInput** — text field for initial user intent
- **DimensionProposal** — displays proposed dimensions with rubrics, accept/reject/modify
- **SpiderChart** — interactive radar chart with draggable vertices and lock toggles
- **PromptDisplay** — shows current prompt text, highlights changes from previous version
- **VersionTimeline** — scrollable history of all versions, click to compare/revert
- **DimensionPanel** — sidebar showing each dimension's rubric, current score, target, lock state

Reference: Use the charting library confirmed in the tech stack interview. Coolors.co padlock pattern for lock UX. Use the state management solution confirmed in the tech stack interview (with undo/redo support).

### 7. State Management

Design the state shape. Must support:

- Current session state (all dimensions, all scores, all lock states, current prompt)
- Undo/redo stack (every slider move, every regeneration, every lock toggle is reversible)
- Version history (every PromptVersion ever generated in this session)
- Optimistic updates (show predicted scores before evaluation completes)

Reference: Use the state management stack confirmed in the tech stack interview. The key requirement is command-pattern undo/redo — each user action is a reversible command. If the confirmed stack doesn't have a built-in temporal middleware (like Zundo for Zustand), design a custom command log.

### 8. API Design

Based on the deployment model confirmed in the tech stack interview, define the appropriate surface. If client-server: REST or tRPC endpoints. If browser-direct: LLM call specifications with client-side orchestration. If hybrid: define both. Key operations regardless of architecture:

- `generateDimensions(userIntent) → Dimension[]`
- `generateRubric(dimensionName, userIntent) → Rubric`
- `modifyPrompt(currentPrompt, freeDimension, targetValue, lockedDimensions[]) → string`
- `scorePrompt(prompt, dimension, rubric) → Score` (called N times in parallel)
- `scoreBatch(prompt, dimensions[]) → Score[]` (alternative: single call scoring all dims)

---

## Decision Framework

When you face a design choice, apply these filters in order:

1. **Does it serve the critical path?** (intent → dimensions → rubrics → slider → regenerate → score) If not, defer.
2. **Is it the minimum that works?** Don't gold-plate. The MVP is 3 system-generated dimensions for cold emails. Everything else is Phase 2+.
3. **Does it preserve the three-layer separation?** If a component mixes concerns (e.g., the UI directly constructs grammar instructions), redesign.
4. **Can it complete in the latency budget?** If your design adds a sequential LLM call, find a way to parallelize or eliminate it.
5. **Is the extension point clean?** Will swapping in a CriSPO-based grammar layer or a calibration network break anything? If yes, add an interface boundary.

---

## Common Pitfalls to Avoid

- **Don't build a prompt template library.** The grammar layer is not a lookup table of "if urgency > 0.7, add this sentence." It's an LLM call that understands rubrics and makes targeted modifications. Rule-based mappings are useful as initialization heuristics, not as the core engine.

- **Don't normalize everything to 0–1.** Different rubric types have different natural scales (ordinal 1–5, counts 0–N, ratios 0.0–1.0, taxonomic categories). The spider chart needs a normalization layer, but the internal scoring should preserve native scales. Premature normalization destroys information.

- **Don't make dimensions static.** Even in MVP, the data model must treat dimensions as runtime objects, not compile-time constants. The entire point of Phase 2 is that users define their own.

- **Don't ignore lock fidelity.** When the user locks "urgency" at Level 4 and adjusts "personalization," the regenerated prompt MUST still score at or near Level 4 on urgency. If it doesn't, the sculpting metaphor breaks. Design the grammar layer prompt to explicitly reference locked rubric scores, and design the evaluation loop to flag deviations.

- **Don't over-engineer the grammar layer for MVP.** A well-crafted single LLM call that says "Here is a prompt. Here is a quality dimension with this rubric. Move the prompt toward [target] on this dimension while preserving [locked descriptions]" will work surprisingly well. Save TextGrad/CriSPO integration for Phase 2.

- **Don't forget that the rubric IS the dimension.** A dimension without a rubric is meaningless. "Urgency" means nothing until the rubric defines what Level 1 vs. Level 5 looks like. The rubric generation step is not auxiliary — it's the most important generation in the entire pipeline, because every subsequent evaluation depends on it.

---

## Output Format

Produce your architecture as a structured document with:

1. **System Overview Diagram** — showing the three layers, data flow, and LLM call points
2. **Data Models** — with field types, relationships, and example values
3. **Pipeline Specifications** — for each pipeline (dimension generation, evaluation, grammar layer, regeneration loop), show inputs, outputs, LLM prompt templates, and async/parallel structure
4. **Component Tree** — for the UI, with state dependencies
5. **State Shape** — the full Zustand store structure
6. **API Contracts** — every endpoint or LLM call specification
7. **Latency Analysis** — showing where time is spent in the critical path and how you stay under 8s
8. **Extension Points** — for each soft constraint, where in the architecture it plugs in and what interface it needs

---

## Final Note on the Analogies

The PRD describes two governing analogies: inverse kinematics (primary) and free energy landscapes (supplementary). For the MVP architecture, the IK analogy matters in exactly two places:

1. **The grammar layer must prefer minimum-change solutions.** When modifying a prompt to increase urgency, it should make the smallest changes that achieve the target — not rewrite the whole prompt. This is the IK solver preferring the joint configuration closest to the current one.

2. **Locking a dimension constrains the solution space.** The grammar layer must understand locked dimensions not as "don't touch these" but as "maintain these scores" — which may require small adjustments to locked-dimension-relevant parts of the prompt even while focusing on the free dimension, as long as the scores are preserved.

The free energy landscape analogy, the Jacobian, manipulability, singularity detection — all of that is Phase 2+. Don't architect for it now. Just don't prevent it.
