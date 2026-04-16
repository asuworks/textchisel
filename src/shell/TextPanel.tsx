import { useState, useCallback } from "react";
import { Copy, Check, RotateCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface TextPanelProps {
  text: string;
  onTextChange: (text: string) => void;
  isStreaming: boolean;
  streamingText: string;
  status: string;
  canEvaluate: boolean;
  canRegenerate: boolean;
  canRefine: boolean;
  canRefineLoop: boolean;
  onEvaluate: () => void;
  onRegenerate: () => void;
  onRefine: () => void;
  onRefineLoop: (maxIterations: number) => void;
}

export function TextPanel({
  text,
  onTextChange,
  isStreaming,
  streamingText,
  status,
  canEvaluate,
  canRegenerate,
  canRefine,
  canRefineLoop,
  onEvaluate,
  onRegenerate,
  onRefine,
  onRefineLoop,
}: TextPanelProps) {
  const displayText = isStreaming ? streamingText + "▍" : text;
  const [copied, setCopied] = useState(false);
  const [loopIterations, setLoopIterations] = useState(3);
  const [loopOpen, setLoopOpen] = useState(false);
  const busy = status === "evaluating" || status === "refining";

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onEvaluate}
                    disabled={!canEvaluate || busy}
                  />
                }
              >
                {status === "evaluating" ? "Evaluating…" : "Evaluate"}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Score text against all dimensions
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRegenerate}
                    disabled={!canRegenerate || busy}
                  />
                }
              >
                {status === "refining" && !canRefine
                  ? "Regenerating…"
                  : "Regenerate"}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Generate new text from scratch
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="sm"
                    onClick={onRefine}
                    disabled={!canRefine || busy}
                  />
                }
              >
                {status === "refining" && canRefine ? "Refining…" : "Refine"}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Rewrite to move scores toward targets
              </TooltipContent>
            </Tooltip>
            <Popover open={loopOpen} onOpenChange={setLoopOpen}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canRefineLoop || busy}
                        />
                      }
                    />
                  }
                >
                  <RotateCw className="mr-1 h-3.5 w-3.5" />
                  {busy && canRefineLoop ? "Fitting…" : "Target Fit"}
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Iteratively refine until targets are met
                </TooltipContent>
              </Tooltip>
              <PopoverContent className="w-56 space-y-3 p-4">
                <div className="text-sm font-medium">Max iterations</div>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[loopIterations]}
                    onValueChange={(v) =>
                      setLoopIterations(Array.isArray(v) ? v[0] : v)
                    }
                    min={1}
                    max={10}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-5 text-center font-mono text-sm">
                    {loopIterations}
                  </span>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setLoopOpen(false);
                    onRefineLoop(loopIterations);
                  }}
                >
                  Start
                </Button>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            {text.trim().length > 0 && !isStreaming && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={handleCopy}
                    />
                  }
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Copy text to clipboard
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        {status === "refining" && !text.trim() && !streamingText ? (
          <div className="min-h-0 flex-1 space-y-3 p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-9/12" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-8/12" />
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <Textarea
              className="min-h-full resize-none border-0 bg-transparent px-0 font-mono text-sm shadow-none focus-visible:ring-0"
              value={displayText}
              onChange={(e) => onTextChange(e.target.value)}
              readOnly={isStreaming}
              placeholder="Text will appear here after generation…"
            />
          </ScrollArea>
        )}
      </div>
    </TooltipProvider>
  );
}
