# Contributing to textchisel

## Getting Started

### Prerequisites

- Node.js 20+
- An API key from OpenAI or Anthropic

### Setup

```bash
git clone https://github.com/asuworks/textchisel.git
cd textchisel
pnpm install
```

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

### Run

```bash
pnpm dev
```

Starts both the Vite dev server (frontend) and Express server (API proxy) concurrently. Open http://localhost:5173.

### Build for Production

```bash
pnpm build
pnpm start
```

## Tech Stack

| Layer    | Technology                                           |
| -------- | ---------------------------------------------------- |
| Frontend | React 19, Vite, Tailwind CSS v4, shadcn/ui           |
| State    | Zustand + Zundo (undo/redo)                          |
| Chart    | Chart.js + chartjs-plugin-dragdata                   |
| LLM      | Vercel AI SDK (`generateObject`, `streamText`)       |
| Database | PGlite (embedded Postgres, in-browser) + Drizzle ORM |
| Server   | Express (serves UI + proxies LLM calls)              |
| Quality  | qlty CLI (ESLint 9 + Prettier + osv-scanner)         |
| Tests    | Vitest + jsdom + @testing-library/react              |

## Architecture

See [`.devcontext/architecture.md`](.devcontext/architecture.md) for the full architecture document with data flow diagrams and module map.

### Key Design Decisions

- **Single process** — Express serves the UI and proxies LLM calls. No separate backend to deploy.
- **PGlite** — Embedded Postgres runs entirely in the browser (IndexedDB). No database server needed.
- **Strict module boundaries** — 8 modules share types through a `shared/` contract layer. No cross-module imports.
- **Immutable versions** — Every rewrite creates a new snapshot. Nothing is mutated.
- **Meta-prompting** — The system auto-generates specialized evaluation prompts and rewrite hints per dimension, so the LLM understands rubrics precisely.

### Modules

| Module         | Responsibility                                            |
| -------------- | --------------------------------------------------------- |
| `shared`       | Zod schemas, Drizzle table definitions, TypeScript types  |
| `db`           | PGlite lifecycle, Drizzle client, migrations              |
| `store`        | Zustand slices (prompt, eval, ui), middleware composition |
| `dimensions`   | Generate dimensions from intent, dimension CRUD           |
| `evaluation`   | G-Eval scoring per dimension, normalization, caching      |
| `rewriter`     | Grammar layer meta-prompt, streaming text rewrite         |
| `orchestrator` | Evaluate-rewrite loop, convergence detection              |
| `chart`        | Spider chart component, drag/lock, target overlay         |
| `shell`        | App layout, panels, intent input, provider config         |

## Development Commands

```bash
pnpm dev          # Start dev servers (client + API)
pnpm typecheck    # TypeScript check (client + server)
pnpm lint         # ESLint
pnpm lint:fix     # ESLint with auto-fix
pnpm test:run     # Run tests once
pnpm test         # Watch mode
```

## Conventions

- All cross-module types live in `shared/`. Never define them locally.
- Modules never import from each other directly.
- Spider chart values are integers 1–5.
- PromptVersions are immutable — create new versions, never mutate.
- Zustand middleware order: devtools → persist → temporal → immer.
- Server-side only: API keys, LLM calls. Client-side: UI, PGlite, chart.
