import { useCallback, useState } from "react";
import { useAppStore, type SuggestedDimension } from "@/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineEdit } from "@/components/ui/inline-edit";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { ChevronRight, Plus, Sparkles, Trash2, X, Loader2 } from "lucide-react";
import {
  apiGenerateSingleDimension,
  apiGenerateExamples,
  apiGenerateSuggestions,
} from "./api";
import type { Dimension } from "@shared/types";

type Step = "name" | "generating" | "editor";

interface AddDimensionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent: string;
}

export function AddDimensionDialog({
  open,
  onOpenChange,
  intent,
}: AddDimensionDialogProps) {
  const suggestions = useAppStore((s) => s.suggestedDimensions);
  const consumeSuggestion = useAppStore((s) => s.consumeSuggestion);
  const setSuggestedDimensions = useAppStore((s) => s.setSuggestedDimensions);
  const dimensions = useAppStore((s) => s.dimensions);
  const addDimension = useAppStore((s) => s.addDimension);
  const setTargetScore = useAppStore((s) => s.setTargetScore);
  const sessionId = useAppStore((s) => s.sessionId);

  const [step, setStep] = useState<Step>("name");
  const [nameInput, setNameInput] = useState("");
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [generatingExamples, setGeneratingExamples] = useState<Set<string>>(
    new Set(),
  );
  const [generatingAllExamples, setGeneratingAllExamples] = useState(false);

  // Working dimension being built in the editor
  const [draft, setDraft] = useState<{
    name: string;
    description: string;
    rubric: Record<string, string>;
    examples: Record<string, string> | null;
  } | null>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<
    number | null
  >(null);

  const reset = useCallback(() => {
    setStep("name");
    setNameInput("");
    setDraft(null);
    setSelectedSuggestionIndex(null);
    setGeneratingSuggestions(false);
    setGeneratingExamples(new Set());
  }, []);

  /** Generate 3 suggestions based on existing dimensions */
  const handleGenerateSuggestions = useCallback(async () => {
    setGeneratingSuggestions(true);
    try {
      const existingNames = dimensions.map((d) => d.name);
      const result = await apiGenerateSuggestions(intent, existingNames);
      setSuggestedDimensions(result.dimensions);
    } catch {
      // silent
    } finally {
      setGeneratingSuggestions(false);
    }
  }, [dimensions, intent, setSuggestedDimensions]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) reset();
      onOpenChange(open);
    },
    [onOpenChange, reset],
  );

  /** User selected a precomputed suggestion (defer consume until confirm) */
  const handleSelectSuggestion = useCallback(
    (suggestion: SuggestedDimension, index: number) => {
      setDraft({
        name: suggestion.name,
        description: suggestion.description,
        rubric: { ...suggestion.rubric },
        examples: null,
      });
      setSelectedSuggestionIndex(index);
      setStep("editor");
    },
    [],
  );

  /** User typed a name and chose "Generate rubric" */
  const handleGenerateRubric = useCallback(async () => {
    if (!nameInput.trim()) return;
    setStep("generating");
    try {
      const result = await apiGenerateSingleDimension(nameInput.trim(), intent);
      setDraft({
        name: result.name,
        description: result.description,
        rubric: result.rubric,
        examples: null,
      });
      setStep("editor");
    } catch {
      setStep("name"); // back to input on error
    }
  }, [nameInput, intent]);

  /** User typed a name and chose "Add manually" */
  const handleAddManually = useCallback(() => {
    if (!nameInput.trim()) return;
    setDraft({
      name: nameInput.trim(),
      description: "",
      rubric: {
        "1": "",
        "2": "",
        "3": "",
        "4": "",
        "5": "",
      },
      examples: null,
    });
    setStep("editor");
  }, [nameInput]);

  /** Update a field on the draft */
  const updateDraft = useCallback(
    (updates: Partial<NonNullable<typeof draft>>) => {
      setDraft((prev) => (prev ? { ...prev, ...updates } : prev));
    },
    [],
  );

  /** Generate examples for specific levels (or all) */
  const handleGenerateExamples = useCallback(
    async (levels?: string[]) => {
      if (!draft?.rubric) return;
      const isAll = !levels;
      const targetLevels = levels ?? Object.keys(draft.rubric);
      if (isAll) setGeneratingAllExamples(true);
      setGeneratingExamples((prev) => new Set([...prev, ...targetLevels]));
      try {
        const newExamples = await apiGenerateExamples(
          {
            name: draft.name,
            description: draft.description,
            rubric: draft.rubric,
          },
          intent,
          levels,
        );
        updateDraft({ examples: { ...draft.examples, ...newExamples } });
      } catch {
        // silent — user can retry
      } finally {
        if (isAll) setGeneratingAllExamples(false);
        setGeneratingExamples((prev) => {
          const next = new Set(prev);
          for (const l of targetLevels) next.delete(l);
          return next;
        });
      }
    },
    [draft, intent, updateDraft],
  );

  /** Commit the dimension to the store */
  const handleConfirm = useCallback(() => {
    if (!draft) return;
    const newDim: Dimension = {
      id: crypto.randomUUID(),
      sessionId: sessionId ?? "",
      name: draft.name,
      description: draft.description,
      rubric: draft.rubric,
      weight: 1.0,
      sortOrder: useAppStore.getState().dimensions.length,
      locked: false,
      evalPrompt: null,
      rewriteHint: null,
      examples: draft.examples,
    };
    addDimension(newDim);
    setTargetScore(newDim.id, 3);
    if (selectedSuggestionIndex != null) {
      consumeSuggestion(selectedSuggestionIndex);
    }
    handleOpenChange(false);
  }, [
    draft,
    sessionId,
    addDimension,
    setTargetScore,
    selectedSuggestionIndex,
    consumeSuggestion,
    handleOpenChange,
  ]);

  const stepTitle =
    step === "name"
      ? "Add Dimension"
      : step === "generating"
        ? "Generating…"
        : "Configure Dimension";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{stepTitle}</DialogTitle>
        </DialogHeader>

        {/* --- Step: Name input + suggestions --- */}
        {step === "name" && (
          <div className="space-y-4">
            {/* Custom name input */}
            <div className="space-y-2">
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Type a dimension name…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nameInput.trim()) {
                    handleGenerateRubric();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleGenerateRubric}
                  disabled={!nameInput.trim()}
                  className="gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate rubric
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleAddManually}
                  disabled={!nameInput.trim()}
                  className="text-muted-foreground"
                >
                  Add manually
                </Button>
              </div>
            </div>

            {/* Suggestions section */}
            <Separator />
            <div className="space-y-2">
              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    Suggestions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s, i) => (
                      <TooltipProvider key={i}>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                className="group flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs transition-colors hover:border-foreground/20 hover:bg-accent"
                                onClick={() => handleSelectSuggestion(s, i)}
                              />
                            }
                          >
                            {s.name}
                            <ChevronRight className="h-3 w-3 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-52">
                            {s.description}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateSuggestions}
                disabled={generatingSuggestions}
                className="w-full gap-1.5"
              >
                {generatingSuggestions ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {generatingSuggestions
                  ? "Generating…"
                  : suggestions.length > 0
                    ? "Regenerate suggestions"
                    : "Generate suggestions"}
              </Button>
            </div>
          </div>
        )}

        {/* --- Step: Generating skeleton --- */}
        {step === "generating" && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Separator />
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        )}

        {/* --- Step: Editor --- */}
        {step === "editor" && draft && (
          <div className="space-y-3">
            {/* Name + description */}
            <div className="space-y-1">
              <InlineEdit
                value={draft.name}
                onCommit={(name) => updateDraft({ name })}
                className="text-sm font-semibold"
              />
              <InlineEdit
                value={draft.description}
                onCommit={(description) => updateDraft({ description })}
                className="block text-xs text-muted-foreground"
                placeholder="Add description…"
              />
            </div>

            <Separator />

            {/* Rubric levels */}
            <RubricEditor
              rubric={draft.rubric}
              examples={draft.examples}
              generatingExamples={generatingExamples}
              generatingAllExamples={generatingAllExamples}
              onRubricChange={(rubric) => updateDraft({ rubric })}
              onExamplesChange={(examples) => updateDraft({ examples })}
              onGenerateExamples={handleGenerateExamples}
            />

            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("name");
                  setDraft(null);
                }}
                className="text-muted-foreground"
              >
                Back
              </Button>
              <Button size="sm" onClick={handleConfirm}>
                Add to chart
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Rubric Editor ---

