# Vite + React 19 + Express Project Setup Reference Guide

Generated: 2026-03-08
For: textchisel full-stack SPA with SSE streaming

---

## Table of Contents

1. [Scaffold a Vite + React 19 + TypeScript Project](#1-scaffold-a-vite--react-19--typescript-project)
2. [Monorepo Directory Structure](#2-monorepo-directory-structure)
3. [Vite Configuration](#3-vite-configuration)
4. [Express Server: Dev + Production](#4-express-server-dev--production)
5. [SSE (Server-Sent Events)](#5-sse-server-sent-events)
6. [Environment Variables](#6-environment-variables)
7. [Package.json Scripts](#7-packagejson-scripts)
8. [Sources](#8-sources)

---

## 1. Scaffold a Vite + React 19 + TypeScript Project

### Prerequisites

Node.js 20.19+ or 22.12+ (required by Vite 6).

### Create Project

```bash
npm create vite@latest textchisel -- --template react-ts
cd textchisel
npm install
```

This scaffolds with React 19, TypeScript, and `@vitejs/plugin-react` (Babel-based). For faster builds, swap to the SWC variant:

```bash
npm install -D @vitejs/plugin-react-swc
```

Then in `vite.config.ts`, replace:

```typescript
import react from "@vitejs/plugin-react-swc";
```

### Key Dependencies

```bash
# Frontend
npm install react@19 react-dom@19

# Backend
npm install express dotenv cors
npm install -D @types/express @types/cors tsx typescript

# Dev tooling
npm install -D concurrently
```

---

## 2. Monorepo Directory Structure

```
textchisel/
├── server/
│   ├── index.ts          # Express entry point
│   ├── routes/
│   │   ├── api.ts        # REST endpoints
│   │   └── sse.ts        # SSE endpoint
│   └── tsconfig.json     # Server-specific TS config (NodeNext)
├── src/
│   ├── main.tsx          # React entry point
│   ├── App.tsx
│   ├── components/
│   ├── hooks/
│   │   └── useSSE.ts     # EventSource hook
│   └── vite-env.d.ts
├── shared/
│   └── types.ts          # Types shared between client & server
├── public/               # Static assets (served as-is)
├── index.html            # Vite HTML entry (project root)
├── vite.config.ts
├── tsconfig.json         # Root (references server + src)
├── tsconfig.node.json    # For vite.config.ts itself
├── .env                  # Shared env vars
├── .env.local            # Local overrides (gitignored)
└── package.json
```

### TypeScript Project References

Root `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@shared/*": ["./shared/*"]
    }
  },
  "references": [{ "path": "./tsconfig.node.json" }],
  "include": ["src", "shared"]
}
```

`server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "..",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": [".", "../shared"]
}
```

---

## 3. Vite Configuration

### vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },

  // Dev server with proxy to Express backend
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/sse": {
        target: "http://localhost:3001",
        changeOrigin: true,
        // SSE requires no response buffering
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["cache-control"] = "no-cache";
            proxyRes.headers["content-type"] = "text/event-stream";
          });
        },
      },
    },
  },

  build: {
    outDir: "dist/client",
    sourcemap: true,
  },
});
```

### How the Proxy Works

In development, two servers run:

- **Vite** on `http://localhost:5173` — serves React app with HMR
- **Express** on `http://localhost:3001` — handles API + SSE

The `server.proxy` config intercepts requests matching `/api` or `/sse` from the browser and forwards them to Express. The browser only ever talks to port 5173. This avoids CORS issues entirely during development.

---

## 4. Express Server: Dev + Production

### server/index.ts

```typescript
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

app.use(cors());
app.use(express.json());

// ---------- API routes ----------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ... mount other API routers here
// import apiRouter from './routes/api.js'
// app.use('/api', apiRouter)

// ---------- SSE route ----------
// (see Section 5 for full implementation)
// import { sseRouter } from './routes/sse.js'
// app.use('/sse', sseRouter)

// ---------- Production: serve SPA ----------
if (isProd) {
  const clientDist = path.resolve(__dirname, "../client");

  // Serve static assets (JS, CSS, images)
  app.use(express.static(clientDist, { index: false }));

  // SPA catch-all: all non-API GET requests serve index.html
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

### Key Production Detail

`express.static(clientDist, { index: false })` serves files from `dist/client/` but does NOT auto-serve `index.html` for `/`. This lets the catch-all `app.get('*')` handle it, ensuring client-side routing works for all paths.

**Route order matters:** Mount all `/api` and `/sse` routes BEFORE the static middleware and catch-all. Otherwise the catch-all swallows API requests.

---

## 5. SSE (Server-Sent Events)

### Server: Express SSE Endpoint

`server/routes/sse.ts`:

```typescript
import { Router, Request, Response } from "express";

export const sseRouter = Router();

// Track active connections for broadcasting
const clients = new Map<string, Response>();

