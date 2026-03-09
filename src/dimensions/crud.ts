import { eq, asc } from "drizzle-orm";
import { ensureDb } from "@/db";
import { dimensions } from "@shared/schema";
import type { Dimension } from "@shared/types";
import type { GeneratedDimensions } from "@shared/types";

/**
 * Bulk insert generated dimensions into PGlite for a given session.
 * Returns null if DB is unavailable.
 */
export async function createDimensions(
  sessionId: string,
  dims: GeneratedDimensions["dimensions"],
): Promise<Dimension[] | null> {
  const db = await ensureDb();
  if (!db) return null;

  const values = dims.map((dim, index) => ({
    sessionId,
    name: dim.name,
    description: dim.description,
    rubric: dim.rubric,
    weight: 1.0,
    locked: false,
    sortOrder: index,
  }));

  const result = await db.insert(dimensions).values(values).returning();

  return result;
}

/**
 * Fetch all dimensions for a session, ordered by sortOrder ascending.
 * Returns empty array if DB is unavailable.
 */
export async function getDimensionsBySession(
  sessionId: string,
): Promise<Dimension[]> {
  const db = await ensureDb();
  if (!db) return [];

  const result = await db
    .select()
    .from(dimensions)
    .where(eq(dimensions.sessionId, sessionId))
    .orderBy(asc(dimensions.sortOrder));

  return result;
}

/**
 * Update a dimension's mutable fields.
 * Returns null if DB is unavailable.
 */
export async function updateDimension(
  id: string,
  updates: Partial<
    Pick<
      Dimension,
      | "name"
      | "description"
      | "weight"
      | "rubric"
      | "locked"
      | "evalPrompt"
      | "rewriteHint"
    >
  >,
): Promise<Dimension | null> {
  const db = await ensureDb();
  if (!db) return null;

  const result = await db
    .update(dimensions)
    .set(updates)
    .where(eq(dimensions.id, id))
    .returning();

  if (result.length === 0) {
    throw new Error(`Dimension with id "${id}" not found`);
  }

  return result[0];
}

/**
 * Delete a dimension by ID.
 * No-op if DB is unavailable.
 */
export async function deleteDimension(id: string): Promise<void> {
  const db = await ensureDb();
  if (!db) return;

  await db.delete(dimensions).where(eq(dimensions.id, id));
}
