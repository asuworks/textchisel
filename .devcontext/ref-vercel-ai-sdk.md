# Vercel AI SDK — Dev Reference

> Package: `ai` (npm) | Docs: https://ai-sdk.dev | Version: 6.x (2025-2026)

---

## 1. Installation

```bash
# Core SDK + major providers
npm install ai @ai-sdk/openai @ai-sdk/anthropic zod

# Ollama — community provider (built on official ollama package)
npm install ai-sdk-ollama

# Alternative: use OpenAI-compatible provider for Ollama
npm install @ai-sdk/openai-compatible
```

### Environment Variables

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
# Ollama needs no key — runs locally on http://localhost:11434
```

---

## 2. Provider Instances

```typescript
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

// Create model references (no network call yet)
const gpt4 = openai("gpt-4.1");
const gpt4o = openai("gpt-4o");
const gpt4mini = openai("gpt-4.1-mini");
const claude4sonnet = anthropic("claude-sonnet-4-20250514");
const claude4opus = anthropic("claude-opus-4-20250714");
```

### Ollama (Community Provider)

```typescript
// Option A: ai-sdk-ollama (recommended)
import { ollama } from "ai-sdk-ollama";
const local = ollama("llama3.1");

// Option B: OpenAI-compatible provider
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
const ollamaProvider = createOpenAICompatible({
  name: "ollama",
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama", // required but ignored
});
const local2 = ollamaProvider("llama3.1");
```

### Runtime Model Swapping Pattern

```typescript
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

// Registry pattern — swap models at runtime
const models: Record<string, LanguageModel> = {
  fast: openai("gpt-4.1-mini"),
  smart: openai("gpt-4.1"),
  claude: anthropic("claude-sonnet-4-20250514"),
};

function getModel(key: string): LanguageModel {
  const model = models[key];
  if (!model) throw new Error(`Unknown model: ${key}`);
  return model;
}

// Usage — model chosen by config/env/user input
const result = await generateText({
  model: getModel(process.env.AI_MODEL ?? "fast"),
  prompt: "Hello",
});
```

---

## 3. generateObject()

Generates a single structured object validated against a Zod schema.

### Full API

```typescript
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const { object, usage, finishReason } = await generateObject({
  // --- Required ---
  model: openai("gpt-4.1"),
  prompt: 'Analyze the sentiment of: "This product is amazing"',

  // --- Schema (required for output: 'object' | 'array') ---
  schema: z.object({
    sentiment: z
      .enum(["positive", "negative", "neutral"])
      .describe("Overall sentiment"),
    confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
    keywords: z.array(z.string()).describe("Key sentiment-bearing words"),
  }),
  schemaName: "SentimentAnalysis", // optional — hints to provider
  schemaDescription: "Sentiment analysis", // optional — hints to provider

  // --- Generation params ---
  temperature: 0, // 0-2 range, provider-dependent. Use temperature OR topP.
  topP: undefined, // Nucleus sampling (alternative to temperature)
  maxTokens: 1000, // Max output tokens
  maxRetries: 2, // Auto-retry on transient errors (default: 2)

  // --- Output mode ---
  output: "object", // 'object' (default) | 'array' | 'enum' | 'no-schema'

  // --- System prompt ---
  system: "You are a sentiment analysis engine.",

  // --- Messages (alternative to prompt) ---
  // messages: [{ role: 'user', content: 'Analyze...' }],

  // --- Abort ---
  abortSignal: undefined, // AbortSignal for cancellation
});

console.log(object);
// { sentiment: 'positive', confidence: 0.95, keywords: ['amazing'] }
console.log(usage);
// { promptTokens: 42, completionTokens: 18, totalTokens: 60 }
```

### Array Output Mode

```typescript
const { object: items } = await generateObject({
  model: openai("gpt-4.1"),
  output: "array",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
  }),
  prompt: "Generate 5 blog post ideas about TypeScript",
});
// items: Array<{ title: string; summary: string }>
```

### Enum Output Mode

```typescript
const { object: category } = await generateObject({
  model: openai("gpt-4.1"),
  output: "enum",
  enum: ["bug", "feature", "question", "docs"],
  prompt: 'Classify this issue: "The login button is broken"',
});
// category: 'bug'
```

### No-Schema Mode (Dynamic)

```typescript
const { object } = await generateObject({
  model: openai("gpt-4.1"),
  output: "no-schema",
  prompt: "Return JSON with the capital of France",
});
// object: unknown — no type safety, use when schema is dynamic
```

---

## 4. streamText()

Streams text tokens in real-time. Primary function for chat/completion UIs.

### Full API

```typescript
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

