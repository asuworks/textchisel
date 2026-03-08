import { useMemo, useCallback } from "react";
import {
  Chart as ChartJS,
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
import { clampScore, isLocked } from "./helpers";

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

// Dataset index constant (target dataset is the draggable one)
const TARGET_DATASET = 1;

/**
 * Spider/radar chart for visualizing current scores vs draggable target scores.
 *
 * - Dataset 0 (blue, filled): Current evaluation scores (NOT draggable)
 * - Dataset 1 (orange/gold, dashed): Target scores (draggable)
 * - Locked dimensions show a different point style and cannot be dragged
 */
export function SpiderChart({
  dimensions,
  currentScores,
  targetScores,
  lockedDimensions,
  onTargetChange,
  onLockToggle,
}: SpiderChartProps) {
  // Sort dimensions by sortOrder for consistent axis ordering
  const sortedDimensions = useMemo(
    () => [...dimensions].sort((a, b) => a.sortOrder - b.sortOrder),
    [dimensions],
  );

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

    // Per-point styling for locked vs unlocked on the target dataset
    const targetPointStyles = sortedDimensions.map((d) =>
      isLocked(lockedDimensions, d.id)
        ? ("rectRot" as const)
        : ("circle" as const),
    );
    const targetPointColors = sortedDimensions.map((d) =>
      isLocked(lockedDimensions, d.id)
        ? "rgba(160, 160, 160, 0.8)"
        : "rgba(255, 165, 0, 1)",
    );

    return {
      labels,
      datasets: [
        {
          label: "Current Score",
          data: currentData,
          backgroundColor: "rgba(54, 162, 235, 0.15)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 2,
          pointBackgroundColor: "rgba(54, 162, 235, 1)",
          pointBorderColor: "#fff",
          pointRadius: 6,
          pointHoverRadius: 8,
          pointHitRadius: 25,
          fill: true,
          dragData: false, // Current scores are not draggable
          order: 1,
        },
        {
          label: "Target Score",
          data: targetData,
          backgroundColor: "rgba(255, 165, 0, 0.08)",
          borderColor: "rgba(255, 165, 0, 0.6)",
          borderWidth: 2,
          borderDash: [6, 3],
          pointBackgroundColor: targetPointColors,
          pointBorderColor: "#fff",
          pointRadius: 5,
          pointHoverRadius: 7,
          pointHitRadius: 25,
          pointStyle: targetPointStyles,
          fill: true,
          dragData: true, // Target scores are draggable
          order: 2,
        },
      ],
    };
  }, [sortedDimensions, currentScores, targetScores, lockedDimensions]);

  // Stable callback refs for drag handlers
  // DragDataEvent = MouseEvent | TouchEvent from chartjs-plugin-dragdata
  // ChartDataItemType<"radar"> = number | null
  const handleDragStart = useCallback(
    (
      _e: MouseEvent | TouchEvent,
      datasetIndex: number,
      index: number,
      _value: number | null,
    ): boolean | void => {
      // Only allow dragging on the target dataset
      if (datasetIndex !== TARGET_DATASET) return false;
      // Block dragging on locked dimensions
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
      // Reject null values or drags outside the valid range; magnet.to handles rounding
      if (value == null || value < 0.5 || value > 5.5) return false;
    },
    [],
  );

  const handleDragEnd = useCallback(
    (
      _e: MouseEvent | TouchEvent,
      _datasetIndex: number,
      index: number,
      value: number | null,
    ): void => {
      if (onTargetChange && dimensionIds[index] && value != null) {
        onTargetChange(dimensionIds[index], clampScore(value));
      }
    },
    [onTargetChange, dimensionIds],
  );

  const handleClick = useCallback(
    (_event: React.MouseEvent<HTMLCanvasElement>) => {
      // onClick for lock toggle is handled via the chart's native click
      // but Chart.js click detection on radar points requires chart instance access.
      // For now, lock toggling is expected to happen via the onLockToggle callback
      // wired from outside (e.g., a context menu or button per dimension).
      // A future enhancement could use getElementsAtEventForMode here.
      void onLockToggle;
    },
    [onLockToggle],
  );

  // Build chart options
  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          min: 1,
          max: 5,
          ticks: {
            stepSize: 1,
            backdropColor: "transparent",
            color: "#888",
            font: { size: 10 },
            // Only show integer ticks
            callback: (tickValue: string | number) => {
              const v =
                typeof tickValue === "string"
                  ? parseInt(tickValue, 10)
                  : tickValue;
              return Number.isInteger(v) ? v : "";
            },
          },
          pointLabels: {
            color: "#333",
            font: { size: 13, weight: "bold" as const },
            padding: 10,
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
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: { usePointStyle: true, padding: 15 },
        },
        tooltip: {
          callbacks: {
            label: (ctx: {
              dataset: { label?: string };
              parsed: { r: number };
            }) => `${ctx.dataset.label ?? ""}: ${ctx.parsed.r}/5`,
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
    [handleDragStart, handleDrag, handleDragEnd],
  );

  return (
    <div
      onClick={
        handleClick as unknown as React.MouseEventHandler<HTMLDivElement>
      }
    >
      <Radar data={data} options={options} />
    </div>
  );
}
