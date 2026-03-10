import { useCallback, useMemo, useState } from "react";
import { useAppStore } from "@/store";
import { createSession, createPromptVersion, getNextVersionNum } from "@/db";
import { createDimensions } from "@/dimensions/crud";
import { Button } from "@/components/ui/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { InlineEdit } from "@/components/ui/inline-edit";
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
import { Plus, Settings2, Sparkles, Trash2, X } from "lucide-react";
import { IntentPanel } from "./IntentPanel";
import { ChartPanel } from "./ChartPanel";
import { TextPanel } from "./TextPanel";
import { SettingsDialog } from "./SettingsDialog";
import { AddDimensionDialog } from "./AddDimensionDialog";
import {
  apiGenerateDimensions,
  apiGenerateDimensionPrompts,
  apiGenerateExamples,
  apiEvaluate,
  apiRewriteFull,
  apiRewritePlan,
  apiOrchestrate,
} from "./api";
import { updateDimension as dbUpdateDimension } from "@/dimensions/crud";

/** Convert Record<string, boolean> to string[] of locked IDs */
function lockedIds(locked: Record<string, boolean>): string[] {
  return Object.keys(locked).filter((k) => locked[k]);
}

export default function App() {
  // All business state from Zustand store
  const sessionId = useAppStore((s) => s.sessionId);
  const intent = useAppStore((s) => s.intent);
  const dimensions = useAppStore((s) => s.dimensions);
  const currentText = useAppStore((s) => s.currentText);
  const currentScores = useAppStore((s) => s.currentScores);
  const streamingText = useAppStore((s) => s.streamingText);
  const error = useAppStore((s) => s.error);
  const status = useAppStore((s) => s.sessionStatus);
  const targetScores = useAppStore((s) => s.targetScores);
  const lockedDimensions = useAppStore((s) => s.lockedDimensions);

  // Actions
  const setSessionId = useAppStore((s) => s.setSessionId);
  const setIntent = useAppStore((s) => s.setIntent);
  const setDimensions = useAppStore((s) => s.setDimensions);
  const setCurrentText = useAppStore((s) => s.setCurrentText);
  const setCurrentScores = useAppStore((s) => s.setCurrentScores);
  const setStreamingText = useAppStore((s) => s.setStreamingText);
  const setError = useAppStore((s) => s.setError);
  const setStatus = useAppStore((s) => s.setSessionStatus);
  const setTargetScore = useAppStore((s) => s.setTargetScore);
  const clearError = useAppStore((s) => s.clearError);

  const [selectedDimId, setSelectedDimId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const [generatingExamples, setGeneratingExamples] = useState<Set<string>>(
    new Set(),
  ); // level keys being generated
  const [generatingAllExamples, setGeneratingAllExamples] = useState(false);
  const selectedDim = dimensions.find((d) => d.id === selectedDimId);

  // Virtual anchor for popover positioning — returns a getBoundingClientRect function
  const virtualAnchor = useMemo(() => {
    if (!popoverAnchor) return undefined;
    return {
      getBoundingClientRect: () => popoverAnchor,
    };
  }, [popoverAnchor]);

  const handleDimensionClick = useCallback(
    (dimId: string, anchorRect: DOMRect) => {
      setSelectedDimId(dimId);
      setPopoverAnchor(anchorRect);
      setPopoverOpen(true);
    },
    [],
  );

  /** Generate examples for specific levels (or all) of the selected dimension */
  const handleGenerateExamples = useCallback(
    async (levels?: string[]) => {
      if (!selectedDim?.rubric) return;
      const isAll = !levels;
      const targetLevels = levels ?? Object.keys(selectedDim.rubric);
      if (isAll) setGeneratingAllExamples(true);
      setGeneratingExamples((prev) => new Set([...prev, ...targetLevels]));
      try {
        const newExamples = await apiGenerateExamples(
          {
            name: selectedDim.name,
            description: selectedDim.description,
            rubric: selectedDim.rubric,
          },
          intent,
          levels,
        );
        const merged = { ...selectedDim.examples, ...newExamples };
        useAppStore
          .getState()
          .updateDimension(selectedDim.id, { examples: merged });
        await dbUpdateDimension(selectedDim.id, { examples: merged });
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
    [selectedDim, intent],
  );

  const hasDimensions = dimensions.length > 0;
  const hasText = currentText.trim().length > 0;
  const hasScores = Object.keys(currentScores).length > 0;

  const [addDimDialogOpen, setAddDimDialogOpen] = useState(false);

  const handleGenerate = useCallback(async () => {
    setStatus("generating");
    setError(null);
    try {
      const result = await apiGenerateDimensions(intent);
      const session = await createSession(intent);
      const sid = session?.id ?? crypto.randomUUID();
      setSessionId(sid);

      const dims =
        (await createDimensions(sid, result.dimensions)) ??
        result.dimensions.map((d, i) => ({
          id: crypto.randomUUID(),
          sessionId: sid,
          name: d.name,
          description: d.description,
          rubric: d.rubric,
          weight: 1.0,
          locked: false,
          sortOrder: i,
          evalPrompt: null,
          rewriteHint: null,
          examples: null,
        }));

      // Tier 1: generate meta-prompts for each dimension (parallel)
      const dimsWithPrompts = await Promise.all(
        dims.map(async (dim) => {
          if (!dim.rubric) return dim;
          try {
            const prompts = await apiGenerateDimensionPrompts(
              {
                name: dim.name,
                description: dim.description,
                rubric: dim.rubric,
              },
              intent,
            );
            const updated = {
              ...dim,
              evalPrompt: prompts.evalPrompt,
              rewriteHint: prompts.rewriteHint,
              examples: prompts.examples ?? null,
            };
            await dbUpdateDimension(dim.id, {
              evalPrompt: prompts.evalPrompt,
              rewriteHint: prompts.rewriteHint,
              examples: prompts.examples ?? null,
            });
            return updated;
          } catch {
            return dim; // fallback: use dimension without meta-prompts
          }
        }),
      );
      setDimensions(dimsWithPrompts);

      const targets: Record<string, number> = {};
      for (const dim of dimsWithPrompts) {
        targets[dim.id] = 3;
        setTargetScore(dim.id, 3);
      }
      setCurrentScores({});

      // Generate initial text based on intent and dimensions (use dimsWithPrompts for Tier 1 rewriteHints)
      setStatus("refining");
      const text = await apiRewriteFull({
        intent,
        currentText: "",
        dimensions: dimsWithPrompts,
        currentScores: {},
        targetScores: targets,
        lockedDimensionIds: [],
      });
      setCurrentText(text);

      // Auto-evaluate the generated text (use dimsWithPrompts for Tier 1 evalPrompts)
      setStatus("evaluating");
      const scores = await apiEvaluate(text, dimsWithPrompts);
      setCurrentScores(scores);

      if (sid) {
        const versionNum = await getNextVersionNum(sid);
        await createPromptVersion({
          sessionId: sid,
          versionNum,
          systemPrompt: "",
          userTemplate: intent,
          generatedText: text,
          scores: Object.fromEntries(
            Object.entries(scores).map(([id, s]) => [id, s.score]),
          ),
        });
      }

      setStatus("idle");
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, [
    intent,
    setSessionId,
    setDimensions,
    setTargetScore,
    setCurrentScores,
    setCurrentText,
    setStatus,
    setError,
  ]);

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
  }, [currentText, dimensions, setCurrentScores, setStatus, setError]);

  const handleRegenerate = useCallback(async () => {
    setStatus("refining");
    setError(null);
    try {
      const text = await apiRewriteFull({
        intent,
        currentText: "",
        dimensions,
        currentScores: {},
        targetScores,
        lockedDimensionIds: [],
      });
      setCurrentText(text);

      setStatus("evaluating");
      const scores = await apiEvaluate(text, dimensions);
      setCurrentScores(scores);

      if (sessionId) {
        const versionNum = await getNextVersionNum(sessionId);
        await createPromptVersion({
          sessionId,
          versionNum,
          systemPrompt: "",
          userTemplate: intent,
          generatedText: text,
          scores: Object.fromEntries(
            Object.entries(scores).map(([id, s]) => [id, s.score]),
          ),
        });
      }
      setStatus("idle");
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, [
    intent,
    dimensions,
    targetScores,
    sessionId,
    setCurrentText,
    setCurrentScores,
    setStatus,
    setError,
  ]);

  const handleRefine = useCallback(async () => {
    setStatus("refining");
    setStreamingText("");
    setError(null);
    try {
      // Tier 2: generate transition-aware rewrite plan
      const plan = await apiRewritePlan({
        intent,
        currentText,
        dimensions,
        currentScores,
        targetScores,
        lockedDimensionIds: lockedIds(lockedDimensions),
      });

      const text = await apiRewriteFull({
        intent,
        currentText,
        dimensions,
        currentScores,
        targetScores,
        lockedDimensionIds: lockedIds(lockedDimensions),
        rewritePlan: plan,
      });
      setCurrentText(text);
      setStreamingText("");

      // Auto-evaluate the rewritten text
      setStatus("evaluating");
      const newScores = await apiEvaluate(text, dimensions);
      setCurrentScores(newScores);

      if (sessionId) {
        const versionNum = await getNextVersionNum(sessionId);
        await createPromptVersion({
          sessionId,
          versionNum,
          systemPrompt: "",
          userTemplate: intent,
          generatedText: text,
          scores: Object.fromEntries(
            Object.entries(newScores).map(([id, s]) => [id, s.score]),
          ),
        });
      }
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
    sessionId,
    setCurrentText,
    setCurrentScores,
    setStreamingText,
    setStatus,
    setError,
  ]);

  const handleOrchestrate = useCallback(
    async (maxIter: number = 3) => {
      setStatus("refining");
      setError(null);
      try {
        const result = await apiOrchestrate({
          intent,
          currentText,
          dimensions,
          currentScores,
          targetScores,
          lockedDimensionIds: lockedIds(lockedDimensions),
          maxIterations: maxIter,
          convergenceTolerance: 1,
          lockTolerance: 1,
        });

        setCurrentText(result.finalText);
        setCurrentScores(result.finalScores);

        if (sessionId) {
          const versionNum = await getNextVersionNum(sessionId);
          await createPromptVersion({
            sessionId,
            versionNum,
            systemPrompt: "",
            userTemplate: intent,
            generatedText: result.finalText,
            scores: Object.fromEntries(
              Object.entries(result.finalScores).map(([id, s]) => [
                id,
                s.score,
              ]),
            ),
          });
        }
        setStatus("idle");
      } catch (err) {
        setError(String(err));
        setStatus("error");
      }
    },
    [
      intent,
      currentText,
      dimensions,
      currentScores,
      targetScores,
      lockedDimensions,
      sessionId,
      setCurrentText,
      setCurrentScores,
      setStatus,
      setError,
    ],
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — replaces header */}
      <aside className="flex w-12 shrink-0 flex-col items-center gap-4 border-r border-border bg-card py-4">
        <span className="text-xs font-bold tracking-tight text-foreground [writing-mode:vertical-lr] rotate-180">
          textchisel
        </span>
        <div className="flex-1" />
        <SettingsDialog
          trigger={
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings2 className="h-4 w-4" />
            </Button>
          }
        />
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {error && (
          <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-destructive">
            {error}
            <Button
              variant="link"
              size="sm"
              onClick={clearError}
              className="ml-3 h-auto p-0 text-destructive underline"
            >
              Dismiss
            </Button>
          </div>
        )}

        <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize="30%" minSize="15%" maxSize="35%">
            <aside className="flex h-full flex-col gap-4 bg-card p-4">
              <IntentPanel
                intent={intent}
                onIntentChange={setIntent}
                onGenerate={handleGenerate}
                isGenerating={status === "generating"}
              />
            </aside>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize="40%" minSize="30%">
            <div className="relative flex h-full flex-col overflow-hidden">
              <div className="min-h-0 flex-1 p-2">
                <ChartPanel
                  dimensions={dimensions}
                  currentScores={currentScores}
                  onDimensionClick={handleDimensionClick}
                  onAddDimension={() => setAddDimDialogOpen(true)}
                />
              </div>
              {/* Per-dimension popover (opens on label click, anchored to label position) */}
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverContent
                  side="bottom"
                  sideOffset={8}
                  anchor={virtualAnchor}
                  className="w-80 px-5 py-3"
                >
                  {selectedDim && (
                    <div className="space-y-2">
                      {/* Name + score + actions */}
                      <div className="flex items-center gap-2">
                        <InlineEdit
                          value={selectedDim.name}
                          onCommit={(name) =>
                            useAppStore
                              .getState()
                              .updateDimension(selectedDim.id, { name })
                          }
                          className="min-w-0 flex-1 text-sm font-semibold"
                        />
                        {selectedDim.rubric &&
                          (() => {
                            const maxLevel = Object.keys(
                              selectedDim.rubric,
                            ).length;
                            const score = currentScores[selectedDim.id]?.score;
                            return score != null ? (
                              <span className="shrink-0 text-sm font-medium text-muted-foreground/60">
                                {score}/{maxLevel}
                              </span>
                            ) : null;
                          })()}
                        <Switch
                          checked={!!lockedDimensions[selectedDim.id]}
                          onCheckedChange={() =>
                            useAppStore.getState().toggleLock(selectedDim.id)
                          }
                          className="scale-75"
                        />
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                              />
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Remove dimension
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove &ldquo;{selectedDim.name}&rdquo;? This
                                will remove it from all future evaluations.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel autoFocus>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  useAppStore
                                    .getState()
                                    .removeDimension(selectedDim.id);
                                  setPopoverOpen(false);
                                }}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      {/* Description */}
                      <InlineEdit
                        value={selectedDim.description}
                        onCommit={(description) =>
                          useAppStore
                            .getState()
                            .updateDimension(selectedDim.id, { description })
                        }
                        className="block text-xs text-muted-foreground"
                        placeholder="Add description…"
                      />

                      {/* Rubric levels */}
                      {selectedDim.rubric &&
                        (() => {
                          const entries = Object.entries(
                            selectedDim.rubric,
                          ).sort(([a], [b]) => Number(a) - Number(b));
                          const levelCount = entries.length;
                          return (
                            <>
                              <Separator />
                              <div className="space-y-2">
                                {entries.map(([level, desc]) => {
                                  const example = selectedDim.examples?.[level];
                                  const isGenerating =
                                    generatingExamples.has(level);
                                  const isTarget =
                                    targetScores[selectedDim.id] ===
                                    Number(level);
                                  return (
                                    <div
                                      key={level}
                                      className={`flex items-start gap-2.5 -mx-5 px-5 py-2 transition-colors ${isTarget ? "bg-slate-100 dark:bg-slate-800/30" : ""}`}
                                    >
                                      {/* Level number — click to set as target */}
                                      <button
                                        className={`w-3 shrink-0 pt-1 cursor-pointer text-xs font-bold ${isTarget ? "text-slate-900 dark:text-slate-200" : "text-foreground/60 hover:text-foreground"}`}
                                        onClick={() =>
                                          setTargetScore(
                                            selectedDim.id,
                                            Number(level),
                                          )
                                        }
                                        title="Set as target"
                                      >
                                        {level}
                                      </button>
                                      {/* Content */}
                                      <TooltipProvider>
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                          {/* Rubric description */}
                                          <InlineEdit
                                            value={desc}
                                            onCommit={(text) => {
                                              const rubric = {
                                                ...selectedDim.rubric,
                                                [level]: text,
                                              };
                                              useAppStore
                                                .getState()
                                                .updateDimension(
                                                  selectedDim.id,
                                                  { rubric },
                                                );
                                            }}
                                            className="text-xs text-muted-foreground"
                                            placeholder={`Level ${level}…`}
                                          />
                                          {/* Example row — inline with action buttons */}
                                          {example != null ? (
                                            <div className="flex items-center gap-1.5">
                                              <InlineEdit
                                                value={example}
                                                onCommit={(text) => {
                                                  const examples = {
                                                    ...selectedDim.examples,
                                                    [level]: text,
                                                  };
                                                  useAppStore
                                                    .getState()
                                                    .updateDimension(
                                                      selectedDim.id,
                                                      { examples },
                                                    );
                                                }}
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
                                                      onClick={() =>
                                                        handleGenerateExamples([
                                                          level,
                                                        ])
                                                      }
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
                                                        const examples = {
                                                          ...selectedDim.examples,
                                                        };
                                                        delete examples[level];
                                                        useAppStore
                                                          .getState()
                                                          .updateDimension(
                                                            selectedDim.id,
                                                            {
                                                              examples:
                                                                Object.keys(
                                                                  examples,
                                                                ).length > 0
                                                                  ? examples
                                                                  : null,
                                                            },
                                                          );
                                                      }}
                                                    />
                                                  }
                                                >
                                                  <X className="h-2 w-2" />
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                  Remove example
                                                </TooltipContent>
                                              </Tooltip>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                className="rounded px-1 py-1 leading-snug text-[10px] italic text-muted-foreground/40 hover:text-foreground"
                                                onClick={() => {
                                                  const examples = {
                                                    ...selectedDim.examples,
                                                    [level]: "",
                                                  };
                                                  useAppStore
                                                    .getState()
                                                    .updateDimension(
                                                      selectedDim.id,
                                                      { examples },
                                                    );
                                                }}
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
                                                      onClick={() =>
                                                        handleGenerateExamples([
                                                          level,
                                                        ])
                                                      }
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
                                      </TooltipProvider>
                                      {/* Delete level — vertically centered */}
                                      {levelCount > 2 && (
                                        <Tooltip>
                                          <TooltipProvider>
                                            <TooltipTrigger
                                              render={
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/20 hover:text-destructive"
                                                  onClick={() => {
                                                    const remaining = entries
                                                      .filter(
                                                        ([l]) => l !== level,
                                                      )
                                                      .map(
                                                        ([, d], i) =>
                                                          [
                                                            String(i + 1),
                                                            d,
                                                          ] as const,
                                                      );
                                                    const rubric =
                                                      Object.fromEntries(
                                                        remaining,
                                                      );
                                                    const oldExamples =
                                                      selectedDim.examples ??
                                                      {};
                                                    const newExamples: Record<
                                                      string,
                                                      string
                                                    > = {};
                                                    const oldKeys = entries
                                                      .filter(
                                                        ([l]) => l !== level,
                                                      )
                                                      .map(([l]) => l);
                                                    oldKeys.forEach(
                                                      (oldKey, i) => {
                                                        if (
                                                          oldExamples[oldKey] !=
                                                          null
                                                        ) {
                                                          newExamples[
                                                            String(i + 1)
                                                          ] =
                                                            oldExamples[oldKey];
                                                        }
                                                      },
                                                    );
                                                    useAppStore
                                                      .getState()
                                                      .updateDimension(
                                                        selectedDim.id,
                                                        {
                                                          rubric,
                                                          examples:
                                                            Object.keys(
                                                              newExamples,
                                                            ).length > 0
                                                              ? newExamples
                                                              : null,
                                                        },
                                                      );
                                                    const newMax =
                                                      remaining.length;
                                                    const curTarget =
                                                      targetScores[
                                                        selectedDim.id
                                                      ];
                                                    if (
                                                      curTarget != null &&
                                                      curTarget > newMax
                                                    ) {
                                                      setTargetScore(
                                                        selectedDim.id,
                                                        newMax,
                                                      );
                                                    }
                                                  }}
                                                />
                                              }
                                            >
                                              <Trash2 className="h-2 w-2" />
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                              Delete level
                                            </TooltipContent>
                                          </TooltipProvider>
                                        </Tooltip>
                                      )}
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
                                            const nextKey = String(
                                              levelCount + 1,
                                            );
                                            const rubric = {
                                              ...selectedDim.rubric,
                                              [nextKey]: `Level ${nextKey} description`,
                                            };
                                            useAppStore
                                              .getState()
                                              .updateDimension(selectedDim.id, {
                                                rubric,
                                              });
                                          }}
                                        />
                                      }
                                    >
                                      <Plus className="h-3 w-3" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                      Add level
                                    </TooltipContent>
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
                                          onClick={() =>
                                            handleGenerateExamples()
                                          }
                                        />
                                      }
                                    >
                                      <Sparkles
                                        className={`h-2.5 w-2.5 ${generatingAllExamples ? "animate-spin" : ""}`}
                                      />
                                      {generatingAllExamples
                                        ? "Generating…"
                                        : "Generate examples"}
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                      Generate examples for all levels
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </TooltipProvider>
                            </>
                          );
                        })()}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize="30%" minSize="15%">
            <div className="flex h-full flex-col p-4">
              <TextPanel
                text={currentText}
                onTextChange={setCurrentText}
                isStreaming={status === "refining"}
                streamingText={streamingText}
                status={status}
                canEvaluate={hasDimensions && hasText}
                canRegenerate={hasDimensions}
                canRefine={hasScores}
                canRefineLoop={hasScores}
                onEvaluate={handleEvaluate}
                onRegenerate={handleRegenerate}
                onRefine={handleRefine}
                onRefineLoop={handleOrchestrate}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Add Dimension dialog */}
      <AddDimensionDialog
        open={addDimDialogOpen}
        onOpenChange={setAddDimDialogOpen}
        intent={intent}
      />
    </div>
  );
}
