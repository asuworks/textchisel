import { useCallback } from "react";
import { SESSION_STATUS } from "@shared/types";
import { useAppStore } from "@/store";
import { createSession, createPromptVersion, getNextVersionNum } from "@/db";
import { getModelConfig } from "./useSettings";
import {
  apiGenerateDimensions,
  apiGenerateDimensionPrompts,
  apiEvaluate,
  apiRewriteStream,
  apiRewritePlan,
  apiOrchestrate,
} from "./api";
import { DEFAULT_SCORE } from "@/evaluation/constants";

/** Convert Record<string, boolean> to string[] of locked IDs */
function lockedIds(locked: Record<string, boolean>): string[] {
  return Object.keys(locked).filter((k) => locked[k]);
}

/** Consume a ReadableStream<string>, updating streamingText incrementally */
async function consumeStream(
  stream: ReadableStream<string>,
  setStreamingText: (text: string) => void,
): Promise<string> {
  const reader = stream.getReader();
  let accumulated = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += value;
      setStreamingText(accumulated);
    }
  } finally {
    reader.releaseLock();
  }
  return accumulated;
}

/**
 * Custom hook that encapsulates all workflow callbacks
 * (generate, evaluate, regenerate, refine, orchestrate).
 *
 * Reads needed state from useAppStore selectors internally.
 */
export function useWorkflows() {
  const sessionId = useAppStore((s) => s.sessionId);
  const intent = useAppStore((s) => s.intent);
  const dimensions = useAppStore((s) => s.dimensions);
  const currentText = useAppStore((s) => s.currentText);
  const currentScores = useAppStore((s) => s.currentScores);
  const targetScores = useAppStore((s) => s.targetScores);
  const lockedDimensions = useAppStore((s) => s.lockedDimensions);

  const setSessionId = useAppStore((s) => s.setSessionId);
  const setDimensions = useAppStore((s) => s.setDimensions);
  const setCurrentText = useAppStore((s) => s.setCurrentText);
  const setCurrentScores = useAppStore((s) => s.setCurrentScores);
  const setStreamingText = useAppStore((s) => s.setStreamingText);
  const setError = useAppStore((s) => s.setError);
  const setStatus = useAppStore((s) => s.setSessionStatus);
  const setTargetScore = useAppStore((s) => s.setTargetScore);
  const updateDimension = useAppStore((s) => s.updateDimension);
  const createAndPersistDimensions = useAppStore(
    (s) => s.createAndPersistDimensions,
  );

  const handleGenerate = useCallback(async () => {
    setStatus(SESSION_STATUS.GENERATING);
    setError(null);
    try {
      const result = await apiGenerateDimensions(intent, getModelConfig());
      const session = await createSession(intent);
      const sid = session?.id ?? crypto.randomUUID();
      setSessionId(sid);

      const dims =
        (await createAndPersistDimensions(sid, result.dimensions)) ??
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
              getModelConfig(),
            );
            const updated = {
              ...dim,
              evalPrompt: prompts.evalPrompt,
              rewriteHint: prompts.rewriteHint,
              examples: prompts.examples ?? null,
            };
            updateDimension(dim.id, {
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
        targets[dim.id] = DEFAULT_SCORE;
        setTargetScore(dim.id, DEFAULT_SCORE);
      }
      setCurrentScores({});

      // Generate initial text based on intent and dimensions (streaming)
      setStatus(SESSION_STATUS.REFINING);
      const stream = await apiRewriteStream(
        {
          intent,
          currentText: "",
          dimensions: dimsWithPrompts,
          currentScores: {},
          targetScores: targets,
          lockedDimensionIds: [],
        },
        getModelConfig(),
      );
      const text = await consumeStream(stream, setStreamingText);
      setCurrentText(text);
      setStreamingText("");

      // Auto-evaluate the generated text
      setStatus(SESSION_STATUS.EVALUATING);
      const scores = await apiEvaluate(text, dimsWithPrompts, getModelConfig());
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

      setStatus(SESSION_STATUS.IDLE);
    } catch (err) {
      setError(String(err));
      setStatus(SESSION_STATUS.ERROR);
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
    createAndPersistDimensions,
    updateDimension,
  ]);

  const handleEvaluate = useCallback(async () => {
    setStatus(SESSION_STATUS.EVALUATING);
    setError(null);
    try {
      const scores = await apiEvaluate(
        currentText,
        dimensions,
        getModelConfig(),
      );
      setCurrentScores(scores);
      setStatus(SESSION_STATUS.IDLE);
    } catch (err) {
      setError(String(err));
      setStatus(SESSION_STATUS.ERROR);
    }
  }, [currentText, dimensions, setCurrentScores, setStatus, setError]);

  const handleRegenerate = useCallback(async () => {
    setStatus(SESSION_STATUS.REFINING);
    setError(null);
    try {
      const regenStream = await apiRewriteStream(
        {
          intent,
          currentText: "",
          dimensions,
          currentScores: {},
          targetScores,
          lockedDimensionIds: [],
        },
        getModelConfig(),
      );
      const text = await consumeStream(regenStream, setStreamingText);
      setCurrentText(text);
      setStreamingText("");

      setStatus(SESSION_STATUS.EVALUATING);
      const scores = await apiEvaluate(text, dimensions, getModelConfig());
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
      setStatus(SESSION_STATUS.IDLE);
    } catch (err) {
      setError(String(err));
      setStatus(SESSION_STATUS.ERROR);
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
    setStatus(SESSION_STATUS.REFINING);
    setStreamingText("");
    setError(null);
    try {
      // Tier 2: generate transition-aware rewrite plan
      const plan = await apiRewritePlan(
        {
          intent,
          currentText,
          dimensions,
          currentScores,
          targetScores,
          lockedDimensionIds: lockedIds(lockedDimensions),
        },
        getModelConfig(),
      );

      const refineStream = await apiRewriteStream(
        {
          intent,
          currentText,
          dimensions,
          currentScores,
          targetScores,
          lockedDimensionIds: lockedIds(lockedDimensions),
        },
        getModelConfig(),
      );
      const text = await consumeStream(refineStream, setStreamingText);
      setCurrentText(text);
      setStreamingText("");

      // Auto-evaluate the rewritten text
      setStatus(SESSION_STATUS.EVALUATING);
      const newScores = await apiEvaluate(text, dimensions, getModelConfig());
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
      setStatus(SESSION_STATUS.IDLE);
    } catch (err) {
      setError(String(err));
      setStatus(SESSION_STATUS.ERROR);
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
      setStatus(SESSION_STATUS.REFINING);
      setError(null);
      try {
        const result = await apiOrchestrate(
          {
            intent,
            currentText,
            dimensions,
            currentScores,
            targetScores,
            lockedDimensionIds: lockedIds(lockedDimensions),
            maxIterations: maxIter,
            convergenceTolerance: 1,
            lockTolerance: 1,
          },
          getModelConfig(),
        );

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
        setStatus(SESSION_STATUS.IDLE);
      } catch (err) {
        setError(String(err));
        setStatus(SESSION_STATUS.ERROR);
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

  return {
    handleGenerate,
    handleEvaluate,
    handleRegenerate,
    handleRefine,
    handleOrchestrate,
  };
}
