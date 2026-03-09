import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LanguageModel } from "ai";

/**
 * Integration test: dimensions → evaluation pipeline
 *
 * Verifies that generated dimensions can be persisted via CRUD,
 * then scored by the evaluation module, and scores cached.
 */

// Shared test DB setup (PGlite in-memory)
async function initTestDb() {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@shared/schema");

  const pglite = new PGlite();

  await pglite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      intent TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'drafting',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dimensions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES sessions(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 1.0,
      rubric JSONB,
      locked BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 0,
        eval_prompt TEXT,
        rewrite_hint TEXT
    );

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES sessions(id),
      version_num INTEGER NOT NULL,
      system_prompt TEXT NOT NULL,
      user_template TEXT NOT NULL,
      generated_text TEXT,
      scores JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS eval_step_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      version_id UUID NOT NULL REFERENCES prompt_versions(id),
      dimension_id UUID NOT NULL REFERENCES dimensions(id),
      score INTEGER NOT NULL,
      reasoning TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const drizzleDb = drizzle({ client: pglite, schema });
  return { pglite, db: drizzleDb, schema };
}

// Realistic mock data matching what an LLM would generate
const MOCK_GENERATED_DIMENSIONS = {
  dimensions: [
    {
      name: "Clarity",
      description: "How clearly the ideas are communicated",
      rubric: {
        "1": "Incomprehensible or incoherent",
        "2": "Confusing, requires multiple reads",
        "3": "Understandable but could be clearer",
        "4": "Clear and easy to follow",
        "5": "Exceptionally clear, immediately understood",
      },
    },
    {
      name: "Persuasiveness",
      description: "How effectively the text persuades the reader",
      rubric: {
        "1": "No persuasive elements",
        "2": "Weak arguments, unconvincing",
        "3": "Some persuasive elements present",
        "4": "Compelling arguments with evidence",
        "5": "Masterfully persuasive, irresistible logic",
      },
    },
    {
      name: "Structure",
      description: "How well organized the text is",
      rubric: {
        "1": "No discernible structure",
        "2": "Poorly organized",
        "3": "Basic structure present",
        "4": "Well organized with clear flow",
        "5": "Impeccable structure, perfect pacing",
      },
    },
  ],
};

