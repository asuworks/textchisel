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

/** dimensionId → target score (1-5). Record (not Map) for JSON serialization compatibility. */
export type TargetScores = Record<string, number>;

/** Locked dimension IDs. Record for JSON serialization (Zustand persist). */
export type LockSet = Record<string, boolean>;

// --- Session status ---

export const SESSION_STATUS = {
  IDLE: "idle",
  GENERATING: "generating",
  EVALUATING: "evaluating",
  REFINING: "refining",
  ERROR: "error",
} as const;

export type SessionStatus =
  (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

// --- Zod schemas for LLM structured output ---

/** Rubric: sequential integer keys "1" through N (2-7 levels). Used for storage/runtime. */
export const RubricSchema = z
  .record(z.string(), z.string())
  .describe(
    "Rubric with sequential integer keys starting from '1', each mapping to a description of what that score level means",
  );

/** Fixed 5-key rubric schema for LLM structured generation (models need explicit named keys). */
const GenerationRubricSchema = z.object({
  "1": z.string().describe("Description for score level 1"),
  "2": z.string().describe("Description for score level 2"),
  "3": z.string().describe("Description for score level 3"),
  "4": z.string().describe("Description for score level 4"),
  "5": z.string().describe("Description for score level 5"),
});

export const DimensionGenerationSchema = z.object({
  dimensions: z.array(
    z.object({
      name: z.string().describe("Short name for this evaluation dimension"),
      description: z.string().describe("What this dimension measures"),
      rubric: GenerationRubricSchema.describe(
        "Rubric with keys 1-5, each mapping to a description of what that score level means",
      ),
    }),
  ),
});

export type GeneratedDimensions = z.infer<typeof DimensionGenerationSchema>;

/** Suggested dimension (precomputed but not yet added to session) */
export interface SuggestedDimension {
  name: string;
  description: string;
  rubric: Record<string, string>;
}

export const EvaluationScoreSchema = z.object({
  score: z
    .number()
    .int()
    .min(1)
    .max(7)
    .describe(
      "Score from 1 to N (where N is the number of rubric levels, 2-7)",
    ),
  reasoning: z.string().describe("Brief justification for the score"),
});

export type EvaluationScore = z.infer<typeof EvaluationScoreSchema>;

// --- Meta-prompt contracts (ADR-003) ---

export const DimensionPromptsSchema = z.object({
  evalPrompt: z
    .string()
    .describe(
      "Evaluation methodology prompt: step-by-step instructions for how to evaluate text on this dimension",
    ),
  rewriteHint: z
    .string()
    .describe(
      "Writing guide: what this dimension controls and how text changes at each level",
    ),
  examples: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "One short example sentence (1-2 sentences) per rubric level that would score at that level. Keys are rubric level numbers as strings.",
    ),
});

export type DimensionPrompts = z.infer<typeof DimensionPromptsSchema>;

export const RewritePlanSchema = z.object({
  inferredIntent: z
    .string()
    .describe("What the user is trying to achieve with this set of changes"),
  instructions: z
    .string()
    .describe("Concrete writing instructions for the rewriter to follow"),
});

export type RewritePlan = z.infer<typeof RewritePlanSchema>;

// --- Rewriter contracts (ADR-002) ---

export interface RewriteContext {
  intent: string;
  currentText: string;
  dimensions: Dimension[];
  currentScores: Record<string, EvaluationScore>;
  targetScores: Record<string, number>;
  lockedDimensionIds: Set<string>;
}

export interface RewritePrompt {
  system: string;
  user: string;
}
