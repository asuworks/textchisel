import type { Dimension } from "@shared/types";

export interface SpiderChartProps {
  /** Dimensions to display on the radar chart axes */
  dimensions: Dimension[];
  /** Current evaluation scores keyed by dimension ID */
  currentScores: Record<string, number>;
  /** Target scores keyed by dimension ID (draggable) */
  targetScores: Record<string, number>;
  /** Locked dimension IDs (Record for JSON serialization) */
  lockedDimensions: Record<string, boolean>;
  /** Called when user drags a target score to a new value */
  onTargetChange?: (dimensionId: string, score: number) => void;
  /** Called when user toggles the lock on a dimension */
  onLockToggle?: (dimensionId: string) => void;
  /** Called when user clicks a dimension label on the chart. Includes screen-space anchor rect for popover positioning. */
  onDimensionClick?: (dimensionId: string, anchorRect: DOMRect) => void;
}
