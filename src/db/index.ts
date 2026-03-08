import { PGlite } from '@electric-sql/pglite'
import { live } from '@electric-sql/pglite/live'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '@shared/schema'

let pglite: PGlite | null = null
let db: ReturnType<typeof drizzle> | null = null

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

export async function initDatabase() {
  if (pglite) return { pglite, db: db! }

  pglite = await PGlite.create({
    dataDir: 'idb://textchisel',
    extensions: { live },
  })

  await pglite.exec(MIGRATION_SQL)

  db = drizzle({ client: pglite, schema })

  return { pglite, db }
}

export function getPglite() {
  if (!pglite) throw new Error('Database not initialized. Call initDatabase() first.')
  return pglite
}

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}