sseRouter.get("/stream", (req: Request, res: Response) => {
  // --- Required SSE headers ---
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering if proxied
  res.flushHeaders();

  // Unique client ID
  const clientId = crypto.randomUUID();
  clients.set(clientId, res);

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

  // Heartbeat to keep connection alive (every 30s)
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`); // Comment line, ignored by EventSource
  }, 30_000);

  // Cleanup on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
});

// Helper: send event to a specific client
export function sendEvent(
  clientId: string,
  event: string,
  data: unknown,
): void {
  const res = clients.get(clientId);
  if (!res) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Helper: broadcast to all clients
export function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients.values()) {
    res.write(payload);
  }
}
```

### SSE Wire Format

Each message uses this text protocol:

```
event: eventName\n
data: {"json":"payload"}\n
id: optional-id-for-resumption\n
retry: 3000\n
\n
```

- `event:` — custom event name (client listens with `addEventListener`)
- `data:` — payload (multi-line allowed with repeated `data:` lines)
- `id:` — last-event ID; on reconnect, browser sends `Last-Event-ID` header
- `retry:` — reconnection delay in ms (browser default is ~3s)
- Blank line (`\n\n`) terminates the message

### Important: Disable Compression Middleware for SSE

If using `compression()` middleware, exclude SSE routes or it will buffer the stream:

```typescript
import compression from "compression";

app.use(
  compression({
    filter: (req) => {
      // Don't compress SSE responses
      if (req.path.startsWith("/sse")) return false;
      return compression.filter(req, req.res!);
    },
  }),
);
```

### Client: React Hook with EventSource

`src/hooks/useSSE.ts`:

```typescript
import { useEffect, useRef, useCallback, useState } from "react";

interface UseSSEOptions {
  url: string;
  events: Record<string, (data: unknown) => void>;
  enabled?: boolean;
}

export function useSSE({ url, events, enabled = true }: UseSSEOptions) {
  const [status, setStatus] = useState<"connecting" | "open" | "closed">(
    "closed",
  );
  const sourceRef = useRef<EventSource | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events; // Always use latest handlers without reconnecting

  const connect = useCallback(() => {
    if (!enabled) return;

    const es = new EventSource(url);
    sourceRef.current = es;

    es.onopen = () => setStatus("open");

    es.onerror = () => {
      setStatus("connecting");
      // EventSource auto-reconnects for network errors.
      // For fatal errors (non-2xx response), readyState becomes CLOSED.
      if (es.readyState === EventSource.CLOSED) {
        setStatus("closed");
      }
    };

    // Register named event listeners
    for (const eventName of Object.keys(eventsRef.current)) {
      es.addEventListener(eventName, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          eventsRef.current[eventName]?.(data);
        } catch {
          eventsRef.current[eventName]?.(e.data);
        }
      });
    }

    return es;
  }, [url, enabled]);

  useEffect(() => {
    const es = connect();
    return () => {
      es?.close();
      setStatus("closed");
    };
  }, [connect]);

  const close = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setStatus("closed");
  }, []);

  return { status, close };
}
```

### Usage in a Component

```tsx
import { useSSE } from "@/hooks/useSSE";
import { useState } from "react";

function ProcessingStatus() {
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);

  const { status } = useSSE({
    url: "/sse/stream",
    events: {
      connected: (data) => console.log("SSE connected:", data),
      progress: (data: any) => setProgress(data.percent),
      complete: (data: any) => setResult(data.output),
    },
  });

  return (
    <div>
      <p>Connection: {status}</p>
      <progress value={progress} max={100} />
      {result && <pre>{result}</pre>}
    </div>
  );
}
```

### EventSource Reconnection Behavior

| Scenario                           | Browser Behavior                               |
| ---------------------------------- | ---------------------------------------------- |
| Network error / timeout            | Auto-reconnects after `retry` ms (default ~3s) |
| Server sends `retry: 5000`         | Reconnects after 5 seconds                     |
| Server returns non-2xx (e.g., 500) | Stops reconnecting, `readyState` = CLOSED      |
| Server returns 204 No Content      | Stops reconnecting                             |
| Client calls `close()`             | Stops reconnecting                             |
| Server sends `id: 42` then drops   | Browser sends `Last-Event-ID: 42` on reconnect |

---

## 6. Environment Variables

### Vite (Client-Side)

Vite uses dotenv internally. Only variables prefixed with `VITE_` are exposed to client code.

`.env`:

```bash
# Exposed to client (bundled into JS — never put secrets here)
VITE_APP_TITLE=TextChisel
VITE_API_BASE_URL=/api

# NOT exposed to client (no VITE_ prefix)
DATABASE_URL=postgres://localhost/textchisel
OPENAI_API_KEY=sk-...
```

**Accessing in client code:**

```typescript
const title = import.meta.env.VITE_APP_TITLE; // "TextChisel"
const mode = import.meta.env.MODE; // "development" | "production"
const dev = import.meta.env.DEV; // true in dev
const prod = import.meta.env.PROD; // true in production
```

**TypeScript support** — add to `src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### .env File Loading Order (Vite)

| File                     | Loaded When  | Git       |
| ------------------------ | ------------ | --------- |
| `.env`                   | Always       | Commit    |
| `.env.local`             | Always       | Gitignore |
| `.env.development`       | `vite dev`   | Commit    |
| `.env.development.local` | `vite dev`   | Gitignore |
| `.env.production`        | `vite build` | Commit    |
| `.env.production.local`  | `vite build` | Gitignore |

Mode-specific files take priority over generic ones.

### Express (Server-Side)

Express has no built-in .env support. Use `dotenv`:

```typescript
import dotenv from "dotenv";
dotenv.config(); // Reads .env from project root

const apiKey = process.env.OPENAI_API_KEY; // available
const port = process.env.PORT || "3001";
```

All variables from `.env` are available via `process.env` on the server (no prefix filtering). Guard secrets by never prefixing them with `VITE_`.

### .gitignore entries

```
.env.local
.env.*.local
```

---

## 7. Package.json Scripts

### Root package.json

```json
{
  "name": "textchisel",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -n client,server -c blue,green \"npm run dev:client\" \"npm run dev:server\"",
    "dev:client": "vite",
    "dev:server": "tsx watch server/index.ts",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "tsc -p server/tsconfig.json",
    "start": "NODE_ENV=production node server/dist/server/index.js",
    "preview": "npm run build && npm run start",
    "typecheck": "tsc --noEmit && tsc -p server/tsconfig.json --noEmit"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "concurrently": "^9.1.2",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vite": "^6.1.0"
  }
}
```

### Script Breakdown

| Script               | What It Does                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`        | Starts Vite (port 5173) and Express (port 3001) in parallel via concurrently. Vite proxies `/api` and `/sse` to Express. |
| `npm run dev:client` | Vite dev server only (HMR, fast refresh).                                                                                |
| `npm run dev:server` | Express via `tsx watch` — auto-restarts on file changes.                                                                 |
| `npm run build`      | Builds client to `dist/client/` then compiles server TS to `dist/server/`.                                               |
| `npm run start`      | Production mode. Express serves API + SSE + static SPA from `dist/client/`. Single port.                                 |
| `npm run preview`    | Build then start — test production locally.                                                                              |
| `npm run typecheck`  | Type-check both client and server without emitting files.                                                                |

### Why `tsx watch`?

`tsx` runs TypeScript directly via esbuild (no compile step). The `watch` flag restarts the server on file changes. This is the fastest DX for Node + TypeScript.

### Development Flow

```
Browser → http://localhost:5173
              │
              ├── /src/** requests → Vite HMR (React)
              │
              ├── /api/** requests → proxy → Express :3001
              │
              └── /sse/** requests → proxy → Express :3001
```

### Production Flow

```
Browser → http://localhost:3001 (single port)
              │
              ├── /api/** → Express route handlers
              │
              ├── /sse/** → Express SSE handlers
              │
              └── /* → express.static(dist/client) → index.html (SPA catch-all)
```

---

## 8. Sources

- [Vite: Getting Started](https://vite.dev/guide/) — Official scaffold commands and project templates
- [Vite: Server Options (proxy)](https://vite.dev/config/server-options) — Proxy configuration reference
- [Vite: Env Variables and Modes](https://vite.dev/guide/env-and-mode) — VITE\_ prefix, .env loading order
- [Vite: Building for Production](https://vite.dev/guide/build) — Build output and configuration
- [@vitejs/plugin-react (npm)](https://www.npmjs.com/package/@vitejs/plugin-react) — React plugin options
- [MDN: Using Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) — EventSource API, wire format, reconnection
- [MDN: EventSource error event](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/error_event) — Error handling and readyState
- [Express + Vite SPA: Same Port Dev or Prod](https://dev.to/herudi/single-port-spa-react-and-express-using-vite-same-port-in-dev-or-prod-2od4) — Production static serving pattern
- [Connecting React (Vite) to Express via Proxy](https://medium.com/@amolakapadi/connecting-react-vite-frontend-to-express-backend-using-proxy-step-by-step-guide-7eea23608727) — Step-by-step proxy setup
- [Express SSE: Real-Time Data Streaming](https://dev.to/serifcolakel/real-time-data-streaming-with-server-sent-events-sse-1gb2) — SSE endpoint patterns
- [React Monorepo with Express (GitHub)](https://github.com/probir-sarkar/react-express-monorepo) — Monorepo structure reference
- [Complete Guide: React + TypeScript + Vite (2026)](https://medium.com/@robinviktorsson/complete-guide-to-setting-up-react-with-typescript-and-vite-2025-468f6556aaf2) — Full setup walkthrough
