import React, { useMemo, useCallback, useRef } from "react";
import {
  Chart as ChartJS,
  Plugin,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import ChartJSDragDataPlugin from "chartjs-plugin-dragdata";
import type { SpiderChartProps } from "./types";
import { clampScore, isLocked, maxRubricLevel } from "./helpers";

// Register Chart.js components and drag plugin
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);
ChartJS.register(ChartJSDragDataPlugin);

// Use Geist for all Chart.js text (canvas doesn't inherit CSS fonts)
ChartJS.defaults.font.family = "'Geist Variable', sans-serif";

/** Internal Chart.js type for rendered point label positions (includes bounding box) */
interface PointLabelItem {
  x: number;
  y: number;
  textAlign: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Get actual rendered label positions from Chart.js internals */
function getLabelItems(scale: RadialLinearScale): PointLabelItem[] | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (scale as any)._pointLabelItems ?? null;
}

// Returns the label index near (clientX, clientY), or -1 if none.
// Uses the bounding box directly — no center calculation needed.
function labelIndexNear(
  chart: ChartJS<"radar">,
  clientX: number,
  clientY: number,
): number {
  const scale = chart.scales.r as RadialLinearScale;
  if (!scale) return -1;
  const items = getLabelItems(scale);
  if (!items) return -1;
  const rect = chart.canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const pad = 6;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (
      x >= it.left - pad &&
      x <= it.right + pad &&
      y >= it.top - pad &&
      y <= it.bottom + pad
    ) {
      return i;
    }
  }
  return -1;
}

// Factory: creates a Chart.js plugin that highlights the hovered label,
// reading the current index from the provided ref (avoids module-level mutable state).
function createLabelHoverPlugin(hoveredRef: React.RefObject<number>): Plugin<"radar"> {
  return {
    id: "underlineLabels",
    afterDraw(chart: ChartJS<"radar">) {
      const idx = hoveredRef.current ?? -1;
      if (idx < 0) return;
      const scale = chart.scales.r as RadialLinearScale;
      if (!scale) return;
      const items = getLabelItems(scale);
      if (!items || idx >= items.length) return;
      const item = items[idx];
      const ctx = chart.ctx;
      const pad = 4;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(
        item.left - pad,
        item.top - pad,
        item.right - item.left + pad * 2,
        item.bottom - item.top + pad * 2,
        4,
      );
      ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
      ctx.fill();
      ctx.restore();
    },
  };
}

// Target dataset index — target is datasets[0], current is datasets[1]
const TARGET_DATASET = 0;

/**
 * Spider/radar chart visualizing current scores vs draggable target scores.
 *
 * Visual hierarchy (dual-layer):
 * - Dataset 1 — Current scores: faded slate border, 6% fill, circle markers, NOT draggable.
 *   Drawn second (order: 2, behind).
 * - Dataset 0 — Target scores: dashed amber border, 8% fill, circle markers, DRAGGABLE.
 *   Drawn first (order: 1, on top). Locked points shown in grey with rectRot (diamond) shape.
 *   Click a point to toggle lock for that dimension.
 */
