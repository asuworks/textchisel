import type { LanguageModel } from "ai";
import type { Dimension, EvaluationScore, RewriteContext } from "@shared/types";
import { checkConvergence, checkLockFidelity } from "./convergence";
import type { LockDeviation, ConvergenceCheck } from "./convergence";

// --- Dependency injection types ---

export interface OrchestratorDeps {
  scoreAll: (input: {
    text: string;
    dimensions: Dimension[];
    model: LanguageModel;
  }) => Promise<Map<string, EvaluationScore>>;

  rewrite: (
    options: RewriteContext & { model: LanguageModel },
  ) => Promise<string>;
}

// --- Input / Output types ---

export interface OrchestratorInput {
  model: LanguageModel;
  intent: string;
  currentText: string;
  dimensions: Dimension[];
  currentScores: Record<string, EvaluationScore>;
  targetScores: Record<string, number>;
  lockedDimensionIds: Set<string>;
  deps: OrchestratorDeps;
  maxIterations?: number;
  convergenceTolerance?: number;
  lockTolerance?: number;
}

export interface OrchestratorStep {
  iteration: number;
  text: string;
  scores: Record<string, EvaluationScore>;
  convergence: ConvergenceCheck;
  lockDeviations: LockDeviation[];
}

export interface OrchestratorResult {
  steps: OrchestratorStep[];
  finalText: string;
  finalScores: Record<string, EvaluationScore>;
  converged: boolean;
  totalIterations: number;
}

function mapToRecord(
  map: Map<string, EvaluationScore>,
): Record<string, EvaluationScore> {
  const record: Record<string, EvaluationScore> = {};
  for (const [key, value] of map) {
    record[key] = value;
  }
  return record;
}

/**
 * Run the evaluate→rewrite loop until convergence or maxIterations.
 *
 * Each iteration:
 * 1. Rewrite text toward target scores
 * 2. Evaluate rewritten text on all dimensions
 * 3. Check convergence (are scores within tolerance of targets?)
 * 4. Check lock fidelity (did locked dimensions drift?)
 * 5. If converged or max iterations reached, stop
 *
 * The orchestrator does not import evaluation or rewriter modules directly.
 * Instead, scoring and rewriting functions are injected via `deps`.
 */
export async function runOrchestrationLoop(
  input: OrchestratorInput,
): Promise<OrchestratorResult> {
  const {
    model,
    intent,
    dimensions,
    targetScores,
    lockedDimensionIds,
    deps,
    maxIterations = 3,
    convergenceTolerance = 0,
    lockTolerance = 0,
  } = input;

  let currentText = input.currentText;
  let currentScores = input.currentScores;
  const steps: OrchestratorStep[] = [];

  // Check if already converged before any rewrite
  const initialCheck = checkConvergence(
    currentScores,
    targetScores,
    convergenceTolerance,
  );
  if (initialCheck.converged) {
    return {
      steps: [],
      finalText: currentText,
      finalScores: currentScores,
      converged: true,
      totalIterations: 0,
    };
  }

  for (let i = 0; i < maxIterations; i++) {
    // 1. Rewrite text toward targets
    const rewriteContext: RewriteContext = {
      intent,
      currentText,
      dimensions,
      currentScores,
      targetScores,
      lockedDimensionIds,
    };

    const newText = await deps.rewrite({ ...rewriteContext, model });

    // 2. Evaluate rewritten text
    const scoresMap = await deps.scoreAll({ text: newText, dimensions, model });
    const newScores = mapToRecord(scoresMap);

    // 3. Check convergence
    const convergence = checkConvergence(
      newScores,
      targetScores,
      convergenceTolerance,
    );

    // 4. Check lock fidelity
    const lockDeviations = checkLockFidelity(
      currentScores,
      newScores,
      lockedDimensionIds,
      lockTolerance,
    );

    // 5. Record step
    steps.push({
      iteration: i + 1,
      text: newText,
      scores: newScores,
      convergence,
      lockDeviations,
    });

    // 6. Update state for next iteration
    currentText = newText;
    currentScores = newScores;

    // 7. Exit if converged
    if (convergence.converged) {
      break;
    }
  }

  const lastStep = steps[steps.length - 1];

  return {
    steps,
    finalText: currentText,
    finalScores: currentScores,
    converged: lastStep?.convergence.converged ?? false,
    totalIterations: steps.length,
  };
}
