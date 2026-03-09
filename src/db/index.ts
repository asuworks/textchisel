import { PGlite } from '@electric-sql/pglite'
import { PGliteWorker } from '@electric-sql/pglite/worker'
import { live } from '@electric-sql/pglite/live'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '@shared/schema'

type AnyPGlite = PGlite | PGliteWorker
let pglite: AnyPGlite | null = null
let db: ReturnType<typeof drizzle> | null = null
let initPromise: Promise<{ pglite: AnyPGlite; db: ReturnType<typeof drizzle> }> | null = null
let initFailed = false

const MIGRATION_SQL = `
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
`

async function doInit(): Promise<{ pglite: AnyPGlite; db: ReturnType<typeof drizzle> }> {
  if (pglite && db) return { pglite, db }

  // Strategy 1: Try PGlite in a Web Worker (separate memory space)
  try {
    const workerInstance = new Worker(
      new URL('./pglite.worker.ts', import.meta.url),
      { type: 'module' },
    )
    pglite = await PGliteWorker.create(workerInstance, {
      dataDir: 'idb://textchisel',
    })
  } catch (workerErr) {
    console.warn('[textchisel] Worker PGlite failed, trying direct...', workerErr)
    // Strategy 2: Try direct PGlite (main thread)
    try {
      pglite = await PGlite.create({
        dataDir: 'idb://textchisel',
        extensions: { live },
        relaxedDurability: true,
      })
    } catch (directErr) {
      initFailed = true
      console.warn('[textchisel] PGlite unavailable — app continues with localStorage only.', directErr)
      throw new PGliteUnavailableError()
    }
  }

  await pglite.exec(MIGRATION_SQL)

  // ADR-003: meta-prompt columns (nullable, safe to re-run)
  await pglite.exec(`
    ALTER TABLE dimensions ADD COLUMN IF NOT EXISTS eval_prompt TEXT;
    ALTER TABLE dimensions ADD COLUMN IF NOT EXISTS rewrite_hint TEXT;
  `)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db = drizzle({ client: pglite as any, schema })

  return { pglite, db }
}

export class PGliteUnavailableError extends Error {
  constructor() {
    super('PGlite unavailable in this environment (WASM memory). App runs with localStorage only.')
    this.name = 'PGliteUnavailableError'
  }
}

/**
 * Start PGlite initialization. Idempotent — returns the same promise on repeated calls.
 */
export function initDatabase() {
  if (!initPromise) {
    initPromise = doInit().catch((err) => {
      initPromise = null  // allow retry on next call
      throw err
    })
  }
  return initPromise
}

/**
 * Await DB readiness, then return the Drizzle client.
 * Returns null if PGlite is unavailable in this environment.
 */
export async function ensureDb() {
  if (db) return db
  if (initFailed) return null
  try {
    const result = await initDatabase()
    return result.db
  } catch {
    return null
  }
}

/**
 * Await DB readiness, then return the PGlite instance.
 * Returns null if PGlite is unavailable.
 */
export async function ensurePglite() {
  if (pglite) return pglite
  if (initFailed) return null
  try {
    const result = await initDatabase()
    return result.pglite
  } catch {
    return null
  }
}

export function isDbReady(): boolean {
  return !!db
}

export { createSession, getSession } from './queries'
export { createPromptVersion, getNextVersionNum, getVersionsBySession } from './queries'
