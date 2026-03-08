# PGlite + Drizzle ORM + pglite-react Reference Guide

Generated: 2026-03-08

---

## 1. PGlite Setup

### Installation

```bash
npm install @electric-sql/pglite
```

### Creating an Instance

```typescript
import { PGlite } from "@electric-sql/pglite";

// In-memory (ephemeral, lost on page reload)
const db = new PGlite();
// or explicitly:
const db = new PGlite("memory://");

// Browser — IndexedDB (persistent across reloads)
const db = new PGlite("idb://my-database");

// Node.js / Bun — filesystem
const db = new PGlite("./path/to/pgdata");
// or with file:// prefix:
const db = new PGlite("file://./path/to/pgdata");
```

### Storage Options Summary

| Scheme       | Environment        | Persistence | Notes                                      |
|--------------|--------------------|-------------|---------------------------------------------|
| `memory://`  | All platforms      | None        | Ephemeral, fastest                          |
| `idb://`     | Browser            | IndexedDB   | Recommended for browser; loads all files into memory on start, flushes after each query |
| `file://`    | Node.js, Bun, Deno | Filesystem  | Standard file persistence                   |
| _(no prefix)_| Node.js, Bun, Deno | Filesystem  | Treated as file path                        |

### PGlite with Extensions

```typescript
import { PGlite } from "@electric-sql/pglite";
import { live } from "@electric-sql/pglite/live";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

const db = await PGlite.create({
  dataDir: "idb://my-database",
  extensions: {
    live,
    uuid_ossp,
  },
});
```

### Core API Methods

```typescript
// .query() — single statement with parameters (extended query protocol)
const result = await db.query<{ id: number; name: string }>(
  "SELECT * FROM users WHERE id = $1",
  [1]
);
// result.rows => [{ id: 1, name: "Alice" }]

// .exec() — one or more statements, no parameters (simple query protocol)
// Good for DDL, migrations, multi-statement SQL
const results = await db.exec(`
  CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT);
  INSERT INTO users (name) VALUES ('Alice');
`);

// .transaction() — run queries in a transaction
await db.transaction(async (tx) => {
  await tx.query("INSERT INTO users (name) VALUES ($1)", ["Bob"]);
  await tx.query("INSERT INTO users (name) VALUES ($1)", ["Carol"]);
});

// .close() — close the database
await db.close();
```

### Web Worker (recommended for browser)

```typescript
import { PGliteWorker } from "@electric-sql/pglite/worker";

const db = new PGliteWorker("idb://my-database");
```

Running PGlite in a Web Worker prevents database operations from blocking the main UI thread.

---

## 2. Drizzle ORM + PGlite

### Installation

```bash
npm install drizzle-orm @electric-sql/pglite
npm install -D drizzle-kit
```

### Connecting Drizzle to PGlite

```typescript
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

// Option A: Pass a PGlite client
const client = new PGlite("idb://my-database");
const db = drizzle({ client });

// Option B: Pass native config (Drizzle creates PGlite internally)
const db = drizzle({ connection: { dataDir: "idb://my-database" } });

// Option C: In-memory
const client = new PGlite();
const db = drizzle({ client });
```

### Schema Definition with pgTable

```typescript
// src/db/schema.ts
import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  boolean,
  serial,
  primaryKey,
} from "drizzle-orm/pg-core";

// Example: documents table with UUID primary key and JSONB
export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  content: text("content").default(""),
  metadata: jsonb("metadata").$type<{
    wordCount: number;
    tags: string[];
    lastEditedBy?: string;
  }>(),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Example: simple users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  age: integer("age"),
  isActive: boolean("is_active").default(true),
});
```

### JSONB Column Details

```typescript
import { jsonb } from "drizzle-orm/pg-core";

// Basic JSONB (typed as unknown)
jsonb("data")

// JSONB with type inference
jsonb("data").$type<{ foo: string; bar: number }>()

// JSONB with default value
jsonb("settings").$type<{ theme: string }>().default({ theme: "light" })

// JSONB array type
jsonb("tags").$type<string[]>().default([])
```

### UUID Column Details

