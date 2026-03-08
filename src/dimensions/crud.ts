import { eq, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { dimensions } from "@shared/schema";
import type { Dimension } from "@shared/types";
import type { GeneratedDimensions } from "@shared/types";

/**
 * Bulk insert generated dimensions into PGlite for a given session.
 *
 * Each dimension gets a sequential sortOrder starting from 0.
 * Weight defaults to 1.0 and locked defaults to false.
 *
 * @param sessionId - The session to associate dimensions with
 * @param dims - Array of generated dimension data (name, description, rubric)
 * @returns The created Dimension records with IDs and defaults applied
 */
export async function createDimensions(
  sessionId: string,
  dims: GeneratedDimensions["dimensions"],
): Promise<Dimension[]> {
  const db = getDb();

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
 *
 * @param sessionId - The session ID to query dimensions for
 * @returns Array of Dimension records, ordered by sortOrder
 */
export async function getDimensionsBySession(
  sessionId: string,
): Promise<Dimension[]> {
  const db = getDb();

  const result = await db
    .select()
    .from(dimensions)
    .where(eq(dimensions.sessionId, sessionId))
    .orderBy(asc(dimensions.sortOrder));

  return result;
}

/**
 * Update a dimension's mutable fields.
 *
 * Only name, description, weight, rubric, and locked can be updated.
 * Throws if the dimension does not exist.
 *
 * @param id - The dimension ID to update
 * @param updates - Partial object with fields to update
 * @returns The updated Dimension record
 */
export async function updateDimension(
  id: string,
  updates: Partial<
    Pick<Dimension, "name" | "description" | "weight" | "rubric" | "locked">
  >,
): Promise<Dimension> {
  const db = getDb();

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
 *
 * @param id - The dimension ID to delete
 */
export async function deleteDimension(id: string): Promise<void> {
  const db = getDb();

  await db.delete(dimensions).where(eq(dimensions.id, id));
}
