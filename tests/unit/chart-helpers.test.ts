import { describe, it, expect } from "vitest";
import { maxRubricLevel, clampScore, isLocked } from "@/chart/helpers";
import type { Dimension } from "@shared/types";

function dim(rubric: Record<string, string> | null): Dimension {
  return {
    id: "d",
    sessionId: "s",
    name: "test",
    description: "",
    weight: 1,
    rubric: rubric ?? {},
    locked: false,
    sortOrder: 0,
    evalPrompt: null,
    rewriteHint: null,
    examples: null,
  };
}

describe("maxRubricLevel", () => {
  it("returns 5 for empty array", () => {
    expect(maxRubricLevel([])).toBe(5);
  });

  it("returns 5 for standard 5-level rubrics", () => {
    const d = dim({ "1": "low", "2": "below avg", "3": "avg", "4": "above avg", "5": "high" });
    expect(maxRubricLevel([d])).toBe(5);
  });

  it("returns max across mixed-level dimensions", () => {
    const d3 = dim({ "1": "a", "2": "b", "3": "c" });
    const d7 = dim({ "1": "a", "3": "b", "5": "c", "7": "d" });
    expect(maxRubricLevel([d3, d7])).toBe(7);
  });

  it("handles empty rubric object", () => {
    expect(maxRubricLevel([dim({})])).toBe(5);
  });
});

describe("clampScore", () => {
  it("passes through in-range values", () => {
    expect(clampScore(3)).toBe(3);
    expect(clampScore(1)).toBe(1);
    expect(clampScore(5)).toBe(5);
  });

  it("clamps below 1", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(-3)).toBe(1);
  });

  it("clamps above max", () => {
    expect(clampScore(6)).toBe(5);
    expect(clampScore(10, 7)).toBe(7);
  });

  it("rounds fractional values", () => {
    expect(clampScore(2.3)).toBe(2);
    expect(clampScore(2.7)).toBe(3);
  });

  it("uses custom max", () => {
    expect(clampScore(3, 3)).toBe(3);
    expect(clampScore(4, 3)).toBe(3);
  });
});

describe("isLocked", () => {
  it("returns true for locked dimension", () => {
    expect(isLocked({ a: true }, "a")).toBe(true);
  });

  it("returns false for unlocked dimension", () => {
    expect(isLocked({ a: false }, "a")).toBe(false);
  });

  it("returns false for missing dimension", () => {
    expect(isLocked({}, "a")).toBe(false);
  });
});
