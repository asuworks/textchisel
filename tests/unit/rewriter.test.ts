import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LanguageModel } from "ai";
import type { Dimension, EvaluationScore } from "@shared/types";
import type { RewriteContext } from "@/rewriter/prompt";
import { buildRewritePrompt } from "@/rewriter/prompt";

// --- Test fixtures ---

function makeDimension(overrides: Partial<Dimension> = {}): Dimension {
  return {
    id: "dim-1",
    sessionId: "session-1",
    name: "Clarity",
    description: "How clearly the ideas are communicated",
    weight: 1.0,
    rubric: {
      "1": "Incomprehensible",
      "2": "Confusing",
      "3": "Understandable",
      "4": "Clear",
      "5": "Crystal clear",
    },
    locked: false,
    sortOrder: 0,
    ...overrides,
  };
}

function makeContext(overrides: Partial<RewriteContext> = {}): RewriteContext {
  const dim1 = makeDimension();
  const dim2 = makeDimension({
    id: "dim-2",
    name: "Persuasiveness",
    description: "How effectively the text persuades",
    rubric: {
      "1": "Not persuasive",
      "2": "Weak",
      "3": "Somewhat persuasive",
      "4": "Compelling",
      "5": "Irresistible",
    },
    sortOrder: 1,
  });

  return {
    intent: "Write a persuasive essay about climate change",
    currentText: "Climate change is a problem. We should fix it.",
    dimensions: [dim1, dim2],
    currentScores: {
      "dim-1": { score: 3, reasoning: "Understandable but vague" },
      "dim-2": { score: 2, reasoning: "Lacks supporting evidence" },
    },
    targetScores: { "dim-1": 5, "dim-2": 4 },
    lockedDimensionIds: new Set(),
    ...overrides,
  };
}

// --- buildRewritePrompt tests ---

describe("buildRewritePrompt", () => {
  it("should include role as writing refinement engine in system prompt", () => {
    const { system } = buildRewritePrompt(makeContext());

    expect(system).toMatch(/writing refinement engine/i);
  });

  it("should include the user intent in user prompt", () => {
    const { user } = buildRewritePrompt(makeContext());

    expect(user).toContain("Write a persuasive essay about climate change");
  });

  it("should include the current text in user prompt", () => {
    const { user } = buildRewritePrompt(makeContext());

    expect(user).toContain("Climate change is a problem. We should fix it.");
  });

  it("should include dimension names and descriptions", () => {
    const { user } = buildRewritePrompt(makeContext());

    expect(user).toContain("Clarity");
    expect(user).toContain("How clearly the ideas are communicated");
    expect(user).toContain("Persuasiveness");
    expect(user).toContain("How effectively the text persuades");
  });

  it("should include current→target score deltas", () => {
    const { user } = buildRewritePrompt(makeContext());

    expect(user).toContain("3→5");
    expect(user).toContain("+2");
    expect(user).toContain("2→4");
  });

  it("should include rubric descriptions for target levels", () => {
    const { user } = buildRewritePrompt(makeContext());

    expect(user).toContain("Crystal clear"); // rubric level 5 for Clarity
    expect(user).toContain("Compelling"); // rubric level 4 for Persuasiveness
  });

  it("should mark locked dimensions", () => {
    const context = makeContext({ lockedDimensionIds: new Set(["dim-1"]) });
    const { user } = buildRewritePrompt(context);

    expect(user).toMatch(/LOCKED/i);
  });

  it("should handle zero delta dimensions", () => {
    const context = makeContext({
      targetScores: { "dim-1": 3, "dim-2": 2 },
    });
    const { user } = buildRewritePrompt(context);

    expect(user).toContain("3→3");
    expect(user).toContain("+0");
  });

  it("should handle empty dimensions array", () => {
    const context = makeContext({ dimensions: [] });
    const { system, user } = buildRewritePrompt(context);

    expect(system).toBeTruthy();
    expect(user).toContain("Climate change");
  });

  it("should handle dimensions without rubric", () => {
    const dim = makeDimension({ rubric: null });
    const context = makeContext({ dimensions: [dim] });
    const { user } = buildRewritePrompt(context);

    expect(user).toContain("Clarity");
    expect(user).not.toContain("Target level:");
  });

  it("should include current assessment reasoning", () => {
    const { user } = buildRewritePrompt(makeContext());

    expect(user).toContain("Understandable but vague");
    expect(user).toContain("Lacks supporting evidence");
  });

  it("should render negative deltas correctly", () => {
    const context = makeContext({
      targetScores: { "dim-1": 2, "dim-2": 1 },
    });
    const { user } = buildRewritePrompt(context);

    expect(user).toContain("3→2");
    expect(user).toContain("-1");
    expect(user).toContain("2→1");
  });

  it("should force target = current for locked dimensions", () => {
    const context = makeContext({
      lockedDimensionIds: new Set(["dim-1"]),
      targetScores: { "dim-1": 5, "dim-2": 4 },
    });
    const { user } = buildRewritePrompt(context);

    // dim-1 is locked at current=3, so target should be forced to 3
    expect(user).toContain("3→3");
    expect(user).toMatch(/\+0.*LOCKED/s);
  });
});

