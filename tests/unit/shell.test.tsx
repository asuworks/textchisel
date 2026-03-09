import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntentPanel } from "@/shell/IntentPanel";
import { TextPanel } from "@/shell/TextPanel";
import { ControlBar } from "@/shell/ControlBar";
import { DimensionList } from "@/shell/DimensionList";
import { useAppStore } from "@/store";
import type { Dimension, EvaluationScore } from "@shared/types";

// --- Test fixtures ---

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
    ...overrides,
  };
}

const SCORE: EvaluationScore = { score: 4, reasoning: "Good clarity" };

// --- IntentPanel ---

describe("IntentPanel", () => {
  it("should render textarea and generate button", () => {
    render(
      <IntentPanel
        intent=""
        onIntentChange={vi.fn()}
        onGenerate={vi.fn()}
        isGenerating={false}
        hasDimensions={false}
      />,
    );
    expect(
      screen.getByPlaceholderText(/describe the text/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate/i }),
    ).toBeInTheDocument();
  });

  it("should disable generate button when intent is empty", () => {
    render(
      <IntentPanel
        intent=""
        onIntentChange={vi.fn()}
        onGenerate={vi.fn()}
        isGenerating={false}
        hasDimensions={false}
      />,
    );
    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
  });

  it("should enable generate button when intent has text", () => {
    render(
      <IntentPanel
        intent="Write a professional email"
        onIntentChange={vi.fn()}
        onGenerate={vi.fn()}
        isGenerating={false}
        hasDimensions={false}
      />,
    );
    expect(screen.getByRole("button", { name: /generate/i })).toBeEnabled();
  });

  it("should call onGenerate when button clicked", () => {
    const onGenerate = vi.fn();
    render(
      <IntentPanel
        intent="Write an email"
        onIntentChange={vi.fn()}
        onGenerate={onGenerate}
        isGenerating={false}
        hasDimensions={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("should show generating state", () => {
    render(
      <IntentPanel
        intent="Write an email"
        onIntentChange={vi.fn()}
        onGenerate={vi.fn()}
        isGenerating={true}
        hasDimensions={false}
      />,
    );
    expect(screen.getByRole("button", { name: /generating/i })).toBeDisabled();
  });

  it("should show intent as read-only text when dimensions exist", () => {
    render(
      <IntentPanel
        intent="Write a professional email"
        onIntentChange={vi.fn()}
        onGenerate={vi.fn()}
        isGenerating={false}
        hasDimensions={true}
      />,
    );
    expect(screen.getByText("Write a professional email")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("should call onIntentChange when typing", () => {
    const onIntentChange = vi.fn();
    render(
      <IntentPanel
        intent=""
        onIntentChange={onIntentChange}
        onGenerate={vi.fn()}
        isGenerating={false}
        hasDimensions={false}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/describe the text/i), {
      target: { value: "Hello" },
    });
    expect(onIntentChange).toHaveBeenCalledWith("Hello");
  });
});

// --- TextPanel ---

const textPanelDefaults = {
  text: "",
  onTextChange: vi.fn(),
  isStreaming: false,
  streamingText: "",
  status: "idle",
  canEvaluate: false,
  canRegenerate: false,
  canRefine: false,
  onEvaluate: vi.fn(),
  onRegenerate: vi.fn(),
  onRefine: vi.fn(),
};

describe("TextPanel", () => {
  it("should render textarea with placeholder", () => {
    render(<TextPanel {...textPanelDefaults} />);
    expect(
      screen.getByPlaceholderText(/text will appear/i),
    ).toBeInTheDocument();
  });

  it("should display current text", () => {
    render(<TextPanel {...textPanelDefaults} text="Hello world" />);
    expect(screen.getByDisplayValue("Hello world")).toBeInTheDocument();
  });

  it("should display streaming text when streaming", () => {
    render(
      <TextPanel
        {...textPanelDefaults}
        text="original"
        isStreaming={true}
        streamingText="streaming result"
      />,
    );
    expect(screen.getByDisplayValue("streaming result")).toBeInTheDocument();
  });

  it("should be read-only when streaming", () => {
    render(
      <TextPanel
        {...textPanelDefaults}
        text="original"
        isStreaming={true}
        streamingText="streaming"
      />,
    );
    const textarea = screen.getByDisplayValue("streaming");
    expect(textarea).toHaveAttribute("readonly");
  });

  it("should call onTextChange when typing", () => {
    const onTextChange = vi.fn();
    render(<TextPanel {...textPanelDefaults} onTextChange={onTextChange} />);
    fireEvent.change(screen.getByPlaceholderText(/text will appear/i), {
      target: { value: "New text" },
    });
    expect(onTextChange).toHaveBeenCalledWith("New text");
  });

  it("should render evaluate, regenerate, and refine buttons", () => {
    render(
      <TextPanel {...textPanelDefaults} canEvaluate canRegenerate canRefine />,
    );
    expect(screen.getByText("Evaluate")).toBeInTheDocument();
    expect(screen.getByText("Regenerate")).toBeInTheDocument();
    expect(screen.getByText("Refine")).toBeInTheDocument();
  });
});

// --- ControlBar ---

describe("ControlBar", () => {
  const defaults = {
    canEvaluate: true,
    canRefine: true,
    canOrchestrate: true,
    isEvaluating: false,
    isRefining: false,
    onEvaluate: vi.fn(),
    onRefine: vi.fn(),
    onOrchestrate: vi.fn(),
  };

  it("should render evaluate, refine, and auto-refine buttons", () => {
    render(<ControlBar {...defaults} />);
    expect(
      screen.getByRole("button", { name: /^evaluate$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^refine$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /auto-refine/i }),
    ).toBeInTheDocument();
  });

  it("should disable evaluate when canEvaluate is false", () => {
    render(<ControlBar {...defaults} canEvaluate={false} canRefine={false} />);
    expect(screen.getByRole("button", { name: /^evaluate$/i })).toBeDisabled();
  });

  it("should disable all buttons when evaluating", () => {
    render(<ControlBar {...defaults} isEvaluating={true} />);
    expect(screen.getByRole("button", { name: /evaluating/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^refine$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /auto-refine/i })).toBeDisabled();
  });

  it("should call onEvaluate when evaluate clicked", () => {
    const onEvaluate = vi.fn();
    render(
      <ControlBar {...defaults} canRefine={false} onEvaluate={onEvaluate} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^evaluate$/i }));
    expect(onEvaluate).toHaveBeenCalledOnce();
  });

  it("should call onRefine when refine clicked", () => {
    const onRefine = vi.fn();
    render(<ControlBar {...defaults} onRefine={onRefine} />);
    fireEvent.click(screen.getByRole("button", { name: /^refine$/i }));
    expect(onRefine).toHaveBeenCalledOnce();
  });

  it("should call onOrchestrate when auto-refine clicked", () => {
    const onOrchestrate = vi.fn();
    render(<ControlBar {...defaults} onOrchestrate={onOrchestrate} />);
    fireEvent.click(screen.getByRole("button", { name: /auto-refine/i }));
    expect(onOrchestrate).toHaveBeenCalledOnce();
  });
});

// --- DimensionList ---

describe("DimensionList", () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      dimensions: [],
      currentScores: {},
      targetScores: {},
      lockedDimensions: {},
      sessionId: null,
    });
  });

  it("should render nothing when no dimensions", () => {
    const { container } = render(<DimensionList />);
    expect(container.firstChild).toBeNull();
  });

  it("should render dimension names", () => {
    useAppStore.setState({
      dimensions: [
        makeDimension({ id: "d1", name: "Clarity" }),
        makeDimension({ id: "d2", name: "Tone", sortOrder: 1 }),
      ],
    });
    render(<DimensionList />);
    expect(screen.getByText("Clarity")).toBeInTheDocument();
    expect(screen.getByText("Tone")).toBeInTheDocument();
  });

  it("should show scores when available", () => {
    useAppStore.setState({
      dimensions: [makeDimension({ id: "d1", name: "Clarity" })],
      currentScores: { d1: SCORE },
    });
    render(<DimensionList />);
    expect(screen.getByText("Score: 4")).toBeInTheDocument();
  });

  it("should show description", () => {
    useAppStore.setState({
      dimensions: [makeDimension({ description: "Measures text clarity" })],
    });
    render(<DimensionList />);
    expect(screen.getByText("Measures text clarity")).toBeInTheDocument();
  });
});

