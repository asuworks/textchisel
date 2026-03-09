import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
      <label className="text-sm font-medium text-foreground">
        Writing Intent
      </label>
      {isEditing || !hasDimensions ? (
        <>
          <Textarea
            value={intent}
            onChange={(e) => onIntentChange(e.target.value)}
            placeholder="Describe the text you want to write (e.g., 'A professional email declining a meeting invitation')"
            rows={3}
            disabled={isGenerating}
            className="text-sm"
          />
          <Button
            onClick={onGenerate}
            disabled={!intent.trim() || isGenerating}
            className="w-full"
          >
            {isGenerating ? "Generating\u2026" : "Generate"}
          </Button>
        </>
      ) : (
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm italic text-muted-foreground">
            {intent}
          </p>
          <Button
            variant="link"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-auto shrink-0 p-0 text-xs"
          >
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}
