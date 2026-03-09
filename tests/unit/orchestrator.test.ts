import { describe, it, expect, vi } from "vitest";
import type { LanguageModel } from "ai";
import type { Dimension, EvaluationScore } from "@shared/types";
import {
  checkConvergence,
  checkLockFidelity,
  runOrchestrationLoop,
} from "@/orchestrator";
import type { OrchestratorDeps } from "@/orchestrator";

// --- Test fixtures ---

function makeDimension(overrides: Partial<Dimension> = {}): Dimension {
  return {
    id: "dim-1",
    sessionId: "session-1",
    name: "Clarity",
    description: "How clearly the ideas are communicated",
    weight: 1.0,
    rubric: { "1": "Unclear", "3": "OK", "5": "Crystal clear" },
    locked: false,
    sortOrder: 0,
    ...overrides,
  };
}

function makeScore(score: number, reasoning = "test"): EvaluationScore {
  return { score, reasoning };
}

const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;

// --- checkConvergence ---

describe("checkConvergence", () => {
  it("should report converged when all scores match targets exactly", () => {
    const scores = { "dim-1": makeScore(5), "dim-2": makeScore(3) };
    const targets = { "dim-1": 5, "dim-2": 3 };

    const result = checkConvergence(scores, targets);

    expect(result.converged).toBe(true);
    expect(result.maxDelta).toBe(0);
    expect(result.deltas).toEqual({ "dim-1": 0, "dim-2": 0 });
  });

  it("should report not converged when a score misses the target", () => {
    const scores = { "dim-1": makeScore(3), "dim-2": makeScore(3) };
    const targets = { "dim-1": 5, "dim-2": 3 };

    const result = checkConvergence(scores, targets);

    expect(result.converged).toBe(false);
    expect(result.maxDelta).toBe(2);
    expect(result.deltas["dim-1"]).toBe(2);
  });

  it("should report converged when all deltas are within tolerance", () => {
    const scores = { "dim-1": makeScore(4) };
    const targets = { "dim-1": 5 };

    const result = checkConvergence(scores, targets, 1);

    expect(result.converged).toBe(true);
    expect(result.maxDelta).toBe(1);
  });

  it("should report not converged when any delta exceeds tolerance", () => {
    const scores = { "dim-1": makeScore(3), "dim-2": makeScore(4) };
    const targets = { "dim-1": 5, "dim-2": 5 };

    const result = checkConvergence(scores, targets, 1);

    expect(result.converged).toBe(false);
    expect(result.maxDelta).toBe(2);
  });

  it("should report converged when targets are empty", () => {
    const scores = { "dim-1": makeScore(3) };

    const result = checkConvergence(scores, {});

    expect(result.converged).toBe(true);
    expect(result.maxDelta).toBe(0);
  });

  it("should skip dimensions not present in current scores", () => {
    const scores = { "dim-1": makeScore(5) };
    const targets = { "dim-1": 5, "dim-2": 3 };

    const result = checkConvergence(scores, targets);

    expect(result.converged).toBe(true);
    expect(result.deltas).toEqual({ "dim-1": 0 });
    expect(result.deltas["dim-2"]).toBeUndefined();
  });

  it("should use absolute delta for undershooting", () => {
    const scores = { "dim-1": makeScore(5) };
    const targets = { "dim-1": 2 };

    const result = checkConvergence(scores, targets);

    expect(result.maxDelta).toBe(3);
    expect(result.deltas["dim-1"]).toBe(3);
  });
});

// --- checkLockFidelity ---