```typescript
import { uuid } from "drizzle-orm/pg-core";

// UUID with random default (uses gen_random_uuid())
uuid("id").defaultRandom().primaryKey()

// UUID without default (caller must supply)
uuid("ref_id")

// UUID with explicit SQL default
uuid("id").default(sql`gen_random_uuid()`)
```

### Type Inference Helpers

```typescript
import { documents } from "./schema";

// Infer the SELECT result type
type Document = typeof documents.$inferSelect;
// => { id: string; title: string; content: string | null; metadata: {...} | null; ... }

// Infer the INSERT input type
type NewDocument = typeof documents.$inferInsert;
// => { id?: string; title: string; content?: string; metadata?: {...}; ... }
```

### Migrations

#### Approach A: drizzle-kit push (recommended for rapid prototyping)

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  driver: "pglite",
  dbCredentials: {
    url: "idb://my-database", // or a filesystem path for Node
  },
});
```

```bash
# Push schema directly to database (no SQL files generated)
npx drizzle-kit push
```

#### Approach B: Generate + Migrate (Node.js only)

```bash
# Generate SQL migration files
npx drizzle-kit generate

# Apply migrations (Node.js server-side)
npx drizzle-kit migrate
```

```typescript
// Programmatic migration (Node.js only — uses Node APIs)
import { migrate } from "drizzle-orm/pglite/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";

const client = new PGlite("./pgdata");
const db = drizzle({ client });

await migrate(db, { migrationsFolder: "./drizzle" });
```

#### Approach C: Browser Migrations (workaround)

Standard drizzle-kit CLI commands require Node.js. For browser-only apps:

**Option 1 — Raw SQL on startup:**
```typescript
// Run schema creation SQL directly via PGlite
await db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  );
`);
```

**Option 2 — Bundle migrations as JSON:**
```typescript
// Build step (Node.js script):
import { readMigrationFiles } from "drizzle-orm/migrator";
import fs from "fs";

const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
fs.writeFileSync("./src/migrations.json", JSON.stringify(migrations));

// Browser runtime:
import migrations from "./migrations.json";
// Apply each migration SQL to PGlite
```

**Option 3 — Third-party packages:**
- `@proj-airi/drizzle-orm-browser` — provides a browser-compatible migrator
- `drizzle-on-indexeddb` — compiles migrations into a JSON bundle

> **Note:** The `readMigrationFiles` function is undocumented and may break in future Drizzle releases.

---

## 3. useLiveQuery (pglite-react)

### Installation

```bash
npm install @electric-sql/pglite-react
```

### Setting Up PGliteProvider

```tsx
import { PGlite } from "@electric-sql/pglite";
import { live } from "@electric-sql/pglite/live";
import { PGliteProvider } from "@electric-sql/pglite-react";

// Create PGlite instance with live extension (REQUIRED for live queries)
const db = await PGlite.create({
  dataDir: "idb://my-database",
  extensions: { live },
});

function App() {
  return (
    <PGliteProvider db={db}>
      <MyComponent />
    </PGliteProvider>
  );
}
```

### useLiveQuery

Re-renders the component whenever query results change. Wraps `db.live.query()`.

```tsx
import { useLiveQuery } from "@electric-sql/pglite-react";

function DocumentList() {
  const results = useLiveQuery<{
    id: string;
    title: string;
    created_at: Date;
  }>("SELECT * FROM documents ORDER BY created_at DESC");

  // results may be undefined on first render while loading
  if (!results) return <div>Loading...</div>;

  return (
    <ul>
      {results.rows.map((doc) => (
        <li key={doc.id}>{doc.title}</li>
      ))}
    </ul>
  );
}
```

**Signature:**
```typescript
function useLiveQuery<T = { [key: string]: unknown }>(
  query: string,
  params?: unknown[] | undefined | null
): Results<T> | undefined;
```

**With parameters:**
```tsx
const results = useLiveQuery<{ id: string; title: string }>(
  "SELECT * FROM documents WHERE status = $1",
  [currentStatus]
);
```

### useLiveIncrementalQuery

More efficient for large result sets. Uses differential updates internally — only processes changed rows. Requires a unique key column.

