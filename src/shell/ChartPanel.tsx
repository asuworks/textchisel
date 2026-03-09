import { SpiderChart } from "@/chart/SpiderChart";
import { useAppStore } from "@/store";
import type { Dimension, EvaluationScore } from "@shared/types";

interface ChartPanelProps {
  dimensions: Dimension[];
  currentScores: Record<string, EvaluationScore>;
}

export function ChartPanel({ dimensions, currentScores }: ChartPanelProps) {
  const targetScores = useAppStore((s) => s.targetScores);
  const lockedDimensions = useAppStore((s) => s.lockedDimensions);
  const setTargetScore = useAppStore((s) => s.setTargetScore);
  const toggleLock = useAppStore((s) => s.toggleLock);

  if (dimensions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Generate dimensions to see the chart
      </div>
    );
  }

  // Extract numeric scores from EvaluationScore objects
  const numericScores: Record<string, number> = {};
  for (const [id, evalScore] of Object.entries(currentScores)) {
    numericScores[id] = evalScore.score;
  }

  return (
    <div className="h-full">
      <SpiderChart
        dimensions={dimensions}
        currentScores={numericScores}
        targetScores={targetScores}
        lockedDimensions={lockedDimensions}
        onTargetChange={setTargetScore}
        onLockToggle={toggleLock}
      />
    </div>
  );
}
