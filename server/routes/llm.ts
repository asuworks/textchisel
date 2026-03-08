import { Router } from "express";

export const llmRouter = Router();

// Placeholder — LLM proxy routes will be added during module construction.
// Each route will use Vercel AI SDK (generateObject / streamText) server-side
// so API keys stay out of the browser.

llmRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", provider: "none" });
});
