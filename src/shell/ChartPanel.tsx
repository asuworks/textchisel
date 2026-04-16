import { useEffect, useState } from "react";
import { SpiderChart } from "@/chart/SpiderChart";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Dimension, EvaluationScore } from "@shared/types";

function GeneratingAnimation() {
  return (
    <svg
      viewBox="-100 -100 200 200"
      className="h-[48rem] w-[48rem] text-foreground"
      aria-label="Generating…"
    >
      <defs>
        <filter id="tc-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="tc-sphere-grad" cx="40%" cy="35%" r="60%">
          {/* Slow emerge from mist → visible → fade back into mist */}
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.01">
            <animate
              attributeName="stop-opacity"
              values="0.01;0.01;0.06;0.14;0.18;0.18;0.18;0.14;0.06;0.01;0.01"
              keyTimes="0;0.05;0.15;0.25;0.35;0.45;0.55;0.65;0.75;0.85;1"
              dur="18s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="60%" stopColor="currentColor" stopOpacity="0.01">
            <animate
              attributeName="stop-opacity"
              values="0.01;0.01;0.03;0.06;0.08;0.08;0.08;0.06;0.03;0.01;0.01"
              keyTimes="0;0.05;0.15;0.25;0.35;0.45;0.55;0.65;0.75;0.85;1"
              dur="18s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          <animate
            attributeName="cx"
            values="35%;65%;50%;35%"
            dur="12s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="cy"
            values="30%;40%;65%;30%"
            dur="12s"
            repeatCount="indefinite"
          />
        </radialGradient>
      </defs>

      {/* Core sphere — glowing with radial gradient */}
      <circle
        cx="0"
        cy="0"
        r="32"
        fill="url(#tc-sphere-grad)"
        filter="url(#tc-glow)"
      >
        <animate
          attributeName="r"
          values="30;34;30"
          dur="5s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

const MAX_DIMENSIONS = 12;

interface ChartPanelProps {
  dimensions: Dimension[];
  currentScores: Record<string, EvaluationScore>;
  onDimensionClick?: (dimensionId: string, anchorRect: DOMRect) => void;
  onAddDimension?: () => void;
}

export function ChartPanel({
  dimensions,
  currentScores,
  onDimensionClick,
  onAddDimension,
}: ChartPanelProps) {
  const targetScores = useAppStore((s) => s.targetScores);
  const lockedDimensions = useAppStore((s) => s.lockedDimensions);
  const setTargetScore = useAppStore((s) => s.setTargetScore);
  const toggleLock = useAppStore((s) => s.toggleLock);
  const status = useAppStore((s) => s.sessionStatus);
  const [debugAnim, setDebugAnim] = useState(false);
  // Transition after generating stops: "fading" (1s opacity) → "waiting" (1s blank) → "chart"
  const [exitPhase, setExitPhase] = useState<"fading" | "waiting" | null>(null);
  const [prevGenerating, setPrevGenerating] = useState(false);

  const isGenerating = debugAnim || status === "generating";

  // Adjust state during render (React-recommended pattern for prop/state transitions)
  if (isGenerating && !prevGenerating) {
    setPrevGenerating(true);
    if (exitPhase !== null) setExitPhase(null);
  } else if (!isGenerating && prevGenerating) {
    setPrevGenerating(false);
    if (exitPhase === null) setExitPhase("fading");
  }

  // Timer chain for exit animation phases
  useEffect(() => {
    if (exitPhase === "fading") {
      const t = setTimeout(() => setExitPhase("waiting"), 1000);
      return () => clearTimeout(t);
    }
    if (exitPhase === "waiting") {
      const t = setTimeout(() => setExitPhase(null), 1000);
      return () => clearTimeout(t);
    }
  }, [exitPhase]);

  // Derived phase for rendering
  const phase = isGenerating
    ? "anim"
    : exitPhase === "fading"
      ? "fading"
      : exitPhase === "waiting"
        ? "waiting"
        : "chart";

  if (dimensions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Generate dimensions to see the chart
      </div>
    );
  }

  if (phase === "anim" || phase === "fading") {
    return (
      <div
        className="relative flex h-full items-center justify-center transition-opacity duration-1000"
        style={{ opacity: phase === "fading" ? 0 : 1 }}
      >
        <GeneratingAnimation />
        {debugAnim && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDebugAnim(false)}
            className="absolute bottom-2 right-2 text-xs text-muted-foreground"
          >
            Close
          </Button>
        )}
      </div>
    );
  }

  if (phase === "waiting") {
    return <div className="flex h-full items-center justify-center" />;
  }

  // Extract numeric scores from EvaluationScore objects
  const numericScores: Record<string, number> = {};
  for (const [id, evalScore] of Object.entries(currentScores)) {
    numericScores[id] = evalScore.score;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-center gap-6 py-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="text-xs text-muted-foreground">Target Score</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400/50" />
          <span className="text-xs text-muted-foreground">Current Score</span>
        </div>
      </div>
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
      <div className="flex shrink-0 justify-center gap-2 pb-2">
        {dimensions.length < MAX_DIMENSIONS && onAddDimension && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddDimension}
            className="text-xs text-muted-foreground"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Dimension
          </Button>
        )}
        {/* {import.meta.env.DEV && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDebugAnim(true)}
            className="text-xs text-muted-foreground/50"
          >
            Anim
          </Button>
        )} */}
      </div>
    </div>
  );
}
