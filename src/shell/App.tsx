import { useState, useCallback } from "react";
import type { Dimension, EvaluationScore } from "@shared/types";
import { useAppStore } from "@/store";
import { IntentPanel } from "./IntentPanel";
import { ChartPanel } from "./ChartPanel";
import { TextPanel } from "./TextPanel";
import { DimensionList } from "./DimensionList";
import { ControlBar } from "./ControlBar";
import { apiGenerateDimensions, apiEvaluate, apiRewriteFull } from "./api";

type Status = "idle" | "generating" | "evaluating" | "refining" | "error";

export default function App() {
  // Local state (will move to PGlite/store in integration session)
  const [intent, setIntent] = useState("");
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [currentText, setCurrentText] = useState("");
  const [currentScores, setCurrentScores] = useState<
    Record<string, EvaluationScore>
  >({});
  const [streamingText, setStreamingText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const targetScores = useAppStore((s) => s.targetScores);
  const lockedDimensions = useAppStore((s) => s.lockedDimensions);
  const setTargetScore = useAppStore((s) => s.setTargetScore);

  const hasDimensions = dimensions.length > 0;
  const hasText = currentText.trim().length > 0;
  const hasScores = Object.keys(currentScores).length > 0;

  const handleGenerate = useCallback(async () => {
    setStatus("generating");
    setError(null);
    try {
      const result = await apiGenerateDimensions(intent);
      // Convert generated dimensions to Dimension type with IDs
      const dims: Dimension[] = result.dimensions.map((d, i) => ({
        id: crypto.randomUUID(),
        sessionId: "local",
        name: d.name,
        description: d.description,
        weight: 1.0,
        locked: false,
        rubric: d.rubric,
        sortOrder: i,
        createdAt: new Date(),
      }));
      setDimensions(dims);
      // Initialize target scores to 3 (middle) for each dimension
      for (const dim of dims) {
        setTargetScore(dim.id, 3);
      }
      setCurrentScores({});
      setStatus("idle");
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, [intent, setTargetScore]);

  const handleEvaluate = useCallback(async () => {
    setStatus("evaluating");
    setError(null);
    try {
      const scores = await apiEvaluate(currentText, dimensions);
      setCurrentScores(scores);
      setStatus("idle");
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, [currentText, dimensions]);

  const handleRefine = useCallback(async () => {
    setStatus("refining");
    setStreamingText("");
    setError(null);
    try {
      const text = await apiRewriteFull({
        intent,
        currentText,
        dimensions,
        currentScores,
        targetScores,
        lockedDimensionIds: Array.from(lockedDimensions),
      });
      setCurrentText(text);
      setStreamingText("");
      setStatus("idle");
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, [
    intent,
    currentText,
    dimensions,
    currentScores,
    targetScores,
    lockedDimensions,
  ]);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold text-gray-900">textchisel</h1>
      </header>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">
          {error}
          <button
            onClick={() => {
              setError(null);
              setStatus("idle");
            }}
            className="ml-3 text-red-500 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left sidebar */}
        <aside className="flex w-80 shrink-0 flex-col gap-6 overflow-y-auto border-r border-gray-200 bg-white p-4">
          <IntentPanel
            intent={intent}
            onIntentChange={setIntent}
            onGenerate={handleGenerate}
            isGenerating={status === "generating"}
            hasDimensions={hasDimensions}
          />
          <DimensionList
            dimensions={dimensions}
            currentScores={currentScores}
          />
        </aside>

        {/* Center + Right content */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Control bar */}
          <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-3">
            <ControlBar
              canEvaluate={hasDimensions && hasText}
              canRefine={hasScores}
              isEvaluating={status === "evaluating"}
              isRefining={status === "refining"}
              onEvaluate={handleEvaluate}
              onRefine={handleRefine}
            />
          </div>

          {/* Chart + Text panels */}
          <div className="flex min-h-0 flex-1">
            {/* Chart */}
            <div className="flex w-1/2 items-center justify-center border-r border-gray-200 p-4">
              <ChartPanel
                dimensions={dimensions}
                currentScores={currentScores}
              />
            </div>

            {/* Text */}
            <div className="flex w-1/2 flex-col p-4">
              <TextPanel
                text={currentText}
                onTextChange={setCurrentText}
                isStreaming={status === "refining"}
                streamingText={streamingText}
                hasScores={hasScores}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
