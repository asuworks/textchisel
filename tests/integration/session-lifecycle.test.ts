import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Integration test: session lifecycle + dimension persistence
 *
 * Verifies that sessions are created in PGlite, dimensions get real UUIDs,
 * and the full lifecycle (session → dimensions → query) works end-to-end.
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

describe("session lifecycle", () => {
  let db: Awaited<ReturnType<typeof initTestDb>>;

  beforeEach(async () => {
    vi.resetModules();
    db = await initTestDb();

    vi.doMock("@/db", () => ({
      getDb: () => db.db,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createSession", () => {
    it("should create a session with UUID and intent", async () => {
      const { createSession } = await import("@/db/queries");
      const session = await createSession("Write a professional email");

      expect(session.id).toBeDefined();
      expect(session.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(session.intent).toBe("Write a professional email");
      expect(session.status).toBe("drafting");
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it("should create unique sessions for different intents", async () => {
      const { createSession } = await import("@/db/queries");
      const s1 = await createSession("intent 1");
      const s2 = await createSession("intent 2");

      expect(s1.id).not.toBe(s2.id);
      expect(s1.intent).toBe("intent 1");
      expect(s2.intent).toBe("intent 2");
    });
  });

  describe("getSession", () => {
    it("should retrieve a session by ID", async () => {
      const { createSession, getSession } = await import("@/db/queries");
      const created = await createSession("test intent");
      const retrieved = await getSession(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.intent).toBe("test intent");
    });

    it("should return null for non-existent session", async () => {
      const { getSession } = await import("@/db/queries");
      const result = await getSession("00000000-0000-0000-0000-000000000000");

      expect(result).toBeNull();
    });
  });

  describe("full lifecycle: session → dimensions", () => {
    it("should create session then persist dimensions with real UUIDs", async () => {
      const { createSession } = await import("@/db/queries");
      const { createDimensions, getDimensionsBySession } = await import(
        "@/dimensions/crud"
      );

      // 1. Create session
      const session = await createSession("Write a persuasive essay");

      // 2. Create dimensions
      const generatedDims = [
        {
          name: "Clarity",
          description: "How clear the writing is",
          rubric: { "1": "Unclear", "3": "Moderate", "5": "Crystal clear" },
        },
        {
          name: "Persuasiveness",
          description: "How convincing the argument is",
          rubric: { "1": "Weak", "3": "Moderate", "5": "Compelling" },
        },
      ];

      const dims = await createDimensions(session.id, generatedDims);

      expect(dims).toHaveLength(2);
      expect(dims[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(dims[0].sessionId).toBe(session.id);
      expect(dims[0].name).toBe("Clarity");
      expect(dims[1].name).toBe("Persuasiveness");
      expect(dims[0].sortOrder).toBe(0);
      expect(dims[1].sortOrder).toBe(1);

      // 3. Query dimensions back
      const retrieved = await getDimensionsBySession(session.id);
      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].id).toBe(dims[0].id);
      expect(retrieved[1].id).toBe(dims[1].id);
    });

    it("should isolate dimensions between sessions (re-generation)", async () => {
      const { createSession } = await import("@/db/queries");
      const { createDimensions, getDimensionsBySession } = await import(
        "@/dimensions/crud"
      );

      const s1 = await createSession("intent 1");
      const s2 = await createSession("intent 2");

      await createDimensions(s1.id, [
        {
          name: "Dim A",
          description: "desc",
          rubric: { "1": "low", "5": "high" },
        },
      ]);
      await createDimensions(s2.id, [
        {
          name: "Dim B",
          description: "desc",
          rubric: { "1": "low", "5": "high" },
        },
      ]);

      const s1Dims = await getDimensionsBySession(s1.id);
      const s2Dims = await getDimensionsBySession(s2.id);

      expect(s1Dims).toHaveLength(1);
      expect(s1Dims[0].name).toBe("Dim A");
      expect(s2Dims).toHaveLength(1);
      expect(s2Dims[0].name).toBe("Dim B");
    });
  });
});
