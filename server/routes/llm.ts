import { Router } from "express";
import { createModel } from "../model.js";
import { generateDimensions } from "../../src/dimensions/generate.js";
import { scoreAllDimensions } from "../../src/evaluation/score.js";
import { rewriteText, rewriteTextFull } from "../../src/rewriter/stream.js";
import {
  runOrchestrationLoop,
  type OrchestratorDeps,
} from "../../src/orchestrator/loop.js";

export const llmRouter = Router();

/** Extract provider/modelId from request body, defaulting from env */
function getModelConfig(body: Record<string, unknown>) {
  const provider =
    (body.provider as string) || process.env.AI_PROVIDER || "openai";
  const modelId = (body.modelId as string) || process.env.AI_MODEL || undefined;
  return createModel(provider, modelId);
}

// POST /api/llm/dimensions/generate
// Body: { intent: string, provider?, modelId? }
llmRouter.post("/dimensions/generate", async (req, res) => {
  try {
    const { intent } = req.body;
    if (!intent || typeof intent !== "string") {
      res.status(400).json({ error: "intent is required" });
      return;
    }
    const model = getModelConfig(req.body);
    const result = await generateDimensions(intent, { model });
    res.json(result);
  } catch (err) {
    console.error("dimensions/generate error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/llm/evaluate
// Body: { text: string, dimensions: Dimension[], provider?, modelId? }
llmRouter.post("/evaluate", async (req, res) => {
  try {
    const { text, dimensions } = req.body;
    if (!text || !dimensions) {
      res.status(400).json({ error: "text and dimensions are required" });
      return;
    }
    const model = getModelConfig(req.body);
    const scores = await scoreAllDimensions({ text, dimensions, model });
    // Convert Map to Record for JSON serialization
    const record: Record<string, { score: number; reasoning: string }> = {};
    for (const [key, value] of scores) {
      record[key] = value;
    }
    res.json(record);
  } catch (err) {
    console.error("evaluate error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/llm/rewrite
// Body: { intent, currentText, dimensions, currentScores, targetScores, lockedDimensionIds: string[], provider?, modelId? }
// Returns: SSE data stream (Vercel AI SDK format)
llmRouter.post("/rewrite", async (req, res) => {
  try {
    const {
      intent,
      currentText,
      dimensions,
      currentScores,
      targetScores,
      lockedDimensionIds,
    } = req.body;
    if (!intent || !currentText || !dimensions) {
      res
        .status(400)
        .json({ error: "intent, currentText, and dimensions are required" });
      return;
    }
    const model = getModelConfig(req.body);
    const result = rewriteText({
      model,
      intent,
      currentText,
      dimensions,
      currentScores: currentScores ?? {},
      targetScores: targetScores ?? {},
      lockedDimensionIds: new Set(lockedDimensionIds ?? []),
    });
    result.pipeDataStreamToResponse(res);
  } catch (err) {
    console.error("rewrite error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/llm/rewrite/full
// Same body as /rewrite but returns full text (non-streaming)
llmRouter.post("/rewrite/full", async (req, res) => {
  try {
    const {
      intent,
      currentText,
      dimensions,
      currentScores,
      targetScores,
      lockedDimensionIds,
    } = req.body;
    if (!intent || !currentText || !dimensions) {
      res
        .status(400)
        .json({ error: "intent, currentText, and dimensions are required" });
      return;
    }
    const model = getModelConfig(req.body);
    const text = await rewriteTextFull({
      model,
      intent,
      currentText,
      dimensions,
      currentScores: currentScores ?? {},
      targetScores: targetScores ?? {},
      lockedDimensionIds: new Set(lockedDimensionIds ?? []),
    });
    res.json({ text });
  } catch (err) {
    console.error("rewrite/full error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/llm/orchestrate
// Body: { intent, currentText, dimensions, currentScores, targetScores, lockedDimensionIds: string[], maxIterations?, convergenceTolerance?, lockTolerance?, provider?, modelId? }
llmRouter.post("/orchestrate", async (req, res) => {
  try {
    const {
      intent,
      currentText,
      dimensions,
      currentScores,
      targetScores,
      lockedDimensionIds,
      maxIterations,
      convergenceTolerance,
      lockTolerance,
    } = req.body;
    if (!intent || !currentText || !dimensions || !targetScores) {
      res.status(400).json({
        error: "intent, currentText, dimensions, and targetScores are required",
      });
      return;
    }
    const model = getModelConfig(req.body);

    // Wire real deps: evaluation.scoreAllDimensions + rewriter.rewriteTextFull
    const deps: OrchestratorDeps = {
      scoreAll: scoreAllDimensions,
      rewrite: async (options) => {
        return rewriteTextFull({ ...options, model });
      },
    };

    const result = await runOrchestrationLoop({
      model,
      intent,
      currentText,
      dimensions,
      currentScores: currentScores ?? {},
      targetScores,
      lockedDimensionIds: new Set(lockedDimensionIds ?? []),
      deps,
      maxIterations,
      convergenceTolerance,
      lockTolerance,
    });
    res.json(result);
  } catch (err) {
    console.error("orchestrate error:", err);
    res.status(500).json({ error: String(err) });
  }
});
