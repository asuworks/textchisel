import type { Dimension, EvaluationScore } from "@shared/types";

interface DimensionListProps {
  dimensions: Dimension[];
  currentScores: Record<string, EvaluationScore>;
}

export function DimensionList({
  dimensions,
  currentScores,
}: DimensionListProps) {
  if (dimensions.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700">Dimensions</h3>
      <ul className="space-y-1">
        {dimensions.map((dim) => {
          const evalScore = currentScores[dim.id];
          return (
            <li
              key={dim.id}
              className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-800">{dim.name}</span>
                <p className="truncate text-xs text-gray-500">
                  {dim.description}
                </p>
              </div>
              {evalScore && (
                <span className="ml-2 shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  {evalScore.score}/5
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
