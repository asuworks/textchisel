interface TextPanelProps {
  text: string;
  onTextChange: (text: string) => void;
  isStreaming: boolean;
  streamingText: string;
  hasScores: boolean;
}

export function TextPanel({
  text,
  onTextChange,
  isStreaming,
  streamingText,
  hasScores,
}: TextPanelProps) {
  const displayText = isStreaming ? streamingText : text;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          {isStreaming ? "Rewriting…" : "Text"}
        </label>
        {hasScores && !isStreaming && (
          <span className="text-xs text-gray-400">
            Drag chart points to set targets, then refine
          </span>
        )}
      </div>
      <textarea
        value={displayText}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Enter or paste the text you want to evaluate and refine…"
        readOnly={isStreaming}
        className={`flex-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none ${
          isStreaming
            ? "border-blue-300 bg-blue-50 text-gray-700"
            : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        }`}
      />
    </div>
  );
}
