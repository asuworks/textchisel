import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface IntentPanelProps {
  intent: string;
  onIntentChange: (intent: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function IntentPanel({
  intent,
  onIntentChange,
  onGenerate,
  isGenerating,
}: IntentPanelProps) {
  return (
    <div className="flex h-full flex-col gap-3">
      <h2 className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Intent
      </h2>
      <ScrollArea className="min-h-0 flex-1">
        <Textarea
          value={intent}
          onChange={(e) => onIntentChange(e.target.value)}
          placeholder="Describe the text you want to write…"
          disabled={isGenerating}
          className="min-h-full resize-none border-0 bg-transparent px-0 font-mono text-sm shadow-none focus-visible:ring-0"
        />
      </ScrollArea>
      <Separator className="shrink-0" />
      <Button
        onClick={onGenerate}
        disabled={!intent.trim() || isGenerating}
        size="sm"
        className="w-full shrink-0"
      >
        {isGenerating ? "Generating\u2026" : "Generate"}
      </Button>
    </div>
  );
}