```tsx
import { useLiveIncrementalQuery } from "@electric-sql/pglite-react";

function DocumentList() {
  const results = useLiveIncrementalQuery<{
    id: string;
    title: string;
  }>(
    "SELECT * FROM documents ORDER BY created_at DESC",
    undefined, // params
    "id"       // key column (must be unique)
  );

  if (!results) return <div>Loading...</div>;

  return (
    <ul>
      {results.rows.map((doc) => (
        <li key={doc.id}>{doc.title}</li>
      ))}
    </ul>
  );
}
```

**Signature:**
```typescript
function useLiveIncrementalQuery<T = { [key: string]: unknown }>(
  query: string,
  params?: unknown[] | undefined | null,
  key?: string
): Results<T> | undefined;
```

### usePGlite

Access the PGlite instance directly from context:

```tsx
import { usePGlite } from "@electric-sql/pglite-react";

function AddDocument() {
  const db = usePGlite();

  const handleAdd = async () => {
    await db.query(
      "INSERT INTO documents (title) VALUES ($1)",
      ["New Document"]
    );
    // useLiveQuery consumers will automatically re-render
  };

  return <button onClick={handleAdd}>Add Document</button>;
}
```

### Choosing Between useLiveQuery and useLiveIncrementalQuery

| Aspect                  | useLiveQuery             | useLiveIncrementalQuery          |
|-------------------------|--------------------------|----------------------------------|
| Mechanism               | Re-runs full query       | Diffs changes in Postgres        |
| Small result sets       | Faster (less overhead)   | Slight overhead from diff logic  |
| Large result sets       | Slower (full re-query)   | Faster (only processes changes)  |
| Wide rows (many cols)   | Slower                   | Faster                           |
| Requires unique key     | No                       | Yes                              |

---

## 4. PGlite Live Extension

### Enabling the Extension

```typescript
import { PGlite } from "@electric-sql/pglite";
import { live, type LiveNamespace } from "@electric-sql/pglite/live";

const db = await PGlite.create({
  extensions: { live },
});
```

The `live` extension **must** be added at instance creation time. It cannot be added later.

### live.query()

Subscribe to a query and get full results on every change:

```typescript
const { rows, fields, unsubscribe } = await db.live.query<{
  id: string;
  title: string;
}>(
  "SELECT * FROM documents WHERE status = $1",
  [$status],
  (results) => {
    // Called whenever underlying tables change
    console.log("Updated rows:", results.rows);
  }
);

// Later: stop listening
unsubscribe();
```

### live.incrementalQuery()

Efficiently tracks changes using a key column:

```typescript
const { rows, fields, unsubscribe } = await db.live.incrementalQuery<{
  id: string;
  title: string;
}>(
  "SELECT * FROM documents ORDER BY created_at DESC",
  [],
  "id", // key column
  (results) => {
    console.log("Updated rows:", results.rows);
  }
);
```

### live.changes()

Low-level API that emits insert/update/delete change events:

```typescript
const { fields, unsubscribe } = await db.live.changes(
  "SELECT * FROM documents",
  [],
  "id", // key column
  (changes) => {
    for (const change of changes) {
      console.log(change.__changed_columns__); // which columns changed
      console.log(change.__op__);              // "INSERT" | "UPDATE" | "DELETE"
    }
  }
);
```

### What Queries Are Supported

- Standard SELECT queries (including JOINs, subqueries, aggregations)
- Parameterized queries with `$1`, `$2`, etc.
- The live extension watches the **tables referenced in the query** and re-runs when any of those tables receive writes
- Works with any valid PostgreSQL SELECT — not limited to simple table scans

---

## 5. CRUD Operations with Drizzle over PGlite

### Setup

```typescript
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, and, like, desc, asc, sql } from "drizzle-orm";
import { documents } from "./schema";

const client = new PGlite("idb://my-database");
const db = drizzle({ client });
```

### INSERT