// --- API module ---

describe("shell API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("apiGenerateDimensions should POST intent and return result", async () => {
    const mockResult = {
      dimensions: [{ name: "Clarity", description: "Clear", rubric: {} }],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResult),
    } as Response);

    const { apiGenerateDimensions } = await import("@/shell/api");
    const result = await apiGenerateDimensions("Write an email");

    expect(fetch).toHaveBeenCalledWith("/api/llm/dimensions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "Write an email" }),
    });
    expect(result).toEqual(mockResult);
  });

  it("apiEvaluate should POST text and dimensions", async () => {
    const mockScores = { d1: { score: 4, reasoning: "Good" } };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockScores),
    } as Response);

    const { apiEvaluate } = await import("@/shell/api");
    const dims = [makeDimension()];
    const result = await apiEvaluate("Hello", dims);

    expect(fetch).toHaveBeenCalledWith("/api/llm/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", dimensions: dims }),
    });
    expect(result).toEqual(mockScores);
  });

  it("apiGenerateDimensions should throw on error response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    } as Response);

    const { apiGenerateDimensions } = await import("@/shell/api");
    await expect(apiGenerateDimensions("test")).rejects.toThrow("Server error");
  });

  it("apiRewriteFull should POST context and return text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: "Rewritten text" }),
    } as Response);

    const { apiRewriteFull } = await import("@/shell/api");
    const result = await apiRewriteFull({
      intent: "Write email",
      currentText: "Hi",
      dimensions: [],
      currentScores: {},
      targetScores: {},
      lockedDimensionIds: [],
    });

    expect(result).toBe("Rewritten text");
  });
});
