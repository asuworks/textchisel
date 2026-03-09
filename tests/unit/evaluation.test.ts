import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LanguageModel } from "ai";
import type { Dimension } from "@shared/types";

// ── scoreDimension tests ─────────────────────────────────────────────────────

describe("scoreDimension", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call generateObject with EvaluationScoreSchema", async () => {
    const mockResult = {
      object: { score: 4, reasoning: "Clear and well-structured" },
    };
    const mockGenerateObject = vi.fn().mockResolvedValue(mockResult);
    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { scoreDimension } = await import("@/evaluation/score");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    const dimension: Dimension = {
      id: "dim-1",
      sessionId: "sess-1",
      name: "Clarity",
      description: "How clear the writing is",
      weight: 1.0,
      rubric: { "1": "Unclear", "3": "Moderate", "5": "Crystal clear" },
      locked: false,
      sortOrder: 0,
    };

    const result = await scoreDimension({
      text: "Some sample text to evaluate",
      dimension,
      model: fakeModel,
    });

    expect(mockGenerateObject).toHaveBeenCalledOnce();

    const callArgs = mockGenerateObject.mock.calls[0][0];
    expect(callArgs.model).toBe(fakeModel);
    expect(callArgs.schema).toBeDefined();

    expect(result).toEqual({
      score: 4,
      reasoning: "Clear and well-structured",
    });
  });

  it("should include dimension name and description in the prompt", async () => {
    const mockGenerateObject = vi.fn().mockResolvedValue({
      object: { score: 3, reasoning: "Average" },
    });
    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { scoreDimension } = await import("@/evaluation/score");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    const dimension: Dimension = {
      id: "dim-1",
      sessionId: "sess-1",
      name: "Tone Consistency",
      description: "Whether the tone remains consistent throughout",
      weight: 1.0,
      rubric: { "1": "Inconsistent", "5": "Perfectly consistent" },
      locked: false,
      sortOrder: 0,
    };

    await scoreDimension({
      text: "Text to evaluate",
      dimension,
      model: fakeModel,
    });

    const callArgs = mockGenerateObject.mock.calls[0][0];
    // The prompt or system message should contain the dimension details
    const allText = `${callArgs.system || ""} ${callArgs.prompt || ""}`;
    expect(allText).toContain("Tone Consistency");
    expect(allText).toContain("Whether the tone remains consistent throughout");
  });

  it("should include rubric in the prompt when available", async () => {
    const mockGenerateObject = vi.fn().mockResolvedValue({
      object: { score: 3, reasoning: "OK" },
    });
    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { scoreDimension } = await import("@/evaluation/score");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    const dimension: Dimension = {
      id: "dim-1",
      sessionId: "sess-1",
      name: "Clarity",
      description: "How clear",
      weight: 1.0,
      rubric: {
        "1": "Very unclear",
        "2": "Somewhat unclear",
        "3": "Moderately clear",
        "4": "Clear",
        "5": "Crystal clear",
      },
      locked: false,
      sortOrder: 0,
    };

    await scoreDimension({
      text: "Text",
      dimension,
      model: fakeModel,
    });

    const callArgs = mockGenerateObject.mock.calls[0][0];
    const allText = `${callArgs.system || ""} ${callArgs.prompt || ""}`;
    expect(allText).toContain("Crystal clear");
    expect(allText).toContain("Very unclear");
  });

  it("should include the text to evaluate in the prompt", async () => {
    const mockGenerateObject = vi.fn().mockResolvedValue({
      object: { score: 5, reasoning: "Excellent" },
    });
    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { scoreDimension } = await import("@/evaluation/score");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    const dimension: Dimension = {
      id: "dim-1",
      sessionId: "sess-1",
      name: "Clarity",
      description: "How clear",
      weight: 1.0,
      rubric: null,
      locked: false,
      sortOrder: 0,
    };

    await scoreDimension({
      text: "The quick brown fox jumps over the lazy dog",
      dimension,
      model: fakeModel,
    });

    const callArgs = mockGenerateObject.mock.calls[0][0];
    const allText = `${callArgs.system || ""} ${callArgs.prompt || ""}`;
    expect(allText).toContain("The quick brown fox jumps over the lazy dog");
  });

  it("should propagate errors from generateObject", async () => {
    const mockGenerateObject = vi
      .fn()
      .mockRejectedValue(new Error("API rate limit"));
    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { scoreDimension } = await import("@/evaluation/score");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    const dimension: Dimension = {
      id: "dim-1",
      sessionId: "sess-1",
      name: "Clarity",
      description: "How clear",
      weight: 1.0,
      rubric: null,
      locked: false,
      sortOrder: 0,
    };

    await expect(
      scoreDimension({ text: "text", dimension, model: fakeModel }),
    ).rejects.toThrow("API rate limit");
  });
});