export function SpiderChart({
  dimensions,
  currentScores,
  targetScores,
  lockedDimensions,
  onTargetChange,
  onLockToggle,
  onDimensionClick,
}: SpiderChartProps) {
  // Ref to the underlying Chart.js instance for hit-testing on click
  const chartRef = useRef<ChartJS<"radar">>(null);

  // Per-instance hover state (avoids module-level mutable variable)
  const hoveredLabelRef = useRef<number>(-1);
  const labelHoverPlugin = useMemo(
    () => createLabelHoverPlugin(hoveredLabelRef),
    [],
  );

  // Sort dimensions by sortOrder for consistent axis ordering
  const sortedDimensions = useMemo(
    () => [...dimensions].sort((a, b) => a.sortOrder - b.sortOrder),
    [dimensions],
  );

  // Dynamic scale max based on rubric levels
  const scaleMax = useMemo(() => maxRubricLevel(dimensions), [dimensions]);

  // Map dimension IDs in sorted order for index-based lookups
  const dimensionIds = useMemo(
    () => sortedDimensions.map((d) => d.id),
    [sortedDimensions],
  );

  // Build chart data
  const data = useMemo(() => {
    const labels = sortedDimensions.map((d) => d.name);
    const currentData = sortedDimensions.map((d) => currentScores[d.id] ?? 1);
    const targetData = sortedDimensions.map((d) => targetScores[d.id] ?? 1);

    // Per-point styling for target dataset: locked = grey rectRot, unlocked = amber circle
    const targetPointStyles = sortedDimensions.map((d) =>
      isLocked(lockedDimensions, d.id)
        ? ("rectRot" as const)
        : ("circle" as const),
    );
    const targetPointColors = sortedDimensions.map((d) =>
      isLocked(lockedDimensions, d.id)
        ? "rgba(160, 160, 160, 0.8)"
        : "rgba(245, 158, 11, 0.9)",
    );

    return {
      labels,
      datasets: [
        // Target dataset: foreground (order: 1, on top), draggable
        {
          label: "Target Score",
          data: targetData,
          backgroundColor: "rgba(245, 158, 11, 0.08)",
          borderColor: "rgba(245, 158, 11, 0.8)",
          borderWidth: 2,
          borderDash: [6, 3],
          pointBackgroundColor: targetPointColors,
          pointBorderColor: "#fff",
          pointBorderWidth: 1.5,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointHitRadius: 25,
          pointStyle: targetPointStyles,
          fill: true,
          dragData: true,
          order: 1,
        },
        // Current dataset: background (order: 2, behind), read-only, faded
        {
          label: "Current Score",
          data: currentData,
          backgroundColor: "rgba(100, 116, 139, 0.06)",
          borderColor: "rgba(100, 116, 139, 0.35)",
          borderWidth: 1.5,
          pointBackgroundColor: "rgba(100, 116, 139, 0.35)",
          pointBorderColor: "transparent",
          pointBorderWidth: 0,
          pointRadius: 4,
          pointHoverRadius: 4,
          pointHitRadius: 0,
          fill: true,
          dragData: false,
          order: 2,
        },
      ],
    };
  }, [sortedDimensions, currentScores, targetScores, lockedDimensions]);

  // Stable callback refs for drag handlers
  const handleDragStart = useCallback(
    (
      _e: MouseEvent | TouchEvent,
      datasetIndex: number,
      index: number,
      _value: number | null,
    ): boolean | void => {
      if (datasetIndex !== TARGET_DATASET) return false;
      if (isLocked(lockedDimensions, dimensionIds[index])) return false;
    },
    [lockedDimensions, dimensionIds],
  );

  const handleDrag = useCallback(
    (
      _e: MouseEvent | TouchEvent,
      _datasetIndex: number,
      _index: number,
      value: number | null,
    ): boolean | void => {
      if (value == null || value < 0.5 || value > scaleMax + 0.5) return false;
    },
    [scaleMax],
  );

  const handleDragEnd = useCallback(
    (
      _e: MouseEvent | TouchEvent,
      _datasetIndex: number,
      index: number,
      value: number | null,
    ): void => {
      if (onTargetChange && dimensionIds[index] && value != null) {
        onTargetChange(dimensionIds[index], clampScore(value, scaleMax));
      }
    },
    [onTargetChange, dimensionIds, scaleMax],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!chartRef.current) return;
      const chart = chartRef.current;

      // Check if a data point was clicked → toggle lock
      const elements = chart.getElementsAtEventForMode(
        event.nativeEvent,
        "nearest",
        { intersect: true },
        false,
      );
      if (elements.length > 0) {
        const dimId = dimensionIds[elements[0].index];
        if (dimId && onLockToggle) onLockToggle(dimId);
        return;
      }

      // Check if a point label (dimension name) was clicked → open dimension
      if (!onDimensionClick) return;
      const idx = labelIndexNear(chart, event.clientX, event.clientY);
      if (idx >= 0 && dimensionIds[idx]) {
        const scale = chart.scales.r as RadialLinearScale;
        const items = getLabelItems(scale);
        const rect = chart.canvas.getBoundingClientRect();
        const item = items?.[idx];
        if (!item) return;
        // Anchor popover at center of the label bounding box
        const cx = (item.left + item.right) / 2;
        const cy = (item.top + item.bottom) / 2;
        const anchorRect = new DOMRect(rect.left + cx, rect.top + cy, 0, 0);
        onDimensionClick(dimensionIds[idx], anchorRect);
      }
    },
    [onLockToggle, onDimensionClick, dimensionIds],
  );

  // Build chart options
  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          min: 1,
          max: scaleMax,
          ticks: {
            stepSize: 1,
            backdropColor: "transparent",
            color: "#666",
            font: { family: "'Geist Variable', sans-serif", size: 11 },
            callback: (tickValue: string | number) => {
              const v =
                typeof tickValue === "string"
                  ? parseInt(tickValue, 10)
                  : tickValue;
              return Number.isInteger(v) ? String(v) : "";
            },
          },
          pointLabels: {
            color: "#1a1a1a",
            font: {
              family: "'Geist Variable', sans-serif",
              size: 12,
              weight: 600,
            },
            padding: 24,
          },
          grid: {
            color: "rgba(0, 0, 0, 0.08)",
            circular: false,
          },
          angleLines: {
            color: "rgba(0, 0, 0, 0.08)",
          },
        },
      },
      elements: {
        line: { borderWidth: 2, tension: 0 },
        point: { hitRadius: 25 },
      },
      animation: {
        duration: 300,
        easing: "easeOutQuart" as const,
      },
      layout: {
        padding: { top: 8, bottom: 8, left: 16, right: 16 },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          maxWidth: 240,
          backgroundColor: "hsl(0 0% 100%)",
          titleColor: "hsl(0 0% 9%)",
          bodyColor: "hsl(0 0% 45%)",
          borderColor: "hsl(0 0% 90%)",
          borderWidth: 1,
          cornerRadius: 6,
          padding: 10,
          titleFont: { size: 12, weight: "bold" as const },
          bodyFont: { size: 12 },
          displayColors: false,
          callbacks: {
            label: (ctx: {
              dataset: { label?: string };
              parsed: { r: number };
              dataIndex: number;
            }) => {
              const score = ctx.parsed.r;
              const dim = sortedDimensions[ctx.dataIndex];
              const rubricDesc = dim?.rubric?.[String(Math.round(score))] ?? "";
              const base = `${ctx.dataset.label ?? ""}: ${score}/${scaleMax}`;
              if (!rubricDesc) return base;
              // Wrap description into lines of ~35 chars to keep tooltip compact
              const full = `${base} — ${rubricDesc}`;
              if (full.length <= 40) return full;
              const lines = [base];
              const words = rubricDesc.split(" ");
              let line = "";
              for (const word of words) {
                if (line && (line + " " + word).length > 35) {
                  lines.push(line);
                  line = word;
                } else {
                  line = line ? line + " " + word : word;
                }
              }
              if (line) lines.push(line);
              return lines;
            },
          },
        },
        dragData: {
          round: 0,
          showTooltip: true,
          magnet: { to: (v: number | null) => (v == null ? v : Math.round(v)) },
          onDragStart: handleDragStart,
          onDrag: handleDrag,
          onDragEnd: handleDragEnd,
        },
      },
    }),
    [handleDragStart, handleDrag, handleDragEnd, sortedDimensions, scaleMax],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!chartRef.current) return;
      const chart = chartRef.current;
      const idx = labelIndexNear(chart, event.clientX, event.clientY);
      chart.canvas.style.cursor = idx >= 0 ? "pointer" : "";
      if (idx !== hoveredLabelRef.current) {
        hoveredLabelRef.current = idx;
        chart.draw();
      }
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    if (!chartRef.current) return;
    if (hoveredLabelRef.current >= 0) {
      hoveredLabelRef.current = -1;
      chartRef.current.draw();
    }
    chartRef.current.canvas.style.cursor = "";
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={
        handleClick as unknown as React.MouseEventHandler<HTMLDivElement>
      }
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Radar
        ref={chartRef}
        data={data}
        options={options}
        plugins={[labelHoverPlugin]}
      />
    </div>
  );
}
