import type { Dimension, EvaluationScore } from "@shared/types";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { InlineEdit } from "@/components/ui/inline-edit";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
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
  Lock,
  Plus,
  Sparkles,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { deleteRubricLevel, addRubricLevel } from "@/dimensions/rubric-helpers";

export interface DimensionPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: { getBoundingClientRect: () => DOMRect } | undefined;
  dimension: Dimension | undefined;
  currentScore: EvaluationScore | undefined;
  targetScore: number | undefined;
  isLocked: boolean;
  onTargetChange: (dimId: string, score: number) => void;
  onLockToggle: (dimId: string) => void;
  onRemove: (dimId: string) => void;
  onUpdate: (dimId: string, updates: Partial<Dimension>) => void;
  onGenerateExamples: (levels?: string[]) => void;
  generatingExamples: Set<string>;
  generatingAllExamples: boolean;
}

export function DimensionPopover({
  open,
  onOpenChange,
  anchor,
  dimension,
  currentScore,
  targetScore,
  isLocked,
  onTargetChange,
  onLockToggle,
  onRemove,
  onUpdate,
  onGenerateExamples,
  generatingExamples,
  generatingAllExamples,
}: DimensionPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverContent
        side="bottom"
        sideOffset={8}
        anchor={anchor}
        className="w-110 px-5 py-3"
      >
        {dimension && (
          <div className="space-y-2">
            {/* Name + score + actions */}
            <div className="flex items-center gap-2">
              <InlineEdit
                value={dimension.name}
                onCommit={(name) => onUpdate(dimension.id, { name })}
                className="min-w-0 flex-1 text-sm font-semibold"
              />
              <TooltipProvider>
                {dimension.rubric &&
                  (() => {
                    const maxLevel = Object.keys(dimension.rubric).length;
                    const score = currentScore?.score;
                    return score != null ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="shrink-0 cursor-default text-sm font-medium text-muted-foreground/60" />
                          }
                        >
                          {score}/{maxLevel}
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Current: {score} / Target: {targetScore ?? score}
                        </TooltipContent>
                      </Tooltip>
                    ) : null;
                  })()}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground"
                        onClick={() => onLockToggle(dimension.id)}
                      />
                    }
                  >
                    {isLocked ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isLocked ? "Unlock dimension" : "Lock dimension"}
                  </TooltipContent>
                </Tooltip>
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                            />
                          }
                        />
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Remove dimension</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove dimension</AlertDialogTitle>
                      <AlertDialogDescription>
                        Remove &ldquo;{dimension.name}&rdquo;? This will remove
                        it from all future evaluations.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          onRemove(dimension.id);
                          onOpenChange(false);
                        }}
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TooltipProvider>
            </div>

            {/* Description */}
            <InlineEdit
              value={dimension.description}
              onCommit={(description) =>
                onUpdate(dimension.id, { description })
              }
              className="block text-xs text-muted-foreground"
              placeholder="Add description..."
            />

            {/* Rubric levels */}
            {dimension.rubric && (
              <RubricLevels
                dimension={dimension}
                targetScore={targetScore}
                onTargetChange={onTargetChange}
                onUpdate={onUpdate}
                onGenerateExamples={onGenerateExamples}
                generatingExamples={generatingExamples}
                generatingAllExamples={generatingAllExamples}
              />
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Rubric levels sub-section, extracted for readability */
function RubricLevels({
  dimension,
  targetScore,
  onTargetChange,
  onUpdate,
  onGenerateExamples,
  generatingExamples,
  generatingAllExamples,
}: {
  dimension: Dimension;
  targetScore: number | undefined;
  onTargetChange: (dimId: string, score: number) => void;
  onUpdate: (dimId: string, updates: Partial<Dimension>) => void;
  onGenerateExamples: (levels?: string[]) => void;
  generatingExamples: Set<string>;
  generatingAllExamples: boolean;
}) {
  const rubric = dimension.rubric!;
  const entries = Object.entries(rubric).sort(
    ([a], [b]) => Number(a) - Number(b),
  );
  const levelCount = entries.length;

  return (
    <>
      <Separator />
      <div className="space-y-2">
        {entries.map(([level, desc]) => {
          const example = dimension.examples?.[level];
          const isGenerating = generatingExamples.has(level);
          const isTarget = targetScore === Number(level);
          return (
            <div
              key={level}
              className={`grid grid-cols-[auto_1fr_auto] items-start gap-x-2.5 gap-y-0.5 -mx-5 px-5 py-2 transition-colors ${isTarget ? "bg-slate-100 dark:bg-slate-800/30" : ""}`}
            >
              {/* Level number -- click to set as target */}
              <button
                className={`w-3 shrink-0 pt-1 cursor-pointer text-xs font-bold ${isTarget ? "text-slate-900 dark:text-slate-200" : "text-foreground/60 hover:text-foreground"}`}
                onClick={() => onTargetChange(dimension.id, Number(level))}
                title="Set as target"
              >
                {level}
              </button>
              {/* Rubric description */}
              <InlineEdit
                value={desc}
                onCommit={(text) => {
                  onUpdate(dimension.id, {
                    rubric: { ...rubric, [level]: text },
                  });
                }}
                className="min-w-0 text-xs text-muted-foreground"
                placeholder={`Level ${level}...`}
              />
              {/* Trash -- col 3, row 1 */}
              <TooltipProvider>
                <div className="flex flex-col items-center">
                  {levelCount > 2 ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 text-muted-foreground/20 hover:text-destructive"
                            onClick={() => {
                              const { rubric: newRubric, examples } =
                                deleteRubricLevel(
                                  rubric,
                                  dimension.examples ?? null,
                                  level,
                                );
                              onUpdate(dimension.id, {
                                rubric: newRubric,
                                examples,
                              });
                              const remaining = Object.keys(newRubric).length;
                              if (
                                targetScore != null &&
                                targetScore > remaining
                              ) {
                                onTargetChange(dimension.id, remaining);
                              }
                            }}
                          />
                        }
                      >
                        <Trash2 className="h-2 w-2" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Delete level</TooltipContent>
                    </Tooltip>
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                </div>
                {/* Empty col 1, row 2 */}
                <div />
                {/* Example -- col 2, row 2 */}
                {example != null ? (
                  <InlineEdit
                    value={example}
                    onCommit={(text) => {
                      onUpdate(dimension.id, {
                        examples: { ...dimension.examples, [level]: text },
                      });
                    }}
                    className="min-w-0 text-[10px] italic text-muted-foreground/60"
                    placeholder={`Example for level ${level}...`}
                  />
                ) : (
                  <button
                    className="justify-self-start rounded px-1 py-0.5 text-[10px] italic text-muted-foreground/40 hover:text-foreground"
                    onClick={() => {
                      onUpdate(dimension.id, {
                        examples: { ...dimension.examples, [level]: "" },
                      });
                    }}
                  >
                    + add
                  </button>
                )}
                {/* Example actions -- col 3, row 2 */}
                <div className="flex flex-col items-center gap-0.5">
                  {example != null ? (
                    <>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-3.5 w-3.5 text-muted-foreground/30 hover:text-destructive"
                              onClick={() => {
                                const examples = { ...dimension.examples };
                                delete examples[level];
                                onUpdate(dimension.id, {
                                  examples:
                                    Object.keys(examples).length > 0
                                      ? examples
                                      : null,
                                });
                              }}
                            />
                          }
                        >
                          <X className="h-1.5 w-1.5" />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Remove example
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-3.5 w-3.5 text-muted-foreground/30 hover:text-foreground"
                              disabled={isGenerating}
                              onClick={() => onGenerateExamples([level])}
                            />
                          }
                        >
                          <Sparkles
                            className={`h-1.5 w-1.5 ${isGenerating ? "animate-spin" : ""}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Regenerate example
                        </TooltipContent>
                      </Tooltip>
                    </>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-3.5 w-3.5 text-muted-foreground/30 hover:text-foreground"
                            disabled={isGenerating}
                            onClick={() => onGenerateExamples([level])}
                          />
                        }
                      >
                        <Sparkles
                          className={`h-1.5 w-1.5 ${isGenerating ? "animate-spin" : ""}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Generate example
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TooltipProvider>
            </div>
          );
        })}
      </div>
      {/* Footer: add level + generate all */}
      <TooltipProvider>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground"
                  disabled={levelCount >= 7}
                  onClick={() => {
                    onUpdate(dimension.id, {
                      rubric: addRubricLevel(rubric),
                    });
                  }}
                />
              }
            >
              <Plus className="h-3 w-3" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Add level</TooltipContent>
          </Tooltip>
          <span className="text-[10px] text-muted-foreground">
            {levelCount} levels
          </span>
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground"
                  disabled={generatingAllExamples}
                  onClick={() => onGenerateExamples()}
                />
              }
            >
              <Sparkles
                className={`h-2.5 w-2.5 ${generatingAllExamples ? "animate-spin" : ""}`}
              />
              {generatingAllExamples ? "Generating..." : "Generate examples"}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Generate examples for all levels
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </>
  );
}