```typescript
// Insert a single row
const [newDoc] = await db
  .insert(documents)
  .values({
    title: "My Document",
    content: "Hello world",
    metadata: { wordCount: 2, tags: ["greeting"] },
  })
  .returning();
// newDoc is fully typed as Document

// Insert multiple rows
await db.insert(documents).values([
  { title: "Doc 1", content: "Content 1" },
  { title: "Doc 2", content: "Content 2" },
]);

// Upsert (insert or update on conflict)
await db
  .insert(documents)
  .values({ id: existingId, title: "Updated Title" })
  .onConflictDoUpdate({
    target: documents.id,
    set: { title: "Updated Title", updatedAt: new Date() },
  });

// Insert with conflict ignore
await db
  .insert(documents)
  .values({ title: "Maybe Duplicate" })
  .onConflictDoNothing();
```

### SELECT

```typescript
// Select all
const allDocs = await db.select().from(documents);

// Select with where clause
const drafts = await db
  .select()
  .from(documents)
  .where(eq(documents.status, "draft"));

// Select specific columns
const titles = await db
  .select({ id: documents.id, title: documents.title })
  .from(documents);

// Multiple conditions
const filtered = await db
  .select()
  .from(documents)
  .where(
    and(
      eq(documents.status, "published"),
      like(documents.title, "%guide%")
    )
  );

// Order, limit, offset
const paged = await db
  .select()
  .from(documents)
  .orderBy(desc(documents.createdAt))
  .limit(10)
  .offset(20);

// Count
const [{ count }] = await db
  .select({ count: sql<number>`count(*)` })
  .from(documents);
```

### UPDATE

```typescript
// Update with where clause
const [updated] = await db
  .update(documents)
  .set({
    title: "New Title",
    updatedAt: new Date(),
  })
  .where(eq(documents.id, docId))
  .returning();

// Update JSONB field (full replacement)
await db
  .update(documents)
  .set({
    metadata: { wordCount: 150, tags: ["updated", "important"] },
  })
  .where(eq(documents.id, docId));

// Conditional update
await db
  .update(documents)
  .set({ status: "archived" })
  .where(
    and(
      eq(documents.status, "draft"),
      sql`${documents.updatedAt} < NOW() - INTERVAL '30 days'`
    )
  );
```

### DELETE

```typescript
// Delete by ID
await db.delete(documents).where(eq(documents.id, docId));

// Delete with returning
const [deleted] = await db
  .delete(documents)
  .where(eq(documents.id, docId))
  .returning();

// Bulk delete
await db
  .delete(documents)
  .where(eq(documents.status, "archived"));
```

### Transactions

```typescript
await db.transaction(async (tx) => {
  const [doc] = await tx
    .insert(documents)
    .values({ title: "Transaction Doc" })
    .returning();

  await tx
    .update(documents)
    .set({ metadata: { wordCount: 0, tags: [] } })
    .where(eq(documents.id, doc.id));
});
```

---

## 6. Limitations and Considerations

### PGlite vs Full Postgres

| Feature                     | PGlite                          | Full Postgres               |
|-----------------------------|---------------------------------|-----------------------------|
| Concurrency                 | Single-user / single-connection | Multi-user, multi-connection|
| Network access              | No listening on ports           | TCP/IP, Unix sockets        |
| psql / pg_dump              | Not available                   | Full CLI tools              |
| Memory                      | Browser: 2-4 GB limit           | Server RAM                  |
| Scheduling (pg_cron)        | Not supported                   | Available                   |
| PostGIS (full)              | Not available (needs GEOS)      | Available                   |
| Replication                 | Not supported                   | Streaming, logical          |
| Performance (complex queries)| May differ from server          | Optimized for server        |
| Startup time                | WASM load + data hydration      | Daemon already running      |

### Available Extensions

PGlite supports many PostgreSQL extensions including:

- **pgvector** — vector similarity search (dynamically loaded)
- **uuid-ossp** — UUID generation functions
- **hstore** — key-value store type
- **intarray** — integer array functions
- **amcheck** — B-tree index verification
- **auto_explain** — automatic EXPLAIN logging
- **pg_ivm** — incremental view maintenance
- **hashids** — hashid generation
- **live** — PGlite-specific reactive queries
- Various `postgres/contrib` extensions

**Not available:** PostGIS (full), pg_cron, any extension requiring OS-level libraries.

> Note: `gen_random_uuid()` is built into PostgreSQL 13+ and does NOT require uuid-ossp. PGlite is based on PostgreSQL 17, so `gen_random_uuid()` works out of the box.

### Bundle Size

