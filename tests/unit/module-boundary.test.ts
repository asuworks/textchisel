import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAppStore } from "@/store";
import type { SuggestedDimension } from "@shared/types";
import type { Dimension } from "@shared/types";

// --- Fixtures ---

function makeDimension(overrides: Partial<Dimension> = {}): Dimension {
  return {
    id: "dim-1",
    sessionId: "session-1",
    name: "Clarity",
    description: "How clear is the text",
    weight: 1.0,
    locked: false,
    rubric: { "1": "Unclear", "3": "Adequate", "5": "Crystal clear" },
    sortOrder: 0,
    evalPrompt: null,
    rewriteHint: null,
    examples: null,
    ...overrides,
  };
}

// --- Task 2.1: Store mediates dimension persistence ---

describe("Store dimension persistence actions", () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      sessionId: null,
      intent: "",
      dimensions: [],
      currentText: "",
      currentScores: {},
      streamingText: "",
      error: null,
      sessionStatus: "idle",
      targetScores: {},
      lockedDimensions: {},
    });
  });

  it("should expose createAndPersistDimensions action", () => {
    const state = useAppStore.getState();
    expect(typeof state.createAndPersistDimensions).toBe("function");
  });

  // Note: createAndPersistDimensions calls PGlite which requires WASM —
  // not available in jsdom. This is an integration test, not a unit test.
  it.skip("createAndPersistDimensions should set dimensions in store", async () => {});

  it("updateDimension should update store state", () => {
    // Seed store with a dimension
    const dim = makeDimension();
    useAppStore.setState({ dimensions: [dim] });

    // Update via store action
    useAppStore.getState().updateDimension("dim-1", { name: "Updated Clarity" });

    const updated = useAppStore.getState().dimensions.find((d) => d.id === "dim-1");
    expect(updated?.name).toBe("Updated Clarity");
  });
});

// --- Task 2.2: SuggestedDimension exported from shared/types ---

describe("SuggestedDimension type location", () => {
  it("should be importable from @shared/types", () => {
    // This test validates that the type exists in shared/types.
    // If SuggestedDimension is not exported from @shared/types, this file won't compile.
    const dim: SuggestedDimension = {
      name: "Test",
      description: "A test dimension",
      rubric: { "1": "Low", "5": "High" },
    };
    expect(dim.name).toBe("Test");
    expect(dim.description).toBe("A test dimension");
    expect(dim.rubric).toEqual({ "1": "Low", "5": "High" });
  });
});

// --- Task 2.1: No shell imports from dimensions/crud ---

describe("Module boundary invariant", () => {
  it("shell files should not import from @/dimensions/crud", async () => {
    // Read shell files and check for forbidden imports
    const fs = await import("fs");
    const path = await import("path");
    const shellDir = path.resolve(__dirname, "../../src/shell");
    const files = fs.readdirSync(shellDir).filter((f: string) => f.endsWith(".ts") || f.endsWith(".tsx"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(shellDir, file), "utf-8");
      expect(content).not.toContain("@/dimensions/crud");
    }
  });
});