// ── scoreAllDimensions tests ─────────────────────────────────────────────────

describe("scoreAllDimensions", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should score all dimensions in parallel and return a Map keyed by dimension ID", async () => {
    const mockGenerateObject = vi
      .fn()
      .mockResolvedValueOnce({
        object: { score: 4, reasoning: "Good clarity" },
      })
      .mockResolvedValueOnce({
        object: { score: 3, reasoning: "Average tone" },
      })
      .mockResolvedValueOnce({
        object: { score: 5, reasoning: "Excellent structure" },
      });

    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { scoreAllDimensions } = await import("@/evaluation/score");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    const dims: Dimension[] = [
      {
        id: "dim-clarity",
        sessionId: "sess-1",
        name: "Clarity",
        description: "How clear",
        weight: 1.0,
        rubric: null,
        locked: false,
        sortOrder: 0,
      },
      {
        id: "dim-tone",
        sessionId: "sess-1",
        name: "Tone",
        description: "Tone quality",
        weight: 1.0,
        rubric: null,
        locked: false,
        sortOrder: 1,
      },
      {
        id: "dim-structure",
        sessionId: "sess-1",
        name: "Structure",
        description: "Overall structure",
        weight: 1.0,
        rubric: null,
        locked: false,
        sortOrder: 2,
      },
    ];

    const result = await scoreAllDimensions({
      text: "Sample text",
      dimensions: dims,
      model: fakeModel,
    });

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(3);
    expect(result.get("dim-clarity")).toEqual({
      score: 4,
      reasoning: "Good clarity",
    });
    expect(result.get("dim-tone")).toEqual({
      score: 3,
      reasoning: "Average tone",
    });
    expect(result.get("dim-structure")).toEqual({
      score: 5,
      reasoning: "Excellent structure",
    });

    // All three should be called (parallel)
    expect(mockGenerateObject).toHaveBeenCalledTimes(3);
  });

  it("should return an empty Map when given no dimensions", async () => {
    const mockGenerateObject = vi.fn();
    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { scoreAllDimensions } = await import("@/evaluation/score");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    const result = await scoreAllDimensions({
      text: "Text",
      dimensions: [],
      model: fakeModel,
    });

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("should propagate error if any dimension scoring fails", async () => {
    const mockGenerateObject = vi
      .fn()
      .mockResolvedValueOnce({
        object: { score: 4, reasoning: "Good" },
      })
      .mockRejectedValueOnce(new Error("Network error"));

    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { scoreAllDimensions } = await import("@/evaluation/score");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    const dims: Dimension[] = [
      {
        id: "dim-1",
        sessionId: "sess-1",
        name: "A",
        description: "d",
        weight: 1.0,
        rubric: null,
        locked: false,
        sortOrder: 0,
      },
      {
        id: "dim-2",
        sessionId: "sess-1",
        name: "B",
        description: "d",
        weight: 1.0,
        rubric: null,
        locked: false,
        sortOrder: 1,
      },
    ];

    await expect(
      scoreAllDimensions({ text: "Text", dimensions: dims, model: fakeModel }),
    ).rejects.toThrow("Network error");
  });
});

// ── normalizeScore tests ─────────────────────────────────────────────────────

