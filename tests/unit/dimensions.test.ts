import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LanguageModel } from "ai";

// ── generateDimensions tests ──────────────────────────────────────────────────

describe("generateDimensions", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call generateObject with the correct schema and prompt", async () => {
    const mockResult = {
      object: {
        dimensions: [
          {
            name: "Clarity",
            description: "How clear the writing is",
            rubric: {
              "1": "Very unclear",
              "2": "Somewhat unclear",
              "3": "Moderately clear",
              "4": "Clear",
              "5": "Crystal clear",
            },
          },
        ],
      },
    };

    const mockGenerateObject = vi.fn().mockResolvedValue(mockResult);
    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { generateDimensions } = await import("@/dimensions/generate");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    const result = await generateDimensions("Write a persuasive essay", {
      model: fakeModel,
    });

    // Verify generateObject was called
    expect(mockGenerateObject).toHaveBeenCalledOnce();

    // Verify the call arguments
    const callArgs = mockGenerateObject.mock.calls[0][0];

    // Must pass the model
    expect(callArgs.model).toBe(fakeModel);

    // Must include the user intent in the prompt
    expect(callArgs.prompt).toContain("Write a persuasive essay");

    // Must pass a system prompt
    expect(callArgs.system).toBeDefined();
    expect(typeof callArgs.system).toBe("string");
    expect(callArgs.system.length).toBeGreaterThan(0);

    // Must pass the DimensionGenerationSchema
    expect(callArgs.schema).toBeDefined();

    // Result should be the generated dimensions
    expect(result).toEqual(mockResult.object);
  });

  it("should include guidance for 4-6 dimensions in the system prompt", async () => {
    const mockGenerateObject = vi.fn().mockResolvedValue({
      object: { dimensions: [] },
    });
    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { generateDimensions } = await import("@/dimensions/generate");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    await generateDimensions("Write a poem", { model: fakeModel });

    const callArgs = mockGenerateObject.mock.calls[0][0];
    const systemPrompt: string = callArgs.system;

    // System prompt should mention generating 4-6 dimensions
    expect(systemPrompt).toMatch(/4.*6|four.*six/i);
  });

  it("should include guidance for rubric levels 1-5 in the system prompt", async () => {
    const mockGenerateObject = vi.fn().mockResolvedValue({
      object: { dimensions: [] },
    });
    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { generateDimensions } = await import("@/dimensions/generate");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    await generateDimensions("Technical documentation", { model: fakeModel });

    const callArgs = mockGenerateObject.mock.calls[0][0];
    const systemPrompt: string = callArgs.system;

    // System prompt should mention rubric with levels 1-5
    expect(systemPrompt).toMatch(/rubric/i);
    expect(systemPrompt).toMatch(/1.*5|one.*five/i);
  });

  it("should include guidance for independent dimensions in the system prompt", async () => {
    const mockGenerateObject = vi.fn().mockResolvedValue({
      object: { dimensions: [] },
    });
    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { generateDimensions } = await import("@/dimensions/generate");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    await generateDimensions("Blog post", { model: fakeModel });

    const callArgs = mockGenerateObject.mock.calls[0][0];
    const systemPrompt: string = callArgs.system;

    // Should ask for independent dimensions covering different aspects
    expect(systemPrompt).toMatch(/independent/i);
  });

  it("should propagate errors from generateObject", async () => {
    const mockGenerateObject = vi
      .fn()
      .mockRejectedValue(new Error("API key invalid"));
    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { generateDimensions } = await import("@/dimensions/generate");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;
    await expect(
      generateDimensions("Test intent", { model: fakeModel }),
    ).rejects.toThrow("API key invalid");
  });

  it("should handle empty intent string", async () => {
    const mockGenerateObject = vi.fn().mockResolvedValue({
      object: { dimensions: [] },
    });
    vi.doMock("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const { generateDimensions } = await import("@/dimensions/generate");

    const fakeModel = { modelId: "test-model" } as unknown as LanguageModel;

    // Empty intent should throw or handle gracefully
    await expect(
      generateDimensions("", { model: fakeModel }),
    ).rejects.toThrow();
  });
});

// ── CRUD tests ────────────────────────────────────────────────────────────────

