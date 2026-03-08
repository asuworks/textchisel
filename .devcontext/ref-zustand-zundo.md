# Zustand + Zundo + Immer Reference Guide

Generated: 2026-03-08
For: textchisel state management implementation

---

## Table of Contents

1. [Zustand Store Setup with TypeScript](#1-zustand-store-setup-with-typescript)
2. [Slices Pattern](#2-slices-pattern)
3. [Immer Middleware](#3-immer-middleware)
4. [Zundo Temporal Middleware (Undo/Redo)](#4-zundo-temporal-middleware-undoredo)
5. [Persist Middleware](#5-persist-middleware)
6. [React Integration & Selectors](#6-react-integration--selectors)
7. [Middleware Composition](#7-middleware-composition)
8. [Sources](#8-sources)

---

## 1. Zustand Store Setup with TypeScript

### Basic Typed Store

```typescript
import { create } from "zustand";

// Define state interface
interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

// create<T>()(...) — note the double parentheses for TS inference
const useCounterStore = create<CounterState>()((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}));
```

Key points:

- `create<StateType>()` uses curried form for TypeScript generic inference.
- The double `()()` is required — first call binds the type, second receives the state creator.
- `set` performs a shallow merge by default. Pass `true` as second arg to replace entire state: `set(newState, true)`.
- `get` is available as the second parameter: `(set, get) => ({...})`.

### Accessing State Outside React

```typescript
// Get current state snapshot (non-reactive)
const count = useCounterStore.getState().count;

// Subscribe to changes
const unsub = useCounterStore.subscribe((state) =>
  console.log("Count changed:", state.count),
);

// Set state externally
useCounterStore.setState({ count: 42 });
```

---

## 2. Slices Pattern

The slices pattern organizes large stores into modular pieces using `StateCreator`.

### Defining a Slice

```typescript
import { StateCreator } from "zustand";

// Full combined store type (forward-declared)
type AppStore = PromptSlice & UISlice;

// --- Prompt Slice ---
interface PromptSlice {
  systemPrompt: string;
  userTemplate: string;
  setSystemPrompt: (prompt: string) => void;
  setUserTemplate: (template: string) => void;
}

const createPromptSlice: StateCreator<
  AppStore, // Full store type (enables cross-slice access)
  [], // Middleware mutators (empty for basic)
  [], // Additional mutators
  PromptSlice // This slice's type
> = (set) => ({
  systemPrompt: "",
  userTemplate: "",
  setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
  setUserTemplate: (template) => set({ userTemplate: template }),
});

// --- UI Slice ---
interface UISlice {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
});
```

### Combining Slices

```typescript
import { create } from "zustand";

const useAppStore = create<AppStore>()((...a) => ({
  ...createPromptSlice(...a),
  ...createUISlice(...a),
}));
```

### Slices with Immer Middleware

When using immer with slices, the `StateCreator` type parameters change:

```typescript
import { StateCreator } from "zustand";

type ImmerStateCreator<T> = StateCreator<
  AppStore,
  [["zustand/immer", never]], // Immer mutator
  [],
  T
>;

const createPromptSlice: ImmerStateCreator<PromptSlice> = (set) => ({
  systemPrompt: "",
  userTemplate: "",
  setSystemPrompt: (prompt) =>
    set((state) => {
      state.systemPrompt = prompt; // Direct mutation with immer
    }),
  setUserTemplate: (template) =>
    set((state) => {
      state.userTemplate = template;
    }),
});
```

---

## 3. Immer Middleware

Immer enables mutable-style state updates while maintaining immutability under the hood.

### Installation

```bash
npm install immer
# immer middleware is built into zustand — no extra package needed
```

### Import

```typescript
import { immer } from "zustand/middleware/immer";
```

### Basic Usage

```typescript
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface TodoStore {
  todos: { id: number; title: string; completed: boolean }[];
  addTodo: (title: string) => void;
  toggleTodo: (id: number) => void;
  removeTodo: (id: number) => void;
}

const useTodoStore = create<TodoStore>()(
  immer((set) => ({
    todos: [],

    addTodo: (title) =>
      set((state) => {
        // Push directly — immer handles immutability
        state.todos.push({
          id: Date.now(),
          title,
          completed: false,
        });
      }),

    toggleTodo: (id) =>
      set((state) => {
        const todo = state.todos.find((t) => t.id === id);
        if (todo) {
          todo.completed = !todo.completed; // Direct mutation
        }
      }),

    removeTodo: (id) =>
      set((state) => {
        const index = state.todos.findIndex((t) => t.id === id);
        if (index !== -1) {
          state.todos.splice(index, 1); // Direct splice
        }
      }),
  })),
);
```

### When to Use Immer

- State is nested 2+ levels deep
- Frequent updates to arrays (push, splice, filter-in-place)
- Complex object mutations that would require verbose spread syntax
- Working with normalized or deeply nested data structures

### When NOT to Use Immer

- Simple flat state (overhead not worth it)
- State with only primitive values

---

## 4. Zundo Temporal Middleware (Undo/Redo)

Zundo adds time-travel (undo/redo) to Zustand stores. Under 700 bytes gzipped.

### Installation

```bash
npm install zundo
```

### Import

```typescript
import { temporal } from "zundo";
```

### Basic Setup

```typescript
import { create } from "zustand";
import { temporal } from "zundo";

interface EditorState {
  content: string;
  fontSize: number;
  setContent: (content: string) => void;
  setFontSize: (size: number) => void;
}

const useEditorStore = create<EditorState>()(
  temporal(
    (set) => ({
      content: "",
      fontSize: 14,
      setContent: (content) => set({ content }),
      setFontSize: (size) => set({ fontSize: size }),
    }),
    {
      // --- Temporal options (all optional) ---
    },
  ),
);
```

### Temporal Options Reference

```typescript
temporal(stateCreator, {
  // Only track specific fields (ignore UI state, track data)
  partialize: (state) => ({
    content: state.content,
    // Omit fontSize, sidebarOpen, etc.
  }),

  // Limit history depth
  limit: 100,

  // Debounce/throttle history snapshots
  handleSet: (handleSet) =>
    throttle<typeof handleSet>((state) => {
      console.log("handleSet called");
      handleSet(state);
    }, 1000),

  // Custom equality check — only save when meaningful change occurs
  equality: (pastState, currentState) => isEqual(pastState, currentState),

  // Store diffs instead of full snapshots (performance optimization)
  diff: (pastState, currentState) => {
    const myDiff: Partial<typeof pastState> = {};
    // Compute and return only changed fields
    return myDiff;
  },

  // Callback when state is saved to history
  onSave: (pastState, currentState) => {
    console.log("State saved to history");
  },

  // Wrap the temporal store itself with middleware
  wrapTemporal: (storeInitializer) =>
    devtools(storeInitializer, { name: "temporal-store" }),
});
```

### Core API: undo(), redo(), clear()

Access the temporal store via `.temporal.getState()`:

```typescript
const {
  undo,
  redo,
  clear,
  pastStates,
  futureStates,
  isTracking,
  pause,
  resume,
  setOnSave,
} = useEditorStore.temporal.getState();

// Undo last change
undo();

// Undo 3 steps back
undo(3);

// Redo last undone change
redo();

// Redo 2 steps forward
redo(2);

// Clear all history
clear();

// Pause/resume tracking
pause(); // Stop recording history
resume(); // Resume recording history

// Check tracking status
isTracking; // boolean
```

### Creating a Reactive useTemporalStore Hook

`pastStates` and `futureStates` are NOT reactive when accessed directly.
You must create a derived hook for reactive access in components:

```typescript
import { useStore } from 'zustand'
import type { TemporalState } from 'zundo'

// Create a reactive hook for the temporal store
const useTemporalStore = <T>(
  selector: (state: TemporalState<Partial<EditorState>>) => T,
) => useStore(useEditorStore.temporal, selector)

// Usage in components
function UndoRedoControls() {
  const { undo, redo, clear } = useTemporalStore((state) => ({
    undo: state.undo,
    redo: state.redo,
    clear: state.clear,
  }))

  const canUndo = useTemporalStore((state) => state.pastStates.length > 0)
  const canRedo = useTemporalStore((state) => state.futureStates.length > 0)

  return (
    <>
      <button onClick={() => undo()} disabled={!canUndo}>Undo</button>
      <button onClick={() => redo()} disabled={!canRedo}>Redo</button>
      <button onClick={() => clear()}>Clear History</button>
    </>
  )
}
```

### Debounce Configuration for Slider/Rapid Input Tracking

For inputs like sliders that fire rapidly, use `handleSet` with a debounce:

```typescript
import { temporal } from "zundo";
import { debounce } from "lodash-es"; // or throttle

const useStore = create<MyState>()(
  temporal(
    (set) => ({
      temperature: 0.7,
      setTemperature: (val: number) => set({ temperature: val }),
    }),
    {
      handleSet: (handleSet) =>
        debounce<typeof handleSet>((state) => {
          handleSet(state);
        }, 500), // Only record after 500ms of inactivity
    },
  ),
);
```

Alternative: use `throttle` instead of `debounce` to record at regular intervals during continuous input.

### Partialize: Track Data, Not UI State

For textchisel: track prompt configuration, ignore UI state like sidebar/panel positions.

```typescript
temporal(stateCreator, {
  partialize: (state) => {
    // Only these fields will be tracked in undo/redo history
    const { systemPrompt, userTemplate, variables, modelConfig } = state;
    return { systemPrompt, userTemplate, variables, modelConfig };
    // sidebarOpen, activeTab, etc. are excluded
  },
});
```

---

## 5. Persist Middleware

### Import

```typescript
import { persist, createJSONStorage } from "zustand/middleware";
```

### Basic Setup

```typescript
const useStore = create<MyState>()(
  persist(
    (set) => ({
      // ... state and actions
    }),
    {
      name: "textchisel-storage", // localStorage key
    },
  ),
);
```

### Full Options Reference

```typescript
persist(stateCreator, {
  // Required: unique storage key
  name: "textchisel-storage",

  // Storage backend (defaults to localStorage)
  storage: createJSONStorage(() => localStorage),
  // Or: createJSONStorage(() => sessionStorage)

  // Only persist specific fields
  partialize: (state) => ({
    systemPrompt: state.systemPrompt,
    userTemplate: state.userTemplate,
    // Omit actions and transient UI state
  }),

  // Version for migration support
  version: 1,

  // Migration function when version changes
  migrate: (persistedState, version) => {
    if (version === 0) {
      // Migrate from v0 to v1
      (persistedState as any).newField = "default";
    }
    return persistedState as MyState;
  },

  // Custom merge strategy (default: shallow merge)
  merge: (persistedState, currentState) => ({
    ...currentState,
    ...(persistedState as Partial<MyState>),
  }),

  // Lifecycle hook: fires when rehydration starts
  onRehydrateStorage: (state) => {
    console.log("Hydration starts");
    // Return optional post-hydration callback
    return (state, error) => {
      if (error) {
        console.error("Hydration failed:", error);
      } else {
        console.log("Hydration complete");
      }
    };
  },

  // Skip hydration (for SSR/manual control)
  skipHydration: true, // Then call useStore.persist.rehydrate() manually
});
```

### Persist API (runtime)

```typescript
// Check hydration status
useStore.persist.hasHydrated(); // boolean
useStore.persist.onHydrate(cb); // subscribe to hydration start
useStore.persist.onFinishHydration(cb); // subscribe to hydration end

// Manual rehydration (when skipHydration: true)
await useStore.persist.rehydrate();

// Clear persisted storage
useStore.persist.clearStorage();

// Get/set storage options
useStore.persist.getOptions();
useStore.persist.setOptions(newOptions);
```

### Handling Hydration in Components (SSR / Next.js)

```typescript
function App() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Wait for zustand to rehydrate from storage
    const unsub = useStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })
    // Check if already hydrated
    if (useStore.persist.hasHydrated()) {
      setHydrated(true)
    }
    return unsub
  }, [])

  if (!hydrated) return <LoadingSkeleton />
  return <MainApp />
}
```

---

## 6. React Integration & Selectors

### Basic Hook Usage

```typescript
function Counter() {
  // Subscribe to entire store (re-renders on ANY change — avoid in production)
  const state = useCounterStore()

  // Selector: subscribe to specific field (re-renders only when count changes)
  const count = useCounterStore((state) => state.count)
  const increment = useCounterStore((state) => state.increment)

  return <button onClick={increment}>{count}</button>
}
```

### useShallow for Object/Array Selections

When selecting multiple values, returning a new object causes re-renders on every state change (new reference each time). `useShallow` solves this.

```typescript
import { useShallow } from "zustand/react/shallow";

function PromptEditor() {
  // BAD: Creates new object reference every render cycle
  const { systemPrompt, userTemplate } = useStore((state) => ({
    systemPrompt: state.systemPrompt,
    userTemplate: state.userTemplate,
  }));

  // GOOD: useShallow does shallow comparison on object keys
  const { systemPrompt, userTemplate } = useStore(
    useShallow((state) => ({
      systemPrompt: state.systemPrompt,
      userTemplate: state.userTemplate,
    })),
  );

  // ALSO GOOD: Array form works too
  const [systemPrompt, userTemplate] = useStore(
    useShallow((state) => [state.systemPrompt, state.userTemplate]),
  );
}
```

### Selector Best Practices

```typescript
// 1. Atomic selectors — one value per selector (best performance)
const count = useStore((s) => s.count);
const name = useStore((s) => s.name);

// 2. Computed/derived selectors
const completedCount = useStore(
  (s) => s.todos.filter((t) => t.completed).length,
);

// 3. Stable selectors defined outside component (avoids recreation)
const selectCount = (s: AppState) => s.count;
const selectName = (s: AppState) => s.name;

function MyComponent() {
  const count = useStore(selectCount);
  const name = useStore(selectName);
}

// 4. useShallow for multiple related values
const { a, b, c } = useStore(useShallow((s) => ({ a: s.a, b: s.b, c: s.c })));
```

### When to Use Each Pattern

| Pattern                          | When to Use                              |
| -------------------------------- | ---------------------------------------- |
| Single selector `(s) => s.field` | Default choice. One value needed.        |
| `useShallow` with object         | 2-5 related values from same store.      |
| `useShallow` with array          | Destructured positional values.          |
| Computed selector                | Derived values (filtered lists, counts). |
| External selector constant       | Hot path components rendered often.      |

---

## 7. Middleware Composition

### Nesting Order (Critical)

Middleware wraps from outside in. The correct order for textchisel:

```
outermost → innermost:
  devtools → persist → temporal → immer → store creator
```

**Rule of thumb:** Outer middleware observes everything inside it.

- `devtools` outermost so it can see all state changes
- `persist` next so it serializes the final state
- `temporal` tracks changes for undo/redo
- `immer` innermost so mutations are resolved before any middleware sees them

### Full Composition Example

```typescript
import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { temporal } from "zundo";

interface AppState {
  // Data (tracked by undo/redo + persisted)
  systemPrompt: string;
  userTemplate: string;
  temperature: number;

  // UI state (not tracked, not persisted)
  sidebarOpen: boolean;

  // Actions
  setSystemPrompt: (prompt: string) => void;
  setUserTemplate: (template: string) => void;
  setTemperature: (temp: number) => void;
  toggleSidebar: () => void;
}

const useAppStore = create<AppState>()(
  devtools(
    persist(
      temporal(
        immer((set) => ({
          // Data
          systemPrompt: "",
          userTemplate: "",
          temperature: 0.7,

          // UI
          sidebarOpen: true,

          // Actions
          setSystemPrompt: (prompt) =>
            set((state) => {
              state.systemPrompt = prompt;
            }),
          setUserTemplate: (template) =>
            set((state) => {
              state.userTemplate = template;
            }),
          setTemperature: (temp) =>
            set((state) => {
              state.temperature = temp;
            }),
          toggleSidebar: () =>
            set((state) => {
              state.sidebarOpen = !state.sidebarOpen;
            }),
        })),
        {
          // Temporal options — only track data, not UI
          partialize: (state) => ({
            systemPrompt: state.systemPrompt,
            userTemplate: state.userTemplate,
            temperature: state.temperature,
          }),
          limit: 50,
          handleSet: (handleSet) =>
            debounce<typeof handleSet>((state) => {
              handleSet(state);
            }, 500),
        },
      ),
      {
        // Persist options
        name: "textchisel-storage",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          systemPrompt: state.systemPrompt,
          userTemplate: state.userTemplate,
          temperature: state.temperature,
          sidebarOpen: state.sidebarOpen,
        }),
        version: 1,
      },
    ),
    { name: "TextChisel Store" }, // DevTools name
  ),
);
```

### TypeScript Mutators for Composed Middleware

When combining middleware, the `StateCreator` type needs all mutator annotations:

```typescript
import { StateCreator } from "zustand";

// Type for a slice in a store with devtools + persist + temporal + immer
type AppStateCreator<T> = StateCreator<
  AppState,
  [
    ["zustand/devtools", never],
    ["zustand/persist", unknown],
    // Note: zundo/temporal does not add a mutator type
    ["zustand/immer", never],
  ],
  [],
  T
>;
```

### Middleware Ordering Gotchas

| Issue                                 | Wrong                       | Right                                |
| ------------------------------------- | --------------------------- | ------------------------------------ |
| DevTools does not see persisted state | `persist(devtools(...))`    | `devtools(persist(...))`             |
| Immer mutations not resolved          | `immer(persist(...))`       | `persist(immer(...))`                |
| Undo tracks UI state                  | No `partialize` on temporal | Add `partialize` to temporal options |
| Rapid inputs flood history            | No debounce                 | Add `handleSet` with debounce        |

### Minimal Composition (No DevTools)

For production without devtools:

```typescript
const useAppStore = create<AppState>()(
  persist(
    temporal(
      immer((set) => ({
        // ... state and actions
      })),
      {
        partialize: (state) => ({
          /* tracked fields */
        }),
        limit: 50,
      },
    ),
    {
      name: "textchisel-storage",
      partialize: (state) => ({
        /* persisted fields */
      }),
    },
  ),
);
```

### Conditional DevTools (Dev Only)

```typescript
// Wrap conditionally
const withDevtools =
  process.env.NODE_ENV === "development" ? devtools : (fn: any) => fn;

const useAppStore = create<AppState>()(
  withDevtools(
    persist(
      temporal(
        immer((set) => ({
          /* ... */
        })),
        {
          /* temporal opts */
        },
      ),
      {
        /* persist opts */
      },
    ),
    { name: "TextChisel Store" },
  ),
);
```

---

## 8. Sources

### Official Documentation

- [Zustand GitHub Repository](https://github.com/pmndrs/zustand)
- [Zustand Persist Middleware Reference](https://zustand.docs.pmnd.rs/reference/middlewares/persist)
- [Zustand useShallow Reference](https://zustand.docs.pmnd.rs/reference/hooks/use-shallow)
- [Zustand Combine Middleware](https://zustand.docs.pmnd.rs/middlewares/combine)
- [Zundo GitHub Repository](https://github.com/charkour/zundo)
- [Zundo npm Package](https://www.npmjs.com/package/zundo)

### Deep Reference

- [Zustand TypeScript Integration (DeepWiki)](https://deepwiki.com/pmndrs/zustand/5-typescript-integration)
- [Zustand Slices Pattern (DeepWiki)](https://deepwiki.com/pmndrs/zustand/7.1-slices-pattern)
- [Zustand Immer Middleware (DeepWiki)](https://deepwiki.com/pmndrs/zustand/3.6-immer-middleware)
- [Zustand Persist Middleware (DeepWiki)](https://deepwiki.com/pmndrs/zustand/3.1-persist-middleware)
- [Zundo API Reference (DeepWiki)](https://deepwiki.com/charkour/zundo)

### Community Guides

- [Zustand Middleware Architecture (Medium)](https://beyondthecode.medium.com/zustand-middleware-the-architectural-core-of-scalable-state-management-d8d1053489ac)
- [Zustand + Immer (zwit.link)](https://zwit.link/posts/20250301173228-building-robust-react-apps-with-zustand-and-immer/)
- [Slice-Based Store for Next.js + TS (Atlys Engineering)](https://engineering.atlys.com/a-slice-based-zustand-store-for-next-js-14-and-typescript-6b92385a48f5)
- [TypeScript + Immer + Slice Discussion (#1796)](https://github.com/pmndrs/zustand/discussions/1796)
- [Slices with Immer Type Inference Discussion (#3056)](https://github.com/pmndrs/zustand/discussions/3056)
- [useShallow vs Selectors Discussion (#2541)](https://github.com/pmndrs/zustand/discussions/2541)
- [Middleware Composition with TypeScript (#994)](https://github.com/pmndrs/zustand/issues/994)
- [Zundo Partialize for Nested Objects (#170)](https://github.com/charkour/zundo/issues/170)

### Package Versions (as of research date)

- zustand: v5.0.10 (Jan 2026) — requires TypeScript 5+
- zundo: v2.3.0
- immer: built-in middleware in zustand (requires `immer` package installed)

---

## Quick Reference Card

```
IMPORTS
  import { create }                          from 'zustand'
  import { devtools, persist,
           createJSONStorage }               from 'zustand/middleware'
  import { immer }                           from 'zustand/middleware/immer'
  import { temporal }                        from 'zundo'
  import { useShallow }                      from 'zustand/react/shallow'
  import { useStore }                        from 'zustand'

STORE CREATION
  create<Type>()(middleware(stateCreator))

MIDDLEWARE ORDER (outside → inside)
  devtools → persist → temporal → immer → (set) => ({...})

UNDO/REDO ACCESS
  useStore.temporal.getState().undo()
  useStore.temporal.getState().redo()
  useStore.temporal.getState().clear()
  useStore.temporal.getState().pause()
  useStore.temporal.getState().resume()

PERSIST ACCESS
  useStore.persist.hasHydrated()
  useStore.persist.rehydrate()
  useStore.persist.clearStorage()

REACT HOOKS
  const val = useStore((s) => s.field)                    // atomic selector
  const { a, b } = useStore(useShallow((s) => ({...})))   // multi-value
```