describe("normalizeScore", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should clamp 0 to 1", async () => {
    const { normalizeScore } = await import("@/evaluation/normalize");
    expect(normalizeScore(0)).toBe(1);
  });

  it("should clamp 6 to 5", async () => {
    const { normalizeScore } = await import("@/evaluation/normalize");
    expect(normalizeScore(6)).toBe(5);
  });

  it("should round 2.4 down to 2", async () => {
    const { normalizeScore } = await import("@/evaluation/normalize");
    expect(normalizeScore(2.4)).toBe(2);
  });

  it("should round 2.5 up to 3", async () => {
    const { normalizeScore } = await import("@/evaluation/normalize");
    expect(normalizeScore(2.5)).toBe(3);
  });

  it("should clamp negative values to 1", async () => {
    const { normalizeScore } = await import("@/evaluation/normalize");
    expect(normalizeScore(-5)).toBe(1);
  });

  it("should clamp large values to 5", async () => {
    const { normalizeScore } = await import("@/evaluation/normalize");
    expect(normalizeScore(100)).toBe(5);
  });

  it("should pass through exact integers 1-5 unchanged", async () => {
    const { normalizeScore } = await import("@/evaluation/normalize");
    expect(normalizeScore(1)).toBe(1);
    expect(normalizeScore(3)).toBe(3);
    expect(normalizeScore(5)).toBe(5);
  });

  it("should round 4.6 up to 5", async () => {
    const { normalizeScore } = await import("@/evaluation/normalize");
    expect(normalizeScore(4.6)).toBe(5);
  });
});

// ── computeWeightedAverage tests ─────────────────────────────────────────────

describe("computeWeightedAverage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should compute simple average when all weights are equal", async () => {
    const { computeWeightedAverage } = await import("@/evaluation/normalize");

    const scores = new Map([
      ["dim-1", { score: 4, reasoning: "Good" }],
      ["dim-2", { score: 2, reasoning: "Poor" }],
    ]);
    const dims: Dimension[] = [
      {
        id: "dim-1",
        sessionId: "s",
        name: "A",
        description: "d",
        weight: 1.0,
        rubric: null,
        locked: false,
        sortOrder: 0,
      },
      {
        id: "dim-2",
        sessionId: "s",
        name: "B",
        description: "d",
        weight: 1.0,
        rubric: null,
        locked: false,
        sortOrder: 1,
      },
    ];

    const avg = computeWeightedAverage(scores, dims);
    expect(avg).toBe(3); // (4+2)/2
  });

  it("should weight scores by dimension weight", async () => {
    const { computeWeightedAverage } = await import("@/evaluation/normalize");

    const scores = new Map([
      ["dim-1", { score: 5, reasoning: "Excellent" }],
      ["dim-2", { score: 1, reasoning: "Poor" }],
    ]);
    const dims: Dimension[] = [
      {
        id: "dim-1",
        sessionId: "s",
        name: "A",
        description: "d",
        weight: 3.0,
        rubric: null,
        locked: false,
        sortOrder: 0,
      },
      {
        id: "dim-2",
        sessionId: "s",
        name: "B",
        description: "d",
        weight: 1.0,
        rubric: null,
        locked: false,
        sortOrder: 1,
      },
    ];

    const avg = computeWeightedAverage(scores, dims);
    // (5*3 + 1*1) / (3+1) = 16/4 = 4
    expect(avg).toBe(4);
  });

  it("should return 0 when no scores are provided", async () => {
    const { computeWeightedAverage } = await import("@/evaluation/normalize");

    const scores = new Map<string, { score: number; reasoning: string }>();
    const dims: Dimension[] = [];

    const avg = computeWeightedAverage(scores, dims);
    expect(avg).toBe(0);
  });

  it("should skip dimensions that have no score entry", async () => {
    const { computeWeightedAverage } = await import("@/evaluation/normalize");

    const scores = new Map([
      ["dim-1", { score: 4, reasoning: "Good" }],
      // dim-2 has no score
    ]);
    const dims: Dimension[] = [
      {
        id: "dim-1",
        sessionId: "s",
        name: "A",
        description: "d",
        weight: 1.0,
        rubric: null,
        locked: false,
        sortOrder: 0,
      },
      {
        id: "dim-2",
        sessionId: "s",
        name: "B",
        description: "d",
        weight: 1.0,
        rubric: null,
        locked: false,
        sortOrder: 1,
      },
    ];

    const avg = computeWeightedAverage(scores, dims);
    // Only dim-1 has a score: 4/1 = 4
    expect(avg).toBe(4);
  });
});

