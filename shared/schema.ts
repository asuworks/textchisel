import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  boolean,
  real,
} from 'drizzle-orm/pg-core'

// --- Sessions ---

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  intent: text('intent').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('drafting'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// --- Dimensions ---

export const dimensions = pgTable('dimensions', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  weight: real('weight').notNull().default(1.0),
  rubric: jsonb('rubric').$type<Record<string, string>>(),
  locked: boolean('locked').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
})

// --- Prompt Versions (immutable snapshots) ---

export const promptVersions = pgTable('prompt_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  versionNum: integer('version_num').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  userTemplate: text('user_template').notNull(),
  generatedText: text('generated_text'),
  scores: jsonb('scores').$type<Record<string, number>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// --- Evaluation Step Cache ---

export const evalStepCache = pgTable('eval_step_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  versionId: uuid('version_id')
    .notNull()
    .references(() => promptVersions.id),
  dimensionId: uuid('dimension_id')
    .notNull()
    .references(() => dimensions.id),
  score: integer('score').notNull(),
  reasoning: text('reasoning').notNull(),
  model: text('model').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
