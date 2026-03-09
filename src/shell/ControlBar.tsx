interface ControlBarProps {
  canEvaluate: boolean;
  canRefine: boolean;
  isEvaluating: boolean;
  isRefining: boolean;
  onEvaluate: () => void;
  onRefine: () => void;
}

export function ControlBar({
  canEvaluate,
  canRefine,
  isEvaluating,
  isRefining,
  onEvaluate,
  onRefine,
}: ControlBarProps) {
  const busy = isEvaluating || isRefining;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onEvaluate}
        disabled={!canEvaluate || busy}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isEvaluating ? "Evaluating…" : "Evaluate"}
      </button>
      <button
        onClick={onRefine}
        disabled={!canRefine || busy}
        className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRefining ? "Refining…" : "Refine"}
      </button>
    </div>
  );
}