// ── scoreDelta tests ─────────────────────────────────────────────────────────

describe("scoreDelta", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should compute positive deltas when targets are higher", async () => {
    const { scoreDelta } = await import("@/evaluation/normalize");

    const current = new Map([
      ["dim-1", 2],
      ["dim-2", 3],
    ]);
    const target: Record<string, number> = {
      "dim-1": 4,
      "dim-2": 5,
    };

    const delta = scoreDelta(current, target);
    expect(delta["dim-1"]).toBe(2);
    expect(delta["dim-2"]).toBe(2);
  });

  it("should compute negative deltas when targets are lower", async () => {
    const { scoreDelta } = await import("@/evaluation/normalize");

    const current = new Map([
      ["dim-1", 5],
      ["dim-2", 4],
    ]);
    const target: Record<string, number> = {
      "dim-1": 3,
      "dim-2": 1,
    };

    const delta = scoreDelta(current, target);
    expect(delta["dim-1"]).toBe(-2);
    expect(delta["dim-2"]).toBe(-3);
  });

  it("should compute zero deltas when scores match targets", async () => {
    const { scoreDelta } = await import("@/evaluation/normalize");

    const current = new Map([
      ["dim-1", 3],
      ["dim-2", 4],
    ]);
    const target: Record<string, number> = {
      "dim-1": 3,
      "dim-2": 4,
    };

    const delta = scoreDelta(current, target);
    expect(delta["dim-1"]).toBe(0);
    expect(delta["dim-2"]).toBe(0);
  });

  it("should handle mixed positive and negative deltas", async () => {
    const { scoreDelta } = await import("@/evaluation/normalize");

    const current = new Map([
      ["dim-1", 2],
      ["dim-2", 5],
    ]);
    const target: Record<string, number> = {
      "dim-1": 5,
      "dim-2": 2,
    };

    const delta = scoreDelta(current, target);
    expect(delta["dim-1"]).toBe(3);
    expect(delta["dim-2"]).toBe(-3);
  });

  it("should only compute deltas for dimensions present in both current and target", async () => {
    const { scoreDelta } = await import("@/evaluation/normalize");

    const current = new Map([
      ["dim-1", 3],
      ["dim-2", 4],
    ]);
    const target: Record<string, number> = {
      "dim-1": 5,
      "dim-3": 2, // not in current
    };

    const delta = scoreDelta(current, target);
    expect(delta["dim-1"]).toBe(2);
    expect(delta["dim-2"]).toBeUndefined();
    expect(delta["dim-3"]).toBeUndefined();
  });
});

// ── cache tests ──────────────────────────────────────────────────────────────

