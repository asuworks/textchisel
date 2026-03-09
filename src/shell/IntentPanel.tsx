import { useState } from "react";

interface IntentPanelProps {
  intent: string;
  onIntentChange: (intent: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hasDimensions: boolean;
}

export function IntentPanel({
  intent,
  onIntentChange,
  onGenerate,
  isGenerating,
  hasDimensions,
}: IntentPanelProps) {
  const [isEditing, setIsEditing] = useState(!hasDimensions);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Writing Intent
      </label>
      {isEditing || !hasDimensions ? (
        <>
          <textarea
            value={intent}
            onChange={(e) => onIntentChange(e.target.value)}
            placeholder="Describe the text you want to write (e.g., 'A professional email declining a meeting invitation')"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            disabled={isGenerating}
          />
          <button
            onClick={onGenerate}
            disabled={!intent.trim() || isGenerating}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? "Generating…" : "Generate Dimensions"}
          </button>
        </>
      ) : (
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm text-gray-600 italic">{intent}</p>
          <button
            onClick={() => setIsEditing(true)}
            className="shrink-0 text-xs text-blue-600 hover:text-blue-800"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
