import { describe, it, expect } from "vitest";
import {
  checkConvergence,
  checkLockFidelity,
} from "@/orchestrator/convergence";
import type { EvaluationScore } from "@shared/types";

function score(s: number, reasoning = ""): EvaluationScore {
  return { score: s, reasoning };
}

describe("checkConvergence", () => {
  it("returns converged when all scores match targets exactly", () => {
    const result = checkConvergence(
      { a: score(3), b: score(5) },
      { a: 3, b: 5 },
    );
    expect(result.converged).toBe(true);
    expect(result.maxDelta).toBe(0);
  });

  it("returns not converged when a score is off", () => {
    const result = checkConvergence(
      { a: score(3), b: score(4) },
      { a: 3, b: 5 },
    );
    expect(result.converged).toBe(false);
    expect(result.maxDelta).toBe(1);
    expect(result.deltas.b).toBe(1);
  });

  it("converges within tolerance", () => {
    const result = checkConvergence(
      { a: score(4) },
      { a: 5 },
      1,
    );
    expect(result.converged).toBe(true);
    expect(result.maxDelta).toBe(1);
  });

  it("does not converge when delta exceeds tolerance", () => {
    const result = checkConvergence(
      { a: score(2) },
      { a: 5 },
      2,
    );
    expect(result.converged).toBe(false);
    expect(result.maxDelta).toBe(3);
  });

  it("returns converged (vacuous) for empty targets", () => {
    const result = checkConvergence({ a: score(3) }, {});
    expect(result.converged).toBe(true);
    expect(result.maxDelta).toBe(0);
  });

  it("skips dimensions in targets that have no current score", () => {
    const result = checkConvergence(
      { a: score(3) },
      { a: 3, b: 5 },
    );
    expect(result.converged).toBe(true);
    expect(result.deltas.b).toBeUndefined();
  });

  it("reports maxDelta across multiple dimensions", () => {
    const result = checkConvergence(
      { a: score(1), b: score(3), c: score(5) },
      { a: 3, b: 5, c: 5 },
    );
    expect(result.maxDelta).toBe(2);
    expect(result.deltas.a).toBe(2);
    expect(result.deltas.b).toBe(2);
    expect(result.deltas.c).toBe(0);
  });
});

describe("checkLockFidelity", () => {
  it("returns empty when no dimensions are locked", () => {
    const result = checkLockFidelity(
      { a: score(3) },
      { a: score(4) },
      new Set(),
    );
    expect(result).toEqual([]);
  });

  it("returns empty when locked dimension is unchanged", () => {
    const result = checkLockFidelity(
      { a: score(3) },
      { a: score(3) },
      new Set(["a"]),
    );
    expect(result).toEqual([]);
  });

  it("reports deviation when locked dimension drifts", () => {
    const result = checkLockFidelity(
      { a: score(3) },
      { a: score(5) },
      new Set(["a"]),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      dimensionId: "a",
      expected: 3,
      actual: 5,
      deviation: 2,
    });
  });

  it("respects tolerance for locked dimensions", () => {
    const result = checkLockFidelity(
      { a: score(3) },
      { a: score(4) },
      new Set(["a"]),
      1,
    );
    expect(result).toEqual([]);
  });

  it("only reports locked dims that drifted, not all locked dims", () => {
    const result = checkLockFidelity(
      { a: score(3), b: score(4) },
      { a: score(3), b: score(2) },
      new Set(["a", "b"]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].dimensionId).toBe("b");
  });
});
