import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { evalStepCache } from "@shared/schema";
import type { EvalStep } from "@shared/types";

/**
 * Look up a cached evaluation score for a specific version + dimension pair.
 *
 * @param versionId - The prompt version ID
 * @param dimensionId - The dimension ID
 * @returns The cached EvalStep, or null if not found
 */
export async function getCachedScore(
  versionId: string,
  dimensionId: string,
): Promise<EvalStep | null> {
  const db = getDb();

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
 *
 * @param input - The eval step data to cache
 * @returns The created EvalStep record
 */
export async function cacheScore(input: CacheScoreInput): Promise<EvalStep> {
  const db = getDb();

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
 *
 * @param versionId - The prompt version ID
 * @returns Array of EvalStep records for the version
 */
export async function getCachedScoresForVersion(
  versionId: string,
): Promise<EvalStep[]> {
  const db = getDb();

  const results = await db
    .select()
    .from(evalStepCache)
    .where(eq(evalStepCache.versionId, versionId));

  return results;
}
