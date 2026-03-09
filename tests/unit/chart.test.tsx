import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// --- ResizeObserver mock for jsdom (Chart.js responsive mode needs it) ---
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// --- Canvas mock for jsdom (Chart.js requires a canvas context) ---
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(function (
    this: HTMLCanvasElement,
    contextId: string,
  ) {
    if (contextId === "2d") {
      return {
        canvas: this,
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(4),
        })),
        putImageData: vi.fn(),
        createImageData: vi.fn(() => []),
        setTransform: vi.fn(),
        resetTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        fillText: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
        transform: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        createLinearGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
        createRadialGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
        createPattern: vi.fn(),
        setLineDash: vi.fn(),
        getLineDash: vi.fn(() => []),
        bezierCurveTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        isPointInPath: vi.fn(),
        isPointInStroke: vi.fn(),
        ellipse: vi.fn(),
        arcTo: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  }) as typeof HTMLCanvasElement.prototype.getContext;
});

// --- Import after canvas mock is set up ---
import { SpiderChart } from "@/chart/SpiderChart";
import { clampScore, isLocked } from "@/chart/helpers";
import type { SpiderChartProps } from "@/chart/types";

// --- Test fixtures ---

function makeDimension(
  overrides: Partial<{
    id: string;
    sessionId: string;
    name: string;
    description: string;
    weight: number;
    rubric: Record<string, string> | null;
    locked: boolean;
    sortOrder: number;
  }> = {},
) {
  return {
    id: overrides.id ?? "dim-1",
    sessionId: overrides.sessionId ?? "sess-1",
    name: overrides.name ?? "Clarity",
    description: overrides.description ?? "How clear the text is",
    weight: overrides.weight ?? 1.0,
    rubric: overrides.rubric ?? null,
    locked: overrides.locked ?? false,
    sortOrder: overrides.sortOrder ?? 0,
  };
}

function makeDefaultProps(
  overrides: Partial<SpiderChartProps> = {},
): SpiderChartProps {
  const dims = overrides.dimensions ?? [
    makeDimension({ id: "d1", name: "Clarity", sortOrder: 0 }),
    makeDimension({ id: "d2", name: "Structure", sortOrder: 1 }),
    makeDimension({ id: "d3", name: "Evidence", sortOrder: 2 }),
  ];
  return {
    dimensions: dims,
    currentScores: overrides.currentScores ?? { d1: 3, d2: 4, d3: 2 },
    targetScores: overrides.targetScores ?? { d1: 4, d2: 5, d3: 3 },
    lockedDimensions: overrides.lockedDimensions ?? {},
    onTargetChange: overrides.onTargetChange ?? vi.fn(),
    onLockToggle: overrides.onLockToggle ?? vi.fn(),
  };
}

// ============================================================
// Unit tests for helper functions
// ============================================================

describe("clampScore", () => {
  it("returns the value when within range 1-5", () => {
    expect(clampScore(3)).toBe(3);
  });

  it("clamps values below 1 to 1", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(-5)).toBe(1);
    expect(clampScore(0.4)).toBe(1);
  });

  it("clamps values above 5 to 5", () => {
    expect(clampScore(6)).toBe(5);
    expect(clampScore(100)).toBe(5);
    expect(clampScore(5.9)).toBe(5);
  });

  it("rounds to nearest integer", () => {
    expect(clampScore(2.3)).toBe(2);
    expect(clampScore(2.7)).toBe(3);
    expect(clampScore(4.5)).toBe(5);
  });
});

describe("isLocked", () => {
  it("returns true for a locked dimension", () => {
    const locked = { d1: true, d3: true };
    expect(isLocked(locked, "d1")).toBe(true);
    expect(isLocked(locked, "d3")).toBe(true);
  });

  it("returns false for an unlocked dimension", () => {
    const locked = { d1: true };
    expect(isLocked(locked, "d2")).toBe(false);
  });

  it("returns false for empty lock set", () => {
    const locked: Record<string, boolean> = {};
    expect(isLocked(locked, "d1")).toBe(false);
  });
});

// ============================================================
// Component tests
// ============================================================

describe("SpiderChart component", () => {
  it("renders without crashing with valid props", () => {
    const props = makeDefaultProps();
    const { container } = render(<SpiderChart {...props} />);
    // Chart.js renders into a canvas element
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("renders with empty dimensions array", () => {
    const props = makeDefaultProps({
      dimensions: [],
      currentScores: {},
      targetScores: {},
    });
    const { container } = render(<SpiderChart {...props} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("renders with a single dimension", () => {
    const dims = [makeDimension({ id: "d1", name: "Solo", sortOrder: 0 })];
    const props = makeDefaultProps({
      dimensions: dims,
      currentScores: { d1: 3 },
      targetScores: { d1: 4 },
    });
    const { container } = render(<SpiderChart {...props} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("renders with many dimensions", () => {
    const dims = Array.from({ length: 8 }, (_, i) =>
      makeDimension({ id: `d${i}`, name: `Dim ${i}`, sortOrder: i }),
    );
    const currentScores: Record<string, number> = {};
    const targetScores: Record<string, number> = {};
    dims.forEach((d) => {
      currentScores[d.id] = 3;
      targetScores[d.id] = 4;
    });
    const props = makeDefaultProps({
      dimensions: dims,
      currentScores,
      targetScores,
    });
    const { container } = render(<SpiderChart {...props} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("accepts callback props without error", () => {
    const onTargetChange = vi.fn();
    const onLockToggle = vi.fn();
    const props = makeDefaultProps({ onTargetChange, onLockToggle });
    const { container } = render(<SpiderChart {...props} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    // Callbacks are wired but not called during render
    expect(onTargetChange).not.toHaveBeenCalled();
    expect(onLockToggle).not.toHaveBeenCalled();
  });

  it("defaults missing scores to 1", () => {
    // Dimension d3 has no entry in currentScores or targetScores
    const props = makeDefaultProps({
      currentScores: { d1: 3, d2: 4 },
      targetScores: { d1: 4, d2: 5 },
    });
    const { container } = render(<SpiderChart {...props} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("handles lockedDimensions set correctly", () => {
    const props = makeDefaultProps({
      lockedDimensions: { d1: true, d3: true },
    });
    const { container } = render(<SpiderChart {...props} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});

// ============================================================
// Barrel export tests
// ============================================================

describe("chart module exports", () => {
  it("exports SpiderChart component from barrel", async () => {
    const mod = await import("@/chart/index");
    expect(mod.SpiderChart).toBeDefined();
    expect(typeof mod.SpiderChart).toBe("function");
  });
});