describe("checkLockFidelity", () => {
  it("should return empty array when no dimensions are locked", () => {
    const prev = { "dim-1": makeScore(3) };
    const curr = { "dim-1": makeScore(5) };

    const result = checkLockFidelity(prev, curr, new Set());

    expect(result).toEqual([]);
  });

  it("should return empty array when locked dimension score is unchanged", () => {
    const prev = { "dim-1": makeScore(3) };
    const curr = { "dim-1": makeScore(3) };

    const result = checkLockFidelity(prev, curr, new Set(["dim-1"]));

    expect(result).toEqual([]);
  });

  it("should detect deviation when locked dimension score changes", () => {
    const prev = { "dim-1": makeScore(3) };
    const curr = { "dim-1": makeScore(5) };

    const result = checkLockFidelity(prev, curr, new Set(["dim-1"]));

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      dimensionId: "dim-1",
      expected: 3,
      actual: 5,
      deviation: 2,
    });
  });

  it("should allow deviation within tolerance", () => {
    const prev = { "dim-1": makeScore(3) };
    const curr = { "dim-1": makeScore(4) };

    const result = checkLockFidelity(prev, curr, new Set(["dim-1"]), 1);

    expect(result).toEqual([]);
  });

  it("should detect deviation exceeding tolerance", () => {
    const prev = { "dim-1": makeScore(3) };
    const curr = { "dim-1": makeScore(5) };

    const result = checkLockFidelity(prev, curr, new Set(["dim-1"]), 1);

    expect(result).toHaveLength(1);
    expect(result[0].deviation).toBe(2);
  });

  it("should only check locked dimensions, not unlocked ones", () => {
    const prev = {
      "dim-1": makeScore(3),
      "dim-2": makeScore(2),
    };
    const curr = {
      "dim-1": makeScore(3),
      "dim-2": makeScore(5),
    };

    const result = checkLockFidelity(prev, curr, new Set(["dim-1"]));

    expect(result).toEqual([]);
  });

  it("should skip locked dimensions missing from scores", () => {
    const prev = { "dim-1": makeScore(3) };
    const curr = { "dim-1": makeScore(3) };

    const result = checkLockFidelity(
      prev,
      curr,
      new Set(["dim-1", "dim-missing"]),
    );

    expect(result).toEqual([]);
  });

  it("should detect multiple deviations across locked dimensions", () => {
    const prev = {
      "dim-1": makeScore(3),
      "dim-2": makeScore(4),
    };
    const curr = {
      "dim-1": makeScore(1),
      "dim-2": makeScore(2),
    };

    const result = checkLockFidelity(prev, curr, new Set(["dim-1", "dim-2"]));

    expect(result).toHaveLength(2);
  });
});

// --- runOrchestrationLoop ---