// --- rewriteText / rewriteTextFull tests ---

describe("rewriteText", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call streamText with system and user prompts from buildRewritePrompt", async () => {
    const mockStreamText = vi.fn().mockReturnValue({
      text: Promise.resolve("Rewritten text here"),
      textStream: (async function* () {
        yield "Rewritten text here";
      })(),
    });

    vi.doMock("ai", () => ({
      streamText: mockStreamText,
    }));

    const { rewriteText } = await import("@/rewriter/stream");
    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;

    rewriteText({ ...makeContext(), model: fakeModel });

    expect(mockStreamText).toHaveBeenCalledOnce();
    const callArgs = mockStreamText.mock.calls[0][0];

    expect(callArgs.model).toBe(fakeModel);
    expect(callArgs.system).toMatch(/writing refinement engine/i);
    expect(callArgs.prompt).toContain("Climate change");
    expect(callArgs.temperature).toBe(0.7);
  });

  it("should pass model through to streamText", async () => {
    const mockStreamText = vi.fn().mockReturnValue({
      text: Promise.resolve("output"),
    });

    vi.doMock("ai", () => ({
      streamText: mockStreamText,
    }));

    const { rewriteText } = await import("@/rewriter/stream");
    const fakeModel = {
      modelId: "custom-model",
    } as unknown as LanguageModel;

    rewriteText({ ...makeContext(), model: fakeModel });

    expect(mockStreamText.mock.calls[0][0].model).toBe(fakeModel);
  });
});

describe("rewriteTextFull", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the full rewritten text string", async () => {
    const mockStreamText = vi.fn().mockReturnValue({
      text: Promise.resolve(
        "Climate change represents the defining crisis of our era.",
      ),
    });

    vi.doMock("ai", () => ({
      streamText: mockStreamText,
    }));

    const { rewriteTextFull } = await import("@/rewriter/stream");
    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;

    const result = await rewriteTextFull({
      ...makeContext(),
      model: fakeModel,
    });

    expect(result).toBe(
      "Climate change represents the defining crisis of our era.",
    );
  });

  it("should propagate errors from streamText", async () => {
    const mockStreamText = vi.fn().mockImplementation(() => ({
      get text() {
        return Promise.reject(new Error("model unavailable"));
      },
    }));

    vi.doMock("ai", () => ({
      streamText: mockStreamText,
    }));

    const { rewriteTextFull } = await import("@/rewriter/stream");
    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;

    await expect(
      rewriteTextFull({ ...makeContext(), model: fakeModel }),
    ).rejects.toThrow("model unavailable");
  });
});
