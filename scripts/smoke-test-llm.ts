/**
 * Smoke test for LLM API endpoints.
 *
 * Prerequisites:
 *   - Server running: npm run dev:server (port 3001)
 *   - .env with OPENAI_API_KEY or ANTHROPIC_API_KEY
 *   - Optionally set AI_PROVIDER=anthropic and AI_MODEL=claude-sonnet-4-5-20250514
 *
 * Usage: npx tsx scripts/smoke-test-llm.ts
 */

const BASE = "http://localhost:3001/api/llm";

interface DimRaw {
  name: string;
  description: string;
  rubric: { score: number; description: string }[];
}

async function post(path: string, body: unknown, timeoutMs = 60_000) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${path}: ${text}`);
  }
  return res.json();
}

async function main() {
  const intent = "Write a professional email declining a meeting";

  // 1. Generate dimensions
  console.log("1. Generate dimensions...");
  const dimResult = await post("/dimensions/generate", { intent });
  const rawDims: DimRaw[] = dimResult.dimensions;
  console.log(
    `   ${rawDims.length} dimensions:`,
    rawDims.map((d) => d.name),
  );

  // Build Dimension objects with fake IDs for subsequent calls
  const dimensions = rawDims.map((d, i) => ({
    id: `dim-${i}`,
    sessionId: "smoke",
    name: d.name,
    description: d.description,
    weight: 1.0,
    locked: false,
    rubric: d.rubric,
    sortOrder: i,
    createdAt: new Date().toISOString(),
  }));

  const sampleText =
    "Hi, I won't be able to make the meeting tomorrow. Sorry about that.";

  // 2. Evaluate text
  console.log("\n2. Evaluate text...");
  const scores = await post("/evaluate", { text: sampleText, dimensions });
  for (const [id, s] of Object.entries(scores)) {
    const val = s as { score: number; reasoning: string };
    console.log(`   ${id}: ${val.score}/5 — ${val.reasoning.slice(0, 80)}`);
  }

  // 3. Rewrite (full, non-streaming)
  console.log("\n3. Rewrite text (full)...");
  const targetScores: Record<string, number> = {};
  for (const dim of dimensions) {
    targetScores[dim.id] = 5;
  }
  const rewriteResult = await post("/rewrite/full", {
    intent,
    currentText: sampleText,
    dimensions,
    currentScores: scores,
    targetScores,
    lockedDimensionIds: [],
  });
  console.log("   Rewritten:", rewriteResult.text?.slice(0, 200));

  // 4. Orchestrate (evaluate→rewrite loop)
  console.log("\n4. Orchestrate (max 2 iterations)...");
  const orchResult = await post("/orchestrate", {
    intent,
    currentText: sampleText,
    dimensions,
    currentScores: scores,
    targetScores,
    lockedDimensionIds: [],
    maxIterations: 2,
  });
  console.log(
    `   ${orchResult.totalIterations} iterations, converged: ${orchResult.converged}`,
  );
  console.log("   Final text:", orchResult.finalText?.slice(0, 200));

  console.log("\nSmoke test complete.");
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