- PGlite core: ~3 MB gzipped
- Additional extensions (like pgvector) load dynamically and add to bundle
- For browser apps, consider lazy-loading PGlite to avoid blocking initial page load

### Browser-Specific Considerations

- **IndexedDB storage** loads all database files into memory on startup, then flushes after each query. Large databases will increase startup time.
- **OPFS (Origin Private File System)** is not yet supported by Safari. Use `idb://` for broadest compatibility.
- **Web Workers** are recommended to avoid blocking the UI thread during queries.
- **Tab coordination**: Use `PGliteWorker` with the multi-tab worker for shared access across browser tabs.

### Drizzle + PGlite Browser Migration Gotchas

- `drizzle-kit push` and `drizzle-kit migrate` are CLI tools requiring Node.js — they cannot run in the browser.
- The `migrate()` function from `drizzle-orm/pglite/migrator` uses Node.js APIs and does not work in browser.
- For browser apps, use raw SQL via `db.exec()` or bundle migrations as JSON (see Section 2, Approach C).
- `drizzle-kit push` is the simplest approach for development — it pushes schema changes without generating files.

---

## Quick Start Recipe (Browser App)

```typescript
// 1. Create PGlite with live extension
import { PGlite } from "@electric-sql/pglite";
import { live } from "@electric-sql/pglite/live";
import { drizzle } from "drizzle-orm/pglite";
import { PGliteProvider } from "@electric-sql/pglite-react";
import * as schema from "./db/schema";

const client = await PGlite.create({
  dataDir: "idb://textchisel",
  extensions: { live },
});

// 2. Initialize schema (browser migration)
await client.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    metadata JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
`);

// 3. Create Drizzle instance
const db = drizzle({ client, schema });

// 4. Wrap app in provider
function App() {
  return (
    <PGliteProvider db={client}>
      <Editor db={db} />
    </PGliteProvider>
  );
}

// 5. Use live queries in components
function DocumentList() {
  const results = useLiveQuery(
    "SELECT id, title, updated_at FROM documents ORDER BY updated_at DESC"
  );
  if (!results) return <div>Loading...</div>;
  return (
    <ul>
      {results.rows.map((doc) => (
        <li key={doc.id}>{doc.title}</li>
      ))}
    </ul>
  );
}

// 6. Use Drizzle for mutations
async function createDocument(db, title: string) {
  const [doc] = await db
    .insert(schema.documents)
    .values({ title })
    .returning();
  return doc; // live queries auto-update
}
```

---

## Sources

1. [PGlite Getting Started](https://pglite.dev/docs/) — official docs
2. [PGlite API Reference](https://pglite.dev/docs/api)
3. [PGlite Filesystems](https://pglite.dev/docs/filesystems) — storage options
4. [PGlite Live Queries](https://pglite.dev/docs/live-queries) — live extension API
5. [PGlite Extensions](https://pglite.dev/extensions/) — available extensions
6. [PGlite React Hooks](https://pglite.dev/docs/framework-hooks/react) — useLiveQuery, PGliteProvider
7. [Drizzle ORM + PGlite Connection](https://orm.drizzle.team/docs/connect-pglite)
8. [Drizzle ORM Get Started with PGlite](https://orm.drizzle.team/docs/get-started/pglite-new)
9. [Drizzle ORM PostgreSQL Column Types](https://orm.drizzle.team/docs/column-types/pg) — JSONB, UUID, etc.
10. [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)
11. [Drizzle ORM CRUD: Insert](https://orm.drizzle.team/docs/insert), [Select](https://orm.drizzle.team/docs/select), [Update](https://orm.drizzle.team/docs/update)
12. [PGlite ORM Support](https://pglite.dev/docs/orm-support) — Drizzle integration notes
13. [drizzle-kit push](https://orm.drizzle.team/docs/drizzle-kit-push) — code-first schema push
14. [Browser Migrations Discussion](https://github.com/drizzle-team/drizzle-orm/discussions/2532)
15. [GitHub: electric-sql/pglite](https://github.com/electric-sql/pglite)
16. [GitHub: rphlmr/drizzle-on-indexeddb](https://github.com/rphlmr/drizzle-on-indexeddb) — browser migration example
