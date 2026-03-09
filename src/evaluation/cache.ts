import { eq, and } from "drizzle-orm";
import { ensureDb } from "@/db";
import { evalStepCache } from "@shared/schema";
import type { EvalStep } from "@shared/types";

/**
 * Look up a cached evaluation score for a specific version + dimension pair.
 * Returns null if DB is unavailable.
 */
export async function getCachedScore(
  versionId: string,
  dimensionId: string,
): Promise<EvalStep | null> {
  const db = await ensureDb();
  if (!db) return null;

  const results = await db
    .select()
    .from(evalStepCache)
    .where(
      and(
        eq(evalStepCache.versionId, versionId),
        eq(evalStepCache.dimensionId, dimensionId),
      ),
    )
    .limit(1);

  return results[0] ?? null;
}

interface CacheScoreInput {
  versionId: string;
  dimensionId: string;
  score: number;
  reasoning: string;
  model: string;
}

/**
 * Insert an evaluation score into the cache.
 * Returns null if DB is unavailable.
 */
export async function cacheScore(
  input: CacheScoreInput,
): Promise<EvalStep | null> {
  const db = await ensureDb();
  if (!db) return null;

  const results = await db
    .insert(evalStepCache)
    .values({
      versionId: input.versionId,
      dimensionId: input.dimensionId,
      score: input.score,
      reasoning: input.reasoning,
      model: input.model,
    })
    .returning();

  return results[0];
}

/**
 * Retrieve all cached evaluation scores for a given prompt version.
 * Returns empty array if DB is unavailable.
 */
export async function getCachedScoresForVersion(
  versionId: string,
): Promise<EvalStep[]> {
  const db = await ensureDb();
  if (!db) return [];

  const results = await db
    .select()
    .from(evalStepCache)
    .where(eq(evalStepCache.versionId, versionId));

  return results;
}
