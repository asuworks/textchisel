import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Integration test: prompt version persistence
 *
 * Verifies that prompt versions are created as immutable snapshots,
 * version numbers increment correctly, and history is queryable.
 */

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
      sort_order INTEGER NOT NULL DEFAULT 0
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

describe("prompt version persistence", () => {
  let db: Awaited<ReturnType<typeof initTestDb>>;
  let testSessionId: string;

  beforeEach(async () => {
    vi.resetModules();
    db = await initTestDb();

    vi.doMock("@/db", () => ({
      getDb: () => db.db,
    }));

    // Create a test session
    const result = await db.pglite.query<{ id: string }>(
      "INSERT INTO sessions (intent) VALUES ('test intent') RETURNING id",
    );
    testSessionId = result.rows[0].id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createPromptVersion", () => {
    it("should create a prompt version with correct fields", async () => {
      const { createPromptVersion } = await import("@/db/queries");

      const version = await createPromptVersion({
        sessionId: testSessionId,
        versionNum: 1,
        systemPrompt: "You are a writing assistant.",
        userTemplate: "Write a professional email",
        generatedText: "Dear colleague, I am writing to inform you...",
        scores: { "dim-1": 4, "dim-2": 3 },
      });

      expect(version.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(version.sessionId).toBe(testSessionId);
      expect(version.versionNum).toBe(1);
      expect(version.systemPrompt).toBe("You are a writing assistant.");
      expect(version.userTemplate).toBe("Write a professional email");
      expect(version.generatedText).toBe(
        "Dear colleague, I am writing to inform you...",
      );
      expect(version.scores).toEqual({ "dim-1": 4, "dim-2": 3 });
      expect(version.createdAt).toBeInstanceOf(Date);
    });

    it("should allow null generatedText and scores", async () => {
      const { createPromptVersion } = await import("@/db/queries");

      const version = await createPromptVersion({
        sessionId: testSessionId,
        versionNum: 1,
        systemPrompt: "",
        userTemplate: "test",
      });

      expect(version.generatedText).toBeNull();
      expect(version.scores).toBeNull();
    });
  });

  describe("getNextVersionNum", () => {
    it("should return 1 for a session with no versions", async () => {
      const { getNextVersionNum } = await import("@/db/queries");
      const num = await getNextVersionNum(testSessionId);
      expect(num).toBe(1);
    });

    it("should increment after each version", async () => {
      const { createPromptVersion, getNextVersionNum } = await import(
        "@/db/queries"
      );

      await createPromptVersion({
        sessionId: testSessionId,
        versionNum: 1,
        systemPrompt: "",
        userTemplate: "v1",
        generatedText: "text v1",
      });
      expect(await getNextVersionNum(testSessionId)).toBe(2);

      await createPromptVersion({
        sessionId: testSessionId,
        versionNum: 2,
        systemPrompt: "",
        userTemplate: "v2",
        generatedText: "text v2",
      });
      expect(await getNextVersionNum(testSessionId)).toBe(3);
    });

    it("should be scoped to session", async () => {
      const { createPromptVersion, getNextVersionNum } = await import(
        "@/db/queries"
      );

      // Create version in test session
      await createPromptVersion({
        sessionId: testSessionId,
        versionNum: 1,
        systemPrompt: "",
        userTemplate: "v1",
      });

      // Create another session
      const result = await db.pglite.query<{ id: string }>(
        "INSERT INTO sessions (intent) VALUES ('other') RETURNING id",
      );
      const otherSessionId = result.rows[0].id;

      // Other session should start at 1
      expect(await getNextVersionNum(otherSessionId)).toBe(1);
      // Original session should be at 2
      expect(await getNextVersionNum(testSessionId)).toBe(2);
    });
  });

  describe("getVersionsBySession", () => {
    it("should return versions ordered by versionNum descending", async () => {
      const { createPromptVersion, getVersionsBySession } = await import(
        "@/db/queries"
      );

      await createPromptVersion({
        sessionId: testSessionId,
        versionNum: 1,
        systemPrompt: "",
        userTemplate: "v1",
        generatedText: "text v1",
      });
      await createPromptVersion({
        sessionId: testSessionId,
        versionNum: 2,
        systemPrompt: "",
        userTemplate: "v2",
        generatedText: "text v2",
      });
      await createPromptVersion({
        sessionId: testSessionId,
        versionNum: 3,
        systemPrompt: "",
        userTemplate: "v3",
        generatedText: "text v3",
      });

      const versions = await getVersionsBySession(testSessionId);

      expect(versions).toHaveLength(3);
      expect(versions[0].versionNum).toBe(3); // newest first
      expect(versions[1].versionNum).toBe(2);
      expect(versions[2].versionNum).toBe(1);
    });

    it("should return empty array for session with no versions", async () => {
      const { getVersionsBySession } = await import("@/db/queries");
      const versions = await getVersionsBySession(testSessionId);
      expect(versions).toHaveLength(0);
    });

    it("should not return versions from other sessions", async () => {
      const { createPromptVersion, getVersionsBySession } = await import(
        "@/db/queries"
      );

      await createPromptVersion({
        sessionId: testSessionId,
        versionNum: 1,
        systemPrompt: "",
        userTemplate: "v1",
        generatedText: "text",
      });

      const result = await db.pglite.query<{ id: string }>(
        "INSERT INTO sessions (intent) VALUES ('other') RETURNING id",
      );
      const otherSessionId = result.rows[0].id;

      const versions = await getVersionsBySession(otherSessionId);
      expect(versions).toHaveLength(0);
    });
  });
});
