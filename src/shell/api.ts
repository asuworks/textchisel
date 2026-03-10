import type {
  Dimension,
  DimensionPrompts,
  EvaluationScore,
  GeneratedDimensions,
  RewritePlan,
} from "@shared/types";
import type { OrchestratorResult } from "@/orchestrator";

interface ModelConfig {
  provider?: string;
  modelId?: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Test connection to the configured provider */
export async function apiTestConnection(
  config: ModelConfig,
): Promise<{ ok: boolean; model: string; error?: string }> {
  const res = await fetch("/api/llm/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return res.json();
}

/** Generate evaluation dimensions from user intent */
export async function apiGenerateDimensions(
  intent: string,
  config?: ModelConfig & { count?: number },
): Promise<GeneratedDimensions> {
  const res = await fetch("/api/llm/dimensions/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, ...config }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to generate dimensions");
  }
  return res.json();
}

/** Generate 3 suggestion dimensions complementing existing ones */
export async function apiGenerateSuggestions(
  intent: string,
  existingNames: string[],
  config?: ModelConfig,
): Promise<GeneratedDimensions> {
  const res = await fetch("/api/llm/dimensions/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, existingNames, ...config }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to generate suggestions");
  }
  return res.json();
}

/** Generate a single dimension's description + rubric from a name */
export async function apiGenerateSingleDimension(
  name: string,
  intent: string,
  config?: ModelConfig,
): Promise<{
  name: string;
  description: string;
  rubric: Record<string, string>;
}> {
  const res = await fetch("/api/llm/dimensions/generate-single", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, intent, ...config }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to generate dimension");
  }
  return res.json();
}

/** Evaluate text against dimensions, returns scores keyed by dimension ID */
export async function apiEvaluate(
  text: string,
  dimensions: Dimension[],
  config?: ModelConfig,
): Promise<Record<string, EvaluationScore>> {
  const res = await fetch("/api/llm/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, dimensions, ...config }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to evaluate");
  }
  return res.json();
}

/** Rewrite text (non-streaming) */
export async function apiRewriteFull(
  params: {
    intent: string;
    currentText: string;
    dimensions: Dimension[];
    currentScores: Record<string, EvaluationScore>;
    targetScores: Record<string, number>;
    lockedDimensionIds: string[];
    rewritePlan?: RewritePlan;
  },
  config?: ModelConfig,
): Promise<string> {
  const res = await fetch("/api/llm/rewrite/full", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, ...config }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to rewrite");
  }
  const data = await res.json();
  return data.text;
}

/** Rewrite text with streaming — returns a ReadableStream of text chunks */
export async function apiRewriteStream(
  params: {
    intent: string;
    currentText: string;
    dimensions: Dimension[];
    currentScores: Record<string, EvaluationScore>;
    targetScores: Record<string, number>;
    lockedDimensionIds: string[];
  },
  config?: ModelConfig,
): Promise<ReadableStream<string>> {
  const res = await fetch("/api/llm/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, ...config }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to start rewrite stream");
  }
  if (!res.body) {
    throw new Error("No response body for streaming");
  }
  return res.body.pipeThrough(new TextDecoderStream());
}

/** Generate Tier 1 meta-prompts for a dimension */
export async function apiGenerateDimensionPrompts(
  dimension: {
    name: string;
    description: string;
    rubric: Record<string, string>;
  },
  intent: string,
  config?: ModelConfig,
): Promise<DimensionPrompts> {
  const res = await fetch("/api/llm/prompts/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dimension, intent, ...config }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to generate dimension prompts");
  }
  return res.json();
}

/** Generate calibration examples for specific rubric levels (or all) */
export async function apiGenerateExamples(
  dimension: {
    name: string;
    description: string;
    rubric: Record<string, string>;
  },
  intent: string,
  levels?: string[],
  config?: ModelConfig,
): Promise<Record<string, string>> {
  const res = await fetch("/api/llm/prompts/examples", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dimension, intent, levels, ...config }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to generate examples");
  }
  return res.json();
}

/** Generate Tier 2 rewrite plan */
export async function apiRewritePlan(
  params: {
    intent: string;
    currentText: string;
    dimensions: Dimension[];
    currentScores: Record<string, EvaluationScore>;
    targetScores: Record<string, number>;
    lockedDimensionIds: string[];
  },
  config?: ModelConfig,
): Promise<RewritePlan> {
  const res = await fetch("/api/llm/rewrite/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, ...config }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to generate rewrite plan");
  }
  return res.json();
}

/** Run full orchestration loop */
export async function apiOrchestrate(
  params: {
    intent: string;
    currentText: string;
    dimensions: Dimension[];
    currentScores: Record<string, EvaluationScore>;
    targetScores: Record<string, number>;
    lockedDimensionIds: string[];
    maxIterations?: number;
    convergenceTolerance?: number;
    lockTolerance?: number;
  },
  config?: ModelConfig,
): Promise<OrchestratorResult> {
  const res = await fetch("/api/llm/orchestrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, ...config }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to orchestrate");
  }
  return res.json();
}
