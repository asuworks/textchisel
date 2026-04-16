import { describe, it, expect } from "vitest";
import {
  normalizeScore,
  computeWeightedAverage,
  scoreDelta,
} from "@/evaluation/normalize";
import type { Dimension, EvaluationScore } from "@shared/types";

describe("normalizeScore", () => {
  it("passes through in-range integers", () => {
    expect(normalizeScore(1)).toBe(1);
    expect(normalizeScore(3)).toBe(3);
    expect(normalizeScore(5)).toBe(5);
  });

  it("clamps below 1", () => {
    expect(normalizeScore(0)).toBe(1);
    expect(normalizeScore(-5)).toBe(1);
  });

  it("clamps above 5", () => {
    expect(normalizeScore(6)).toBe(5);
    expect(normalizeScore(100)).toBe(5);
  });

  it("rounds fractional values", () => {
    expect(normalizeScore(2.4)).toBe(2);
    expect(normalizeScore(2.5)).toBe(3);
    expect(normalizeScore(2.7)).toBe(3);
  });

  it("handles extreme fractional values", () => {
    expect(normalizeScore(0.1)).toBe(1);
    expect(normalizeScore(5.9)).toBe(5);
  });

  it("clamps to custom max", () => {
    expect(normalizeScore(8, 7)).toBe(7);
    expect(normalizeScore(4, 3)).toBe(3);
  });

  it("allows scores up to custom max", () => {
    expect(normalizeScore(7, 7)).toBe(7);
    expect(normalizeScore(6, 7)).toBe(6);
  });

  it("still clamps below 1 with custom max", () => {
    expect(normalizeScore(0, 7)).toBe(1);
    expect(normalizeScore(-3, 3)).toBe(1);
  });
});

describe("computeWeightedAverage", () => {
  function dim(id: string, weight: number): Dimension {
    return {
      id,
      sessionId: "s",
      name: id,
      description: "",
      weight,
      rubric: {},
      locked: false,
      sortOrder: 0,
      evalPrompt: null,
      rewriteHint: null,
      examples: null,
    };
  }

  function score(s: number): EvaluationScore {
    return { score: s, reasoning: "" };
  }

  it("returns score for single dimension with weight 1", () => {
    const scores = new Map([["a", score(4)]]);
    expect(computeWeightedAverage(scores, [dim("a", 1)])).toBe(4);
  });

  it("averages equal weights", () => {
    const scores = new Map([
      ["a", score(2)],
      ["b", score(4)],
    ]);
    expect(computeWeightedAverage(scores, [dim("a", 1), dim("b", 1)])).toBe(3);
  });

  it("computes weighted average with different weights", () => {
    const scores = new Map([
      ["a", score(2)],
      ["b", score(4)],
    ]);
    // (2*1 + 4*3) / (1+3) = 14/4 = 3.5
    expect(computeWeightedAverage(scores, [dim("a", 1), dim("b", 3)])).toBe(
      3.5,
    );
  });

  it("skips dimensions with no matching score", () => {
    const scores = new Map([["a", score(4)]]);
    expect(
      computeWeightedAverage(scores, [dim("a", 1), dim("b", 1)]),
    ).toBe(4);
  });

  it("returns 0 for empty dimensions", () => {
    expect(computeWeightedAverage(new Map(), [])).toBe(0);
  });

  it("returns 0 when no scores match", () => {
    const scores = new Map([["x", score(3)]]);
    expect(computeWeightedAverage(scores, [dim("a", 1)])).toBe(0);
  });
});

describe("scoreDelta", () => {
  it("computes simple delta", () => {
    const current = new Map([["a", 3]]);
    const target = { a: 5 };
    expect(scoreDelta(current, target)).toEqual({ a: 2 });
  });

  it("computes negative delta", () => {
    const current = new Map([["a", 5]]);
    const target = { a: 2 };
    expect(scoreDelta(current, target)).toEqual({ a: -3 });
  });

  it("skips dimensions not in current", () => {
    const current = new Map([["a", 3]]);
    const target = { a: 5, b: 4 };
    expect(scoreDelta(current, target)).toEqual({ a: 2 });
  });

  it("handles multiple dimensions", () => {
    const current = new Map([
      ["a", 2],
      ["b", 4],
    ]);
    const target = { a: 5, b: 3 };
    expect(scoreDelta(current, target)).toEqual({ a: 3, b: -1 });
  });

  it("returns empty for empty inputs", () => {
    expect(scoreDelta(new Map(), {})).toEqual({});
  });
});
