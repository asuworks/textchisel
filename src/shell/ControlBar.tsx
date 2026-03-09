import { Button } from "@/components/ui/button";

interface ControlBarProps {
  canEvaluate: boolean;
  canRefine: boolean;
  canOrchestrate: boolean;
  isEvaluating: boolean;
  isRefining: boolean;
  onEvaluate: () => void;
  onRefine: () => void;
  onOrchestrate: () => void;
}

export function ControlBar({
  canEvaluate,
  canRefine,
  canOrchestrate,
  isEvaluating,
  isRefining,
  onEvaluate,
  onRefine,
  onOrchestrate,
}: ControlBarProps) {
  const busy = isEvaluating || isRefining;

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        onClick={onEvaluate}
        disabled={!canEvaluate || busy}
      >
        {isEvaluating ? "Evaluating…" : "Evaluate"}
      </Button>
      <Button onClick={onRefine} disabled={!canRefine || busy}>
        {isRefining ? "Refining…" : "Refine"}
      </Button>
      <Button
        variant="outline"
        onClick={onOrchestrate}
        disabled={!canOrchestrate || busy}
      >
        {isRefining ? "Auto-Refining…" : "Auto-Refine"}
      </Button>
    </div>
  );
}
