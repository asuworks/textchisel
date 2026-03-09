import { useCallback } from "react";
import type { Dimension, EvaluationScore } from "@shared/types";
import { useAppStore } from "@/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { InlineEdit } from "@/components/ui/inline-edit";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

const MAX_DIMENSIONS = 12;

export function DimensionList() {
  const dimensions = useAppStore((s) => s.dimensions);
  const currentScores = useAppStore((s) => s.currentScores);
  const targetScores = useAppStore((s) => s.targetScores);
  const lockedDimensions = useAppStore((s) => s.lockedDimensions);
  const updateDimension = useAppStore((s) => s.updateDimension);
  const addDimension = useAppStore((s) => s.addDimension);
  const removeDimension = useAppStore((s) => s.removeDimension);
  const toggleLock = useAppStore((s) => s.toggleLock);
  const setTargetScore = useAppStore((s) => s.setTargetScore);
  const sessionId = useAppStore((s) => s.sessionId);

  const handleAdd = useCallback(() => {
    const newDim: Dimension = {
      id: crypto.randomUUID(),
      sessionId: sessionId ?? "",
      name: "New Dimension",
      description: "Describe what this dimension measures",
      rubric: {
        "1": "Poor",
        "2": "Below average",
        "3": "Average",
        "4": "Good",
        "5": "Excellent",
      },
      weight: 1.0,
      sortOrder: dimensions.length,
      locked: false,
      evalPrompt: null,
      rewriteHint: null,
    };
    addDimension(newDim);
    setTargetScore(newDim.id, 3);
  }, [sessionId, dimensions.length, addDimension, setTargetScore]);

  if (dimensions.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <h3 className="shrink-0 text-sm font-medium text-foreground">
          Dimensions
        </h3>
        <ScrollArea className="min-h-0 flex-1">
          <ul className="space-y-1.5 pr-3">
            {dimensions.map((dim) => (
              <DimensionCard
                key={dim.id}
                dim={dim}
                evalScore={currentScores[dim.id]}
                target={targetScores[dim.id]}
                locked={!!lockedDimensions[dim.id]}
                onUpdate={updateDimension}
                onRemove={removeDimension}
                onToggleLock={toggleLock}
              />
            ))}
          </ul>
        </ScrollArea>
        {dimensions.length < MAX_DIMENSIONS && (
          <Button
            variant="outline"
            size="sm"
            className="w-full shrink-0"
            onClick={handleAdd}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Dimension
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}

interface DimensionCardProps {
  dim: Dimension;
  evalScore: EvaluationScore | undefined;
  target: number | undefined;
  locked: boolean;
  onUpdate: (
    id: string,
    updates: Partial<Pick<Dimension, "name" | "description" | "rubric">>,
  ) => void;
  onRemove: (id: string) => void;
  onToggleLock: (id: string) => void;
}

export function DimensionCard({
  dim,
  evalScore,
  target,
  locked,
  onUpdate,
  onRemove,
  onToggleLock,
}: DimensionCardProps) {
  const handleRubricChange = useCallback(
    (level: string, text: string) => {
      const rubric = { ...(dim.rubric ?? {}), [level]: text };
      onUpdate(dim.id, { rubric });
    },
    [dim.id, dim.rubric, onUpdate],
  );

  return (
    <li className="group space-y-2 rounded-lg border border-border p-3">
      {/* Header: name + delete */}
      <div className="flex items-center gap-2">
        <InlineEdit
          value={dim.name}
          onCommit={(name) => onUpdate(dim.id, { name })}
          className="flex-1 text-sm font-semibold text-foreground"
        />
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              />
            }
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove dimension</AlertDialogTitle>
              <AlertDialogDescription>
                Remove &ldquo;{dim.name}&rdquo;? This will remove it from all
                future evaluations.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onRemove(dim.id)}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Description */}
      <InlineEdit
        value={dim.description}
        onCommit={(description) => onUpdate(dim.id, { description })}
        className="block text-xs leading-relaxed text-muted-foreground"
        placeholder="Add description\u2026"
      />

      {/* Controls row: scores + lock */}
      <div className="flex items-center gap-2">
        {evalScore && (
          <Badge variant="secondary" className="text-xs">
            Score: {evalScore.score}
          </Badge>
        )}
        {target != null && (
          <Badge
            variant="outline"
            className="border-rose-200 bg-rose-50 text-xs text-rose-600"
          >
            Target: {target}
          </Badge>
        )}
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">
                {locked ? "Locked" : "Lock"}
              </span>
              <Switch
                checked={locked}
                onCheckedChange={() => onToggleLock(dim.id)}
                className="scale-75"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">
              {locked ? "Unlock" : "Lock"} this dimension during refinement
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Rubric levels */}
      {dim.rubric && Object.keys(dim.rubric).length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-180" />
            Rubric levels
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1.5 space-y-1 pl-4">
              {Object.entries(dim.rubric ?? {})
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([level, desc]) => (
                  <div key={level} className="flex items-baseline gap-2">
                    <span className="w-3 shrink-0 text-xs font-semibold text-muted-foreground">
                      {level}
                    </span>
                    <InlineEdit
                      value={desc}
                      onCommit={(text) => handleRubricChange(level, text)}
                      className="text-xs text-muted-foreground"
                      placeholder={`Level ${level} description\u2026`}
                    />
                  </div>
                ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </li>
  );
}