describe("runOrchestrationLoop", () => {
  function makeDeps(
    overrides: Partial<OrchestratorDeps> = {},
  ): OrchestratorDeps {
    return {
      scoreAll: vi.fn().mockResolvedValue(new Map()),
      rewrite: vi.fn().mockResolvedValue("rewritten text"),
      ...overrides,
    };
  }

  const dims = [
    makeDimension({ id: "dim-1", name: "Clarity", sortOrder: 0 }),
    makeDimension({ id: "dim-2", name: "Tone", sortOrder: 1 }),
  ];

  it("should return immediately when already converged", async () => {
    const deps = makeDeps();
    const currentScores = { "dim-1": makeScore(5), "dim-2": makeScore(3) };
    const targetScores = { "dim-1": 5, "dim-2": 3 };

    const result = await runOrchestrationLoop({
      model: fakeModel,
      intent: "test intent",
      currentText: "original text",
      dimensions: dims,
      currentScores,
      targetScores,
      lockedDimensionIds: new Set(),
      deps,
    });

    expect(result.converged).toBe(true);
    expect(result.totalIterations).toBe(0);
    expect(result.steps).toEqual([]);
    expect(result.finalText).toBe("original text");
    expect(result.finalScores).toEqual(currentScores);
    expect(deps.rewrite).not.toHaveBeenCalled();
    expect(deps.scoreAll).not.toHaveBeenCalled();
  });

  it("should converge after one iteration when scores hit targets", async () => {
    const scoreAll = vi.fn().mockResolvedValue(
      new Map([
        ["dim-1", makeScore(5)],
        ["dim-2", makeScore(4)],
      ]),
    );
    const rewrite = vi.fn().mockResolvedValue("improved text");
    const deps = makeDeps({ scoreAll, rewrite });

    const result = await runOrchestrationLoop({
      model: fakeModel,
      intent: "test intent",
      currentText: "original text",
      dimensions: dims,
      currentScores: { "dim-1": makeScore(3), "dim-2": makeScore(2) },
      targetScores: { "dim-1": 5, "dim-2": 4 },
      lockedDimensionIds: new Set(),
      deps,
    });

    expect(result.converged).toBe(true);
    expect(result.totalIterations).toBe(1);
    expect(result.finalText).toBe("improved text");
    expect(result.finalScores["dim-1"].score).toBe(5);
    expect(result.finalScores["dim-2"].score).toBe(4);
    expect(rewrite).toHaveBeenCalledOnce();
    expect(scoreAll).toHaveBeenCalledOnce();
  });

  it("should run up to maxIterations when not converging", async () => {
    const scoreAll = vi.fn().mockResolvedValue(
      new Map([
        ["dim-1", makeScore(3)],
        ["dim-2", makeScore(2)],
      ]),
    );
    const deps = makeDeps({ scoreAll });

    const result = await runOrchestrationLoop({
      model: fakeModel,
      intent: "test",
      currentText: "original",
      dimensions: dims,
      currentScores: { "dim-1": makeScore(2), "dim-2": makeScore(1) },
      targetScores: { "dim-1": 5, "dim-2": 5 },
      lockedDimensionIds: new Set(),
      deps,
      maxIterations: 3,
    });

    expect(result.converged).toBe(false);
    expect(result.totalIterations).toBe(3);
    expect(result.steps).toHaveLength(3);
    expect(deps.rewrite).toHaveBeenCalledTimes(3);
    expect(deps.scoreAll).toHaveBeenCalledTimes(3);
  });

  it("should default maxIterations to 3", async () => {
    const scoreAll = vi
      .fn()
      .mockResolvedValue(new Map([["dim-1", makeScore(1)]]));
    const deps = makeDeps({ scoreAll });

    const result = await runOrchestrationLoop({
      model: fakeModel,
      intent: "test",
      currentText: "text",
      dimensions: [dims[0]],
      currentScores: { "dim-1": makeScore(1) },
      targetScores: { "dim-1": 5 },
      lockedDimensionIds: new Set(),
      deps,
    });

    expect(result.totalIterations).toBe(3);
  });

  it("should pass correct RewriteContext to rewrite function", async () => {
    const scoreAll = vi
      .fn()
      .mockResolvedValue(new Map([["dim-1", makeScore(5)]]));
    const rewrite = vi.fn().mockResolvedValue("new text");
    const deps = makeDeps({ scoreAll, rewrite });
    const currentScores = { "dim-1": makeScore(2, "needs work") };
    const locked = new Set(["dim-2"]);

    await runOrchestrationLoop({
      model: fakeModel,
      intent: "write better",
      currentText: "draft text",
      dimensions: [dims[0]],
      currentScores,
      targetScores: { "dim-1": 5 },
      lockedDimensionIds: locked,
      deps,
    });

    expect(rewrite).toHaveBeenCalledWith({
      model: fakeModel,
      intent: "write better",
      currentText: "draft text",
      dimensions: [dims[0]],
      currentScores,
      targetScores: { "dim-1": 5 },
      lockedDimensionIds: locked,
    });
  });

  it("should report lock deviations in steps", async () => {
    const scoreAll = vi.fn().mockResolvedValue(
      new Map([
        ["dim-1", makeScore(5)],
        ["dim-2", makeScore(1)],
      ]),
    );
    const deps = makeDeps({ scoreAll });

    const result = await runOrchestrationLoop({
      model: fakeModel,
      intent: "test",
      currentText: "text",
      dimensions: dims,
      currentScores: { "dim-1": makeScore(3), "dim-2": makeScore(4) },
      targetScores: { "dim-1": 5, "dim-2": 4 },
      lockedDimensionIds: new Set(["dim-2"]),
      deps,
      maxIterations: 1,
    });

    expect(result.steps[0].lockDeviations).toHaveLength(1);
    expect(result.steps[0].lockDeviations[0]).toEqual({
      dimensionId: "dim-2",
      expected: 4,
      actual: 1,
      deviation: 3,
    });
  });

  it("should use updated text and scores from previous iteration", async () => {
    let callCount = 0;
    const scoreAll = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Map([["dim-1", makeScore(3, "iteration 1")]]),
        );
      }
      return Promise.resolve(new Map([["dim-1", makeScore(5, "iteration 2")]]));
    });

    const rewrite = vi.fn().mockImplementation((opts) => {
      return Promise.resolve(`rewrite of: ${opts.currentText}`);
    });

    const deps = makeDeps({ scoreAll, rewrite });

    const result = await runOrchestrationLoop({
      model: fakeModel,
      intent: "test",
      currentText: "original",
      dimensions: [dims[0]],
      currentScores: { "dim-1": makeScore(1) },
      targetScores: { "dim-1": 5 },
      lockedDimensionIds: new Set(),
      deps,
      maxIterations: 2,
    });

    // First rewrite uses original text
    expect(rewrite.mock.calls[0][0].currentText).toBe("original");
    // Second rewrite uses output from first iteration
    expect(rewrite.mock.calls[1][0].currentText).toBe("rewrite of: original");
    // Second rewrite uses scores from first iteration
    expect(rewrite.mock.calls[1][0].currentScores["dim-1"].reasoning).toBe(
      "iteration 1",
    );

    expect(result.converged).toBe(true);
    expect(result.totalIterations).toBe(2);
    expect(result.finalText).toBe("rewrite of: rewrite of: original");
  });

  it("should stop early on convergence before maxIterations", async () => {
    let callCount = 0;
    const scoreAll = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.resolve(new Map([["dim-1", makeScore(5)]]));
      }
      return Promise.resolve(new Map([["dim-1", makeScore(3)]]));
    });
    const deps = makeDeps({ scoreAll });

    const result = await runOrchestrationLoop({
      model: fakeModel,
      intent: "test",
      currentText: "text",
      dimensions: [dims[0]],
      currentScores: { "dim-1": makeScore(1) },
      targetScores: { "dim-1": 5 },
      lockedDimensionIds: new Set(),
      deps,
      maxIterations: 5,
    });

    expect(result.converged).toBe(true);
    expect(result.totalIterations).toBe(2);
  });

  it("should converge with tolerance when scores are close enough", async () => {
    const scoreAll = vi
      .fn()
      .mockResolvedValue(new Map([["dim-1", makeScore(4)]]));
    const deps = makeDeps({ scoreAll });

    const result = await runOrchestrationLoop({
      model: fakeModel,
      intent: "test",
      currentText: "text",
      dimensions: [dims[0]],
      currentScores: { "dim-1": makeScore(2) },
      targetScores: { "dim-1": 5 },
      lockedDimensionIds: new Set(),
      deps,
      convergenceTolerance: 1,
    });

    expect(result.converged).toBe(true);
    expect(result.totalIterations).toBe(1);
  });

  it("should record convergence details in each step", async () => {
    const scoreAll = vi.fn().mockResolvedValue(
      new Map([
        ["dim-1", makeScore(4)],
        ["dim-2", makeScore(2)],
      ]),
    );
    const deps = makeDeps({ scoreAll });

    const result = await runOrchestrationLoop({
      model: fakeModel,
      intent: "test",
      currentText: "text",
      dimensions: dims,
      currentScores: { "dim-1": makeScore(1), "dim-2": makeScore(1) },
      targetScores: { "dim-1": 5, "dim-2": 5 },
      lockedDimensionIds: new Set(),
      deps,
      maxIterations: 1,
    });

    const step = result.steps[0];
    expect(step.iteration).toBe(1);
    expect(step.convergence.converged).toBe(false);
    expect(step.convergence.maxDelta).toBe(3);
    expect(step.convergence.deltas).toEqual({ "dim-1": 1, "dim-2": 3 });
  });
});