const result = streamText({
  // --- Required ---
  model: openai("gpt-4.1"),
  prompt: "Explain quantum computing in simple terms",

  // --- Or use messages ---
  // messages: [
  //   { role: 'system', content: 'You are helpful.' },
  //   { role: 'user', content: 'Explain quantum computing' },
  // ],

  // --- Generation params ---
  temperature: 0.7,
  maxTokens: 2000,
  topP: undefined,
  maxRetries: 2,
  system: "You are a helpful assistant.",

  // --- Callbacks ---
  onChunk: ({ chunk }) => {
    // Called for each chunk (text-delta, tool-call, etc.)
  },
  onFinish: ({ text, usage, finishReason }) => {
    // Called when stream completes
    console.log("Total tokens:", usage.totalTokens);
  },
  onError: ({ error }) => {
    // Called on stream error (added in v4.1.22)
    console.error("Stream error:", error);
  },

  // --- Tools (function calling) ---
  // tools: { ... },
  // maxSteps: 5,

  // --- Abort ---
  abortSignal: undefined,
});
```

### Consuming the Stream in Node.js

```typescript
// Option A: Async iterator
for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}

// Option B: Await full text
const fullText = await result.text;
console.log(fullText);

// Option C: Get all parts
for await (const part of result.fullStream) {
  switch (part.type) {
    case "text-delta":
      process.stdout.write(part.textDelta);
      break;
    case "finish":
      console.log("\nDone:", part.usage);
      break;
  }
}
```

### SSE to Frontend — Next.js API Route (v5 style, still works in v6)

```typescript
// app/api/chat/route.ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4.1"),
    messages,
  });

  // Returns SSE-compatible Response
  return result.toDataStreamResponse();
}
```

### SSE to Frontend — Server Action (v6 preferred)

```typescript
// app/actions.ts
"use server";

import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { UIMessage } from "ai";

export async function chat(messages: UIMessage[]) {
  const result = streamText({
    model: openai("gpt-4.1"),
    messages,
  });

  return result.toUIMessageStreamResponse();
}
```

### Express / Plain Node.js

```typescript
import express from "express";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

const app = express();
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  const result = streamText({
    model: openai("gpt-4.1"),
    messages,
  });

  // Pipes SSE stream to response
  result.pipeDataStreamToResponse(res);
});

app.listen(3001);
```

---

## 5. React Hooks

Import from `@ai-sdk/react` (installed with the `ai` package).

### useChat — Multi-turn Chat

```typescript
'use client';
import { useChat } from '@ai-sdk/react';

