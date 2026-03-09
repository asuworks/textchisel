import { useCallback } from "react";
import { SpiderChart } from "@/chart/SpiderChart";
import { useAppStore } from "@/store";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Dimension, EvaluationScore } from "@shared/types";

const MAX_DIMENSIONS = 12;

interface ChartPanelProps {
  dimensions: Dimension[];
  currentScores: Record<string, EvaluationScore>;
  onDimensionClick?: (dimensionId: string, anchorRect: DOMRect) => void;
}

export function ChartPanel({
  dimensions,
  currentScores,
  onDimensionClick,
}: ChartPanelProps) {
  const targetScores = useAppStore((s) => s.targetScores);
  const lockedDimensions = useAppStore((s) => s.lockedDimensions);
  const setTargetScore = useAppStore((s) => s.setTargetScore);
  const toggleLock = useAppStore((s) => s.toggleLock);
  const addDimension = useAppStore((s) => s.addDimension);
  const sessionId = useAppStore((s) => s.sessionId);
  const status = useAppStore((s) => s.sessionStatus);

  const handleAdd = useCallback(() => {
    const newDim: Dimension = {
      id: crypto.randomUUID(),
      sessionId: sessionId ?? "",
      name: "New Dimension",
      description: "Describe what this dimension measures",
      rubric: {
        "1": "Poor",
        "2": "Below average",
        "3": "Average",
        "4": "Good",
        "5": "Excellent",
      },
      weight: 1.0,
      sortOrder: dimensions.length,
      locked: false,
      evalPrompt: null,
      rewriteHint: null,
    };
    addDimension(newDim);
    setTargetScore(newDim.id, 3);
  }, [sessionId, dimensions.length, addDimension, setTargetScore]);

  if (dimensions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Generate dimensions to see the chart
      </div>
    );
  }

  if (status === "generating") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="relative aspect-square w-full max-w-xs">
          <Skeleton className="h-full w-full rounded-full" />
          <Skeleton className="absolute inset-[15%] rounded-full" />
          <Skeleton className="absolute inset-[30%] rounded-full" />
          <Skeleton className="absolute inset-[45%] rounded-full" />
        </div>
      </div>
    );
  }

  // Extract numeric scores from EvaluationScore objects
  const numericScores: Record<string, number> = {};
  for (const [id, evalScore] of Object.entries(currentScores)) {
    numericScores[id] = evalScore.score;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <SpiderChart
          dimensions={dimensions}
          currentScores={numericScores}
          targetScores={targetScores}
          lockedDimensions={lockedDimensions}
          onTargetChange={setTargetScore}
          onLockToggle={toggleLock}
          onDimensionClick={onDimensionClick}
        />
      </div>
      {dimensions.length < MAX_DIMENSIONS && (
        <div className="flex shrink-0 justify-center pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className="text-xs text-muted-foreground"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Dimension
          </Button>
        </div>
      )}
    </div>
  );
}