describe("dimensions → evaluation integration", () => {
  let testDb: Awaited<ReturnType<typeof initTestDb>>;
  let testSessionId: string;
  let testVersionId: string;

  beforeEach(async () => {
    vi.resetModules();

    testDb = await initTestDb();

    // Mock ensureDb for both dimensions and evaluation modules
    vi.doMock("@/db", () => ({
      ensureDb: async () => testDb.db,
    }));

    // Create a test session
    const sessionResult = await testDb.pglite.query<{ id: string }>(
      "INSERT INTO sessions (intent) VALUES ('Write a persuasive essay about climate change') RETURNING id",
    );
    testSessionId = sessionResult.rows[0].id;

    // Create a test prompt version (needed for cache)
    const versionResult = await testDb.pglite.query<{ id: string }>(
      `INSERT INTO prompt_versions (session_id, version_num, system_prompt, user_template, generated_text)
       VALUES ($1, 1, 'You are a writer.', 'Write about {topic}', 'Climate change is the defining challenge of our generation.')
       RETURNING id`,
      [testSessionId],
    );
    testVersionId = versionResult.rows[0].id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (testDb?.pglite) {
      await testDb.pglite.close();
    }
  });

  it("should generate dimensions, persist them, and score text against them", async () => {
    // --- Step 1: Mock LLM for dimension generation ---
    const mockGenerateObject = vi
      .fn()
      // First call: dimension generation
      .mockResolvedValueOnce({ object: MOCK_GENERATED_DIMENSIONS })
      // Subsequent calls: evaluation scoring (one per dimension)
      .mockResolvedValueOnce({
        object: { score: 4, reasoning: "Clear and well-articulated ideas" },
      })
      .mockResolvedValueOnce({
        object: {
          score: 3,
          reasoning: "Some persuasive elements but lacks strong evidence",
        },
      })
      .mockResolvedValueOnce({
        object: {
          score: 5,
          reasoning: "Excellent organization with clear introduction and flow",
        },
      });

    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    // --- Step 2: Generate dimensions via LLM ---
    const { generateDimensions } = await import("@/dimensions/generate");
    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;

    const generated = await generateDimensions(
      "Write a persuasive essay about climate change",
      { model: fakeModel },
    );

    expect(generated.dimensions).toHaveLength(3);
    expect(generated.dimensions[0].name).toBe("Clarity");

    // --- Step 3: Persist dimensions via CRUD ---
    const { createDimensions, getDimensionsBySession } = await import(
      "@/dimensions/crud"
    );

    const persisted = await createDimensions(
      testSessionId,
      generated.dimensions,
    );

    expect(persisted).toHaveLength(3);
    expect(persisted[0].sessionId).toBe(testSessionId);
    expect(persisted[0].rubric).toBeDefined();

    // Verify retrieval
    const fetched = await getDimensionsBySession(testSessionId);
    expect(fetched).toHaveLength(3);
    expect(fetched[0].sortOrder).toBe(0);
    expect(fetched[1].sortOrder).toBe(1);
    expect(fetched[2].sortOrder).toBe(2);

    // --- Step 4: Score text against persisted dimensions ---
    const { scoreAllDimensions } = await import("@/evaluation/score");

    const sampleText =
      "Climate change is the defining challenge of our generation.";
    const scores = await scoreAllDimensions({
      text: sampleText,
      dimensions: fetched,
      model: fakeModel,
    });

    expect(scores.size).toBe(3);

    // Verify scores are keyed by dimension ID
    for (const dim of fetched) {
      expect(scores.has(dim.id)).toBe(true);
      const score = scores.get(dim.id)!;
      expect(score.score).toBeGreaterThanOrEqual(1);
      expect(score.score).toBeLessThanOrEqual(5);
      expect(score.reasoning).toBeTruthy();
    }

    // --- Step 5: Cache scores ---
    const { cacheScore, getCachedScoresForVersion, getCachedScore } =
      await import("@/evaluation/cache");

    for (const dim of fetched) {
      const evalScore = scores.get(dim.id)!;
      await cacheScore({
        versionId: testVersionId,
        dimensionId: dim.id,
        score: evalScore.score,
        reasoning: evalScore.reasoning,
        model: "test-model",
      });
    }

    // Verify cache retrieval
    const cached = await getCachedScoresForVersion(testVersionId);
    expect(cached).toHaveLength(3);

    // Verify individual cache lookup
    const firstDim = fetched[0];
    const cachedScore = await getCachedScore(testVersionId, firstDim.id);
    expect(cachedScore).not.toBeNull();
    expect(cachedScore!.score).toBe(scores.get(firstDim.id)!.score);
    expect(cachedScore!.reasoning).toBe(scores.get(firstDim.id)!.reasoning);
  });

  it("should compute score deltas between current and target scores", async () => {
    // Mock LLM
    const mockGenerateObject = vi
      .fn()
      .mockResolvedValueOnce({ object: MOCK_GENERATED_DIMENSIONS })
      .mockResolvedValueOnce({
        object: { score: 3, reasoning: "Average clarity" },
      })
      .mockResolvedValueOnce({
        object: { score: 2, reasoning: "Weak persuasion" },
      })
      .mockResolvedValueOnce({
        object: { score: 4, reasoning: "Good structure" },
      });

    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { generateDimensions } = await import("@/dimensions/generate");
    const { createDimensions } = await import("@/dimensions/crud");
    const { scoreAllDimensions } = await import("@/evaluation/score");
    const { scoreDelta } = await import("@/evaluation/normalize");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;

    // Generate → persist → score
    const generated = await generateDimensions("Persuasive essay", {
      model: fakeModel,
    });
    const dims = await createDimensions(testSessionId, generated.dimensions);
    const scores = await scoreAllDimensions({
      text: "Some sample text",
      dimensions: dims,
      model: fakeModel,
    });

    // Build current scores map and target scores
    const currentScores = new Map<string, number>();
    for (const [id, evalScore] of scores) {
      currentScores.set(id, evalScore.score);
    }

    const targetScores: Record<string, number> = {};
    for (const dim of dims) {
      targetScores[dim.id] = 5; // Target all 5s
    }

    // Compute deltas
    const deltas = scoreDelta(currentScores, targetScores);

    // Each delta should be target - current
    expect(deltas[dims[0].id]).toBe(2); // 5 - 3
    expect(deltas[dims[1].id]).toBe(3); // 5 - 2
    expect(deltas[dims[2].id]).toBe(1); // 5 - 4
  });

  it("should handle dimensions with different weights in weighted average", async () => {
    const mockGenerateObject = vi
      .fn()
      .mockResolvedValueOnce({ object: MOCK_GENERATED_DIMENSIONS });

    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { generateDimensions } = await import("@/dimensions/generate");
    const { createDimensions, updateDimension } = await import(
      "@/dimensions/crud"
    );
    const { computeWeightedAverage } = await import("@/evaluation/normalize");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;

    const generated = await generateDimensions("Essay", { model: fakeModel });
    const dims = await createDimensions(testSessionId, generated.dimensions);

    // Update weights: Clarity=2.0, Persuasiveness=1.0, Structure=1.0
    await updateDimension(dims[0].id, { weight: 2.0 });
    const updatedDim0 = { ...dims[0], weight: 2.0 };

    // Mock scores
    const scores = new Map([
      [dims[0].id, { score: 4, reasoning: "Good clarity" }],
      [dims[1].id, { score: 2, reasoning: "Weak persuasion" }],
      [dims[2].id, { score: 3, reasoning: "OK structure" }],
    ]);

    const avg = computeWeightedAverage(scores, [updatedDim0, dims[1], dims[2]]);

    // Weighted: (4*2 + 2*1 + 3*1) / (2+1+1) = 13/4 = 3.25
    expect(avg).toBeCloseTo(3.25);
  });
});