export function ChatUI() {
  const {
    messages,      // UIMessage[] — full conversation
    input,         // string — current input value
    handleInputChange,
    handleSubmit,  // form onSubmit handler
    isLoading,     // boolean — stream in progress
    error,         // Error | undefined
    reload,        // retry last assistant message
    stop,          // abort current stream
    setMessages,   // manually set messages
    append,        // programmatically add a message
  } = useChat({
    // Connect to API route (v5 style)
    api: '/api/chat',

    // OR connect to Server Action (v6 style)
    // handler: chat,  // imported Server Action

    // Optional config
    initialMessages: [],
    body: { userId: '123' },   // extra data sent with each request
    headers: { 'X-Custom': 'value' },
    onFinish: (message) => {
      console.log('Assistant replied:', message.content);
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}

      {error && <div className="error">{error.message}</div>}

      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
        {isLoading && <button onClick={stop}>Stop</button>}
      </form>
    </div>
  );
}
```

### useCompletion — Single-turn Text Completion

```typescript
'use client';
import { useCompletion } from '@ai-sdk/react';

export function CompletionUI() {
  const {
    completion,        // string — streamed completion text
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    complete,          // programmatically trigger completion
  } = useCompletion({
    api: '/api/completion',
  });

  return (
    <div>
      <p>{completion}</p>
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit" disabled={isLoading}>Complete</button>
      </form>
    </div>
  );
}
```

### useObject — Stream Structured Objects

```typescript
'use client';
import { useObject } from '@ai-sdk/react';
import { z } from 'zod';

const schema = z.object({
  title: z.string(),
  summary: z.string(),
});

export function ObjectStreamUI() {
  const { object, submit, isLoading, error } = useObject({
    api: '/api/analyze',
    schema,
  });

  return (
    <div>
      <button onClick={() => submit('Analyze this text')}>Analyze</button>
      {isLoading && <p>Loading...</p>}
      {object && (
        <div>
          <h2>{object.title}</h2>
          <p>{object.summary}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 6. Error Handling

### Error Types

| Error Class              | When                                | Key Properties                            |
| ------------------------ | ----------------------------------- | ----------------------------------------- |
| `AI_APICallError`        | Provider HTTP error (401, 429, 500) | `statusCode`, `message`, `isRetryable`    |
| `AI_RetryError`          | All retries exhausted               | `lastError`, `errors` (array of attempts) |
| `AI_JSONParseError`      | Malformed JSON from provider        | `text` (raw response)                     |
| `AI_TypeValidationError` | Object doesn't match Zod schema     | `value`, `cause`                          |
| `AI_NoSuchModelError`    | Invalid model identifier            | `modelId`                                 |

### Server-Side Pattern

```typescript
import { generateObject, APICallError, RetryError } from "ai";

async function safeGenerate(prompt: string) {
  try {
    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: mySchema,
      prompt,
      maxRetries: 3, // built-in retry with exponential backoff
    });
    return { ok: true, data: object };
  } catch (error) {
    if (APICallError.isInstance(error)) {
      if (error.statusCode === 429) {
        // Rate limited — back off or queue
        console.error("Rate limited. Retry after backoff.");
        return { ok: false, error: "rate_limited" };
      }
      if (error.statusCode === 401) {
        console.error("Invalid API key");
        return { ok: false, error: "auth_failed" };
      }
      console.error(`API error ${error.statusCode}: ${error.message}`);
      return { ok: false, error: "api_error" };
    }
    if (RetryError.isInstance(error)) {
      console.error("All retries failed:", error.lastError);
      return { ok: false, error: "retries_exhausted" };
    }
    throw error; // Unknown error — rethrow
  }
}
```

### Manual Retry with Exponential Backoff

```typescript
import { generateText, APICallError } from "ai";

async function withBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  // Disable SDK auto-retry to control it manually
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (
        APICallError.isInstance(error) &&
        error.statusCode === 429 &&
        attempt < maxRetries
      ) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unreachable");
}

// Usage
const result = await withBackoff(() =>
  generateText({
    model: openai("gpt-4.1"),
    prompt: "Hello",
    maxRetries: 0, // disable built-in retry
  }),
);
```

### Client-Side (useChat) Error Handling

```typescript
const { messages, error, reload } = useChat({
  api: '/api/chat',
  onError: (err) => {
    // Log or show toast
    toast.error('AI request failed. Try again.');
  },
});

// In JSX
{error && (
  <div className="error-banner">
    <p>Something went wrong.</p>
    <button onClick={() => reload()}>Retry</button>
  </div>
)}
```

### streamText onError Callback

```typescript
const result = streamText({
  model: openai("gpt-4.1"),
  messages,
  onError: ({ error }) => {
    // Log mid-stream errors (e.g., connection drop)
    console.error("Stream error:", error);
    // Optionally persist for debugging
  },
});
```

---

## 7. Quick Patterns

### generateText (simple text, no schema)

```typescript
import { generateText } from "ai";
const { text } = await generateText({
  model: openai("gpt-4.1"),
  prompt: "Write a haiku about TypeScript",
});
```

### streamObject (stream structured data)

```typescript
import { streamObject } from "ai";
const result = streamObject({
  model: openai("gpt-4.1"),
  schema: mySchema,
  prompt: "Analyze this review...",
});
for await (const partialObject of result.partialObjectStream) {
  console.log(partialObject); // partially filled object, updates as tokens arrive
}
```

### Tool Calling

```typescript
import { generateText, tool } from "ai";
import { z } from "zod";

const result = await generateText({
  model: openai("gpt-4.1"),
  prompt: "What is the weather in London?",
  tools: {
    getWeather: tool({
      description: "Get current weather for a city",
      parameters: z.object({
        city: z.string().describe("City name"),
      }),
      execute: async ({ city }) => {
        // Call real API
        return { temp: 18, condition: "cloudy" };
      },
    }),
  },
  maxSteps: 3, // allow multi-step tool use
});
```

---

## Sources

- https://ai-sdk.dev/docs/introduction
- https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object
- https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
- https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-completion
- https://ai-sdk.dev/docs/ai-sdk-core/error-handling
- https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
- https://ai-sdk.dev/providers/community-providers/ollama
- https://vercel.com/blog/ai-sdk-6