interface RubricEditorProps {
  rubric: Record<string, string>;
  examples: Record<string, string> | null;
  generatingExamples: Set<string>;
  generatingAllExamples: boolean;
  onRubricChange: (rubric: Record<string, string>) => void;
  onExamplesChange: (examples: Record<string, string> | null) => void;
  onGenerateExamples: (levels?: string[]) => void;
}

function RubricEditor({
  rubric,
  examples,
  generatingExamples,
  generatingAllExamples,
  onRubricChange,
  onExamplesChange,
  onGenerateExamples,
}: RubricEditorProps) {
  const entries = Object.entries(rubric).sort(
    ([a], [b]) => Number(a) - Number(b),
  );
  const levelCount = entries.length;

  return (
    <TooltipProvider>
      {/* Rubric levels with inline examples */}
      <div className="space-y-0">
        {entries.map(([level, desc]) => {
          const example = examples?.[level];
          const isGenerating = generatingExamples.has(level);

          return (
            <div key={level} className="group flex items-start gap-2.5 py-2">
              {/* Level number */}
              <span className="w-3 shrink-0 pt-1 text-xs font-bold text-foreground/60">
                {level}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1 space-y-0.5">
                {/* Rubric description */}
                <InlineEdit
                  value={desc}
                  onCommit={(text) =>
                    onRubricChange({ ...rubric, [level]: text })
                  }
                  className="text-xs text-muted-foreground"
                  placeholder={`Level ${level}…`}
                />

                {/* Example row */}
                {example != null ? (
                  <div className="flex items-center gap-1.5">
                    <InlineEdit
                      value={example}
                      onCommit={(text) =>
                        onExamplesChange({ ...examples, [level]: text })
                      }
                      className="min-w-0 flex-1 text-[10px] italic text-muted-foreground/60"
                      placeholder={`Example for level ${level}…`}
                    />
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 hover:text-foreground"
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
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 hover:text-destructive"
                            onClick={() => {
                              const newExamples = { ...examples };
                              delete newExamples[level];
                              onExamplesChange(
                                Object.keys(newExamples).length > 0
                                  ? newExamples
                                  : null,
                              );
                            }}
                          />
                        }
                      >
                        <X className="h-1.5 w-1.5" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Remove example</TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      className="rounded px-1 py-1 leading-snug text-[10px] italic text-muted-foreground/40 hover:text-foreground"
                      onClick={() =>
                        onExamplesChange({ ...examples, [level]: "" })
                      }
                    >
                      + add
                    </button>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 hover:text-foreground"
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
                  </div>
                )}
              </div>

              {/* Delete level — top-aligned */}
              {levelCount > 2 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/20 hover:text-destructive"
                        onClick={() => {
                          const remaining = entries
                            .filter(([l]) => l !== level)
                            .map(([, d], i) => [String(i + 1), d] as const);
                          onRubricChange(Object.fromEntries(remaining));
                          if (examples) {
                            const newExamples: Record<string, string> = {};
                            const oldKeys = entries
                              .filter(([l]) => l !== level)
                              .map(([l]) => l);
                            oldKeys.forEach((oldKey, i) => {
                              if (examples[oldKey] != null) {
                                newExamples[String(i + 1)] = examples[oldKey];
                              }
                            });
                            onExamplesChange(
                              Object.keys(newExamples).length > 0
                                ? newExamples
                                : null,
                            );
                          }
                        }}
                      />
                    }
                  >
                    <Trash2 className="h-2 w-2" />
                  </TooltipTrigger>
                  <TooltipContent side="top">Delete level</TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: add level + generate all examples */}
      <div className="flex items-center gap-1.5 px-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-5 gap-1 px-1 text-[10px] text-muted-foreground"
          disabled={levelCount >= 7}
          onClick={() => {
            const nextKey = String(levelCount + 1);
            onRubricChange({ ...rubric, [nextKey]: "" });
          }}
        >
          <Plus className="h-2.5 w-2.5" />
          Add level
        </Button>
        <span className="text-[10px] text-muted-foreground/60">
          {levelCount}/7
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
            {generatingAllExamples ? "Generating…" : "Generate examples"}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Generate examples for all levels
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