describe("dimensions CRUD", () => {
  let db: Awaited<ReturnType<typeof initTestDb>>;

  // Helper: set up an in-memory PGlite + Drizzle for testing
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
    `);

    const drizzleDb = drizzle({ client: pglite, schema });
    return { pglite, db: drizzleDb, schema };
  }

  let testSessionId: string;

  beforeEach(async () => {
    db = await initTestDb();

    // Mock ensureDb to return our test database
    vi.doMock("@/db", () => ({
      ensureDb: async () => db.db,
    }));

    // Create a test session
    const result = await db.pglite.query<{ id: string }>(
      "INSERT INTO sessions (intent) VALUES ('test intent') RETURNING id",
    );
    testSessionId = result.rows[0].id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (db?.pglite) {
      await db.pglite.close();
    }
  });

  describe("createDimensions", () => {
    it("should bulk insert generated dimensions", async () => {
      const { createDimensions } = await import("@/dimensions/crud");

      const dims = [
        {
          name: "Clarity",
          description: "How clear the writing is",
          rubric: { "1": "Unclear", "3": "Moderate", "5": "Crystal clear" },
        },
        {
          name: "Tone",
          description: "Appropriateness of tone",
          rubric: { "1": "Wrong tone", "3": "Acceptable", "5": "Perfect" },
        },
      ];

      const result = await createDimensions(testSessionId, dims);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Clarity");
      expect(result[1].name).toBe("Tone");
      expect(result[0].sessionId).toBe(testSessionId);
      expect(result[1].sessionId).toBe(testSessionId);
    });

    it("should assign sequential sortOrder to dimensions", async () => {
      const { createDimensions } = await import("@/dimensions/crud");

      const dims = [
        {
          name: "A",
          description: "First",
          rubric: { "1": "Low", "5": "High" },
        },
        {
          name: "B",
          description: "Second",
          rubric: { "1": "Low", "5": "High" },
        },
        {
          name: "C",
          description: "Third",
          rubric: { "1": "Low", "5": "High" },
        },
      ];

      const result = await createDimensions(testSessionId, dims);

      expect(result[0].sortOrder).toBe(0);
      expect(result[1].sortOrder).toBe(1);
      expect(result[2].sortOrder).toBe(2);
    });

    it("should set default weight of 1.0", async () => {
      const { createDimensions } = await import("@/dimensions/crud");

      const dims = [
        {
          name: "Test",
          description: "Test dim",
          rubric: { "1": "Low", "5": "High" },
        },
      ];

      const result = await createDimensions(testSessionId, dims);

      expect(result[0].weight).toBe(1.0);
    });

    it("should set locked to false by default", async () => {
      const { createDimensions } = await import("@/dimensions/crud");

      const dims = [
        {
          name: "Test",
          description: "Test dim",
          rubric: { "1": "Low", "5": "High" },
        },
      ];

      const result = await createDimensions(testSessionId, dims);

      expect(result[0].locked).toBe(false);
    });

    it("should store rubric as JSONB", async () => {
      const { createDimensions } = await import("@/dimensions/crud");

      const rubric = {
        "1": "Very poor",
        "2": "Poor",
        "3": "Average",
        "4": "Good",
        "5": "Excellent",
      };

      const dims = [
        { name: "Quality", description: "Overall quality", rubric },
      ];

      const result = await createDimensions(testSessionId, dims);

      expect(result[0].rubric).toEqual(rubric);
    });
  });

  describe("getDimensionsBySession", () => {
    it("should return dimensions ordered by sortOrder", async () => {
      const { createDimensions, getDimensionsBySession } = await import(
        "@/dimensions/crud"
      );

      const dims = [
        {
          name: "First",
          description: "D1",
          rubric: { "1": "L", "5": "H" },
        },
        {
          name: "Second",
          description: "D2",
          rubric: { "1": "L", "5": "H" },
        },
        {
          name: "Third",
          description: "D3",
          rubric: { "1": "L", "5": "H" },
        },
      ];

      await createDimensions(testSessionId, dims);

      const result = await getDimensionsBySession(testSessionId);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("First");
      expect(result[1].name).toBe("Second");
      expect(result[2].name).toBe("Third");
    });

    it("should return empty array for session with no dimensions", async () => {
      const { getDimensionsBySession } = await import("@/dimensions/crud");

      const result = await getDimensionsBySession(testSessionId);

      expect(result).toEqual([]);
    });

    it("should not return dimensions from other sessions", async () => {
      const { createDimensions, getDimensionsBySession } = await import(
        "@/dimensions/crud"
      );

      // Create another session
      const result2 = await db.pglite.query<{ id: string }>(
        "INSERT INTO sessions (intent) VALUES ('other intent') RETURNING id",
      );
      const otherSessionId = result2.rows[0].id;

      await createDimensions(testSessionId, [
        { name: "Mine", description: "My dim", rubric: { "1": "L", "5": "H" } },
      ]);
      await createDimensions(otherSessionId, [
        {
          name: "Theirs",
          description: "Their dim",
          rubric: { "1": "L", "5": "H" },
        },
      ]);

      const myDims = await getDimensionsBySession(testSessionId);
      const theirDims = await getDimensionsBySession(otherSessionId);

      expect(myDims).toHaveLength(1);
      expect(myDims[0].name).toBe("Mine");
      expect(theirDims).toHaveLength(1);
      expect(theirDims[0].name).toBe("Theirs");
    });
  });

  describe("updateDimension", () => {
    it("should update dimension name", async () => {
      const { createDimensions, updateDimension } = await import(
        "@/dimensions/crud"
      );

      const [dim] = await createDimensions(testSessionId, [
        {
          name: "Old Name",
          description: "A dimension",
          rubric: { "1": "L", "5": "H" },
        },
      ]);

      const updated = await updateDimension(dim.id, { name: "New Name" });

      expect(updated.name).toBe("New Name");
      expect(updated.description).toBe("A dimension"); // unchanged
    });

    it("should update dimension weight", async () => {
      const { createDimensions, updateDimension } = await import(
        "@/dimensions/crud"
      );

      const [dim] = await createDimensions(testSessionId, [
        {
          name: "Test",
          description: "Desc",
          rubric: { "1": "L", "5": "H" },
        },
      ]);

      const updated = await updateDimension(dim.id, { weight: 2.5 });

      expect(updated.weight).toBe(2.5);
    });

    it("should update dimension locked status", async () => {
      const { createDimensions, updateDimension } = await import(
        "@/dimensions/crud"
      );

      const [dim] = await createDimensions(testSessionId, [
        {
          name: "Test",
          description: "Desc",
          rubric: { "1": "L", "5": "H" },
        },
      ]);

      const updated = await updateDimension(dim.id, { locked: true });

      expect(updated.locked).toBe(true);
    });

    it("should update dimension rubric", async () => {
      const { createDimensions, updateDimension } = await import(
        "@/dimensions/crud"
      );

      const [dim] = await createDimensions(testSessionId, [
        {
          name: "Test",
          description: "Desc",
          rubric: { "1": "Old", "5": "Old" },
        },
      ]);

      const newRubric = { "1": "New low", "3": "New mid", "5": "New high" };
      const updated = await updateDimension(dim.id, { rubric: newRubric });

      expect(updated.rubric).toEqual(newRubric);
    });

    it("should throw when updating non-existent dimension", async () => {
      const { updateDimension } = await import("@/dimensions/crud");

      const fakeId = "00000000-0000-0000-0000-000000000000";
      await expect(updateDimension(fakeId, { name: "Nope" })).rejects.toThrow();
    });
  });

  describe("deleteDimension", () => {
    it("should delete a dimension", async () => {
      const { createDimensions, getDimensionsBySession, deleteDimension } =
        await import("@/dimensions/crud");

      const [dim] = await createDimensions(testSessionId, [
        {
          name: "ToDelete",
          description: "Will be deleted",
          rubric: { "1": "L", "5": "H" },
        },
      ]);

      await deleteDimension(dim.id);

      const remaining = await getDimensionsBySession(testSessionId);
      expect(remaining).toHaveLength(0);
    });

    it("should only delete the specified dimension", async () => {
      const { createDimensions, getDimensionsBySession, deleteDimension } =
        await import("@/dimensions/crud");

      const dims = await createDimensions(testSessionId, [
        {
          name: "Keep",
          description: "Will remain",
          rubric: { "1": "L", "5": "H" },
        },
        {
          name: "Delete",
          description: "Will be removed",
          rubric: { "1": "L", "5": "H" },
        },
      ]);

      await deleteDimension(dims[1].id);

      const remaining = await getDimensionsBySession(testSessionId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe("Keep");
    });
  });
});
