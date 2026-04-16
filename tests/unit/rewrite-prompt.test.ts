import { describe, it, expect } from "vitest";
import { buildRewritePrompt } from "@/rewriter/prompt";
import type { RewriteContext, Dimension, EvaluationScore } from "@shared/types";

function makeDim(overrides: Partial<Dimension> = {}): Dimension {
  return {
    id: "dim-1",
    sessionId: "s",
    name: "Clarity",
    description: "How clear the text is",
    weight: 1,
    rubric: { "1": "unclear", "3": "moderate", "5": "very clear" },
    locked: false,
    sortOrder: 0,
    evalPrompt: null,
    rewriteHint: null,
    examples: null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<RewriteContext> = {}): RewriteContext {
  return {
    intent: "Write a blog post about testing",
    currentText: "Some existing text here.",
    dimensions: [makeDim()],
    currentScores: { "dim-1": { score: 3, reasoning: "ok" } },
    targetScores: { "dim-1": 5 },
    lockedDimensionIds: new Set(),
    ...overrides,
  };
}

describe("buildRewritePrompt", () => {
  it("returns system and user strings", () => {
    const result = buildRewritePrompt(makeContext());
    expect(result.system).toBeTruthy();
    expect(result.user).toBeTruthy();
    expect(typeof result.system).toBe("string");
    expect(typeof result.user).toBe("string");
  });

  it("includes intent in user prompt", () => {
    const result = buildRewritePrompt(makeContext());
    expect(result.user).toContain("blog post about testing");
  });

  it("includes current text in user prompt", () => {
    const result = buildRewritePrompt(makeContext());
    expect(result.user).toContain("Some existing text here.");
  });

  it("includes dimension name and score delta", () => {
    const result = buildRewritePrompt(makeContext());
    expect(result.user).toContain("Clarity");
    expect(result.user).toContain("3→5");
  });

  it("marks locked dimensions with LOCKED", () => {
    const ctx = makeContext({
      lockedDimensionIds: new Set(["dim-1"]),
    });
    const result = buildRewritePrompt(ctx);
    expect(result.user).toContain("LOCKED");
  });

  it("handles empty dimensions array without crashing", () => {
    const ctx = makeContext({ dimensions: [] });
    const result = buildRewritePrompt(ctx);
    expect(result.system).toBeTruthy();
    expect(result.user).toBeTruthy();
  });

  it("uses initial generation path when no current text", () => {
    const ctx = makeContext({ currentText: "" });
    const result = buildRewritePrompt(ctx);
    expect(result.user).not.toContain("Current Text");
    expect(result.user).toContain("blog post about testing");
  });

  it("uses Tier 2 prompt when rewritePlan is provided", () => {
    const plan = {
      inferredIntent: "Make it clearer",
      instructions: "Use simpler words",
    };
    const result = buildRewritePrompt(makeContext(), plan);
    expect(result.system).toContain("transition planner");
    expect(result.user).toContain("Use simpler words");
    expect(result.user).toContain("Make it clearer");
  });

  it("falls back to template when rewritePlan given but no text", () => {
    const plan = {
      inferredIntent: "Make it clearer",
      instructions: "Use simpler words",
    };
    const ctx = makeContext({ currentText: "" });
    const result = buildRewritePrompt(ctx, plan);
    // Should NOT use Tier 2 when there's no text to rewrite
    expect(result.system).not.toContain("transition planner");
  });
});
