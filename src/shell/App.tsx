import { useCallback, useMemo, useState } from "react";
import { SESSION_STATUS } from "@shared/types";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Settings2 } from "lucide-react";
import { IntentPanel } from "./IntentPanel";
import { ChartPanel } from "./ChartPanel";
import { TextPanel } from "./TextPanel";
import { SettingsDialog } from "./SettingsDialog";
import { getModelConfig } from "./useSettings";
import { AddDimensionDialog } from "./AddDimensionDialog";
import { apiGenerateExamples } from "./api";
import { useWorkflows } from "./useWorkflows";
import { DimensionPopover } from "./DimensionPopover";

export default function App() {
  // Business state from Zustand store
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
  const setIntent = useAppStore((s) => s.setIntent);
  const setCurrentText = useAppStore((s) => s.setCurrentText);
  const clearError = useAppStore((s) => s.clearError);
  const setTargetScore = useAppStore((s) => s.setTargetScore);
  const updateDimension = useAppStore((s) => s.updateDimension);
  const removeDimension = useAppStore((s) => s.removeDimension);
  const toggleLock = useAppStore((s) => s.toggleLock);

  // Workflows
  const {
    handleGenerate,
    handleEvaluate,
    handleRegenerate,
    handleRefine,
    handleOrchestrate,
  } = useWorkflows();

  // Popover state
  const [selectedDimId, setSelectedDimId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const [generatingExamples, setGeneratingExamples] = useState<Set<string>>(
    new Set(),
  );
  const [generatingAllExamples, setGeneratingAllExamples] = useState(false);
  const selectedDim = dimensions.find((d) => d.id === selectedDimId);

  const virtualAnchor = useMemo(() => {
    if (!popoverAnchor) return undefined;
    return { getBoundingClientRect: () => popoverAnchor };
  }, [popoverAnchor]);

  const handleDimensionClick = useCallback(
    (dimId: string, anchorRect: DOMRect) => {
      setSelectedDimId(dimId);
      setPopoverAnchor(anchorRect);
      setPopoverOpen(true);
    },
    [],
  );

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
          getModelConfig(),
        );
        const merged = { ...selectedDim.examples, ...newExamples };
        updateDimension(selectedDim.id, { examples: merged });
      } catch {
        // silent -- user can retry
      } finally {
        if (isAll) setGeneratingAllExamples(false);
        setGeneratingExamples((prev) => {
          const next = new Set(prev);
          for (const l of targetLevels) next.delete(l);
          return next;
        });
      }
    },
    [selectedDim, intent, updateDimension],
  );

  const hasDimensions = dimensions.length > 0;
  const hasText = currentText.trim().length > 0;
  const hasScores = Object.keys(currentScores).length > 0;

  const [addDimDialogOpen, setAddDimDialogOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
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
                isGenerating={status === SESSION_STATUS.GENERATING}
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
              <DimensionPopover
                open={popoverOpen}
                onOpenChange={setPopoverOpen}
                anchor={virtualAnchor}
                dimension={selectedDim}
                currentScore={
                  selectedDim ? currentScores[selectedDim.id] : undefined
                }
                targetScore={
                  selectedDim ? targetScores[selectedDim.id] : undefined
                }
                isLocked={
                  selectedDim
                    ? !!lockedDimensions[selectedDim.id]
                    : false
                }
                onTargetChange={setTargetScore}
                onLockToggle={toggleLock}
                onRemove={removeDimension}
                onUpdate={updateDimension}
                onGenerateExamples={handleGenerateExamples}
                generatingExamples={generatingExamples}
                generatingAllExamples={generatingAllExamples}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize="30%" minSize="15%">
            <div className="flex h-full flex-col p-4">
              <TextPanel
                text={currentText}
                onTextChange={setCurrentText}
                isStreaming={status === SESSION_STATUS.REFINING}
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