describe("evaluation cache", () => {
  let testDb: Awaited<ReturnType<typeof initTestDb>>;
  let testSessionId: string;
  let testDimensionId: string;
  let testVersionId: string;

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

  beforeEach(async () => {
    vi.resetModules();
    testDb = await initTestDb();

    // Mock ensureDb to return our test database
    vi.doMock("@/db", () => ({
      ensureDb: async () => testDb.db,
    }));

    // Create a test session
    const sessResult = await testDb.pglite.query<{ id: string }>(
      "INSERT INTO sessions (intent) VALUES ('test intent') RETURNING id",
    );
    testSessionId = sessResult.rows[0].id;

    // Create a test dimension
    const dimResult = await testDb.pglite.query<{ id: string }>(
      `INSERT INTO dimensions (session_id, name, description) VALUES ('${testSessionId}', 'Clarity', 'How clear') RETURNING id`,
    );
    testDimensionId = dimResult.rows[0].id;

    // Create a test prompt version
    const verResult = await testDb.pglite.query<{ id: string }>(
      `INSERT INTO prompt_versions (session_id, version_num, system_prompt, user_template) VALUES ('${testSessionId}', 1, 'system', 'user') RETURNING id`,
    );
    testVersionId = verResult.rows[0].id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (testDb?.pglite) {
      await testDb.pglite.close();
    }
  });

  describe("cacheScore", () => {
    it("should insert an eval step and return the record", async () => {
      const { cacheScore } = await import("@/evaluation/cache");

      const result = await cacheScore({
        versionId: testVersionId,
        dimensionId: testDimensionId,
        score: 4,
        reasoning: "Well written",
        model: "gpt-4.1",
      });

      expect(result.score).toBe(4);
      expect(result.reasoning).toBe("Well written");
      expect(result.model).toBe("gpt-4.1");
      expect(result.versionId).toBe(testVersionId);
      expect(result.dimensionId).toBe(testDimensionId);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });
  });

  describe("getCachedScore", () => {
    it("should return cached score when it exists", async () => {
      const { cacheScore, getCachedScore } = await import("@/evaluation/cache");

      await cacheScore({
        versionId: testVersionId,
        dimensionId: testDimensionId,
        score: 3,
        reasoning: "Average",
        model: "gpt-4.1",
      });

      const cached = await getCachedScore(testVersionId, testDimensionId);

      expect(cached).not.toBeNull();
      expect(cached!.score).toBe(3);
      expect(cached!.reasoning).toBe("Average");
    });

    it("should return null when no cached score exists", async () => {
      const { getCachedScore } = await import("@/evaluation/cache");

      const cached = await getCachedScore(testVersionId, testDimensionId);

      expect(cached).toBeNull();
    });
  });

  describe("getCachedScoresForVersion", () => {
    it("should return all cached scores for a version", async () => {
      const { cacheScore, getCachedScoresForVersion } = await import(
        "@/evaluation/cache"
      );

      // Create a second dimension
      const dimResult = await testDb.pglite.query<{ id: string }>(
        `INSERT INTO dimensions (session_id, name, description) VALUES ('${testSessionId}', 'Tone', 'The tone') RETURNING id`,
      );
      const dim2Id = dimResult.rows[0].id;

      await cacheScore({
        versionId: testVersionId,
        dimensionId: testDimensionId,
        score: 4,
        reasoning: "Clear",
        model: "gpt-4.1",
      });

      await cacheScore({
        versionId: testVersionId,
        dimensionId: dim2Id,
        score: 3,
        reasoning: "OK tone",
        model: "gpt-4.1",
      });

      const scores = await getCachedScoresForVersion(testVersionId);

      expect(scores).toHaveLength(2);
      const scoreValues = scores.map((s) => s.score).sort();
      expect(scoreValues).toEqual([3, 4]);
    });

    it("should return empty array when no scores exist for version", async () => {
      const { getCachedScoresForVersion } = await import("@/evaluation/cache");

      const scores = await getCachedScoresForVersion(testVersionId);

      expect(scores).toEqual([]);
    });

    it("should not return scores from other versions", async () => {
      const { cacheScore, getCachedScoresForVersion } = await import(
        "@/evaluation/cache"
      );

      // Create another version
      const ver2Result = await testDb.pglite.query<{ id: string }>(
        `INSERT INTO prompt_versions (session_id, version_num, system_prompt, user_template) VALUES ('${testSessionId}', 2, 'system2', 'user2') RETURNING id`,
      );
      const version2Id = ver2Result.rows[0].id;

      await cacheScore({
        versionId: testVersionId,
        dimensionId: testDimensionId,
        score: 4,
        reasoning: "Version 1 score",
        model: "gpt-4.1",
      });

      await cacheScore({
        versionId: version2Id,
        dimensionId: testDimensionId,
        score: 2,
        reasoning: "Version 2 score",
        model: "gpt-4.1",
      });

      const v1Scores = await getCachedScoresForVersion(testVersionId);
      const v2Scores = await getCachedScoresForVersion(version2Id);

      expect(v1Scores).toHaveLength(1);
      expect(v1Scores[0].score).toBe(4);
      expect(v2Scores).toHaveLength(1);
      expect(v2Scores[0].score).toBe(2);
    });
  });
});
