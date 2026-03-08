import { z } from "zod";
import type {
  sessions,
  dimensions,
  promptVersions,
  evalStepCache,
} from "./schema";

// --- Inferred types from Drizzle schema ---

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Dimension = typeof dimensions.$inferSelect;
export type NewDimension = typeof dimensions.$inferInsert;

export type PromptVersion = typeof promptVersions.$inferSelect;
export type NewPromptVersion = typeof promptVersions.$inferInsert;

export type EvalStep = typeof evalStepCache.$inferSelect;
export type NewEvalStep = typeof evalStepCache.$inferInsert;

// --- Non-DB types ---

/** dimensionId → target score (1-5) */
export type TargetScores = Map<string, number>;

/** Set of locked dimension IDs */
export type LockSet = Set<string>;

// --- Session status ---

export const SESSION_STATUS = {
  DRAFTING: "drafting",
  EVALUATING: "evaluating",
  REFINING: "refining",
  DONE: "done",
} as const;

export type SessionStatus =
  (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

// --- Zod schemas for LLM structured output ---

export const DimensionGenerationSchema = z.object({
  dimensions: z.array(
    z.object({
      name: z.string().describe("Short name for this evaluation dimension"),
      description: z.string().describe("What this dimension measures"),
      rubric: z
        .record(z.string())
        .describe("Scoring criteria keyed by level 1-5"),
    }),
  ),
});

export type GeneratedDimensions = z.infer<typeof DimensionGenerationSchema>;

export const EvaluationScoreSchema = z.object({
  score: z.number().int().min(1).max(5).describe("Score from 1 to 5"),
  reasoning: z.string().describe("Brief justification for the score"),
});

export type EvaluationScore = z.infer<typeof EvaluationScoreSchema>;
