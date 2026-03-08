import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { llmRouter } from "./routes/llm.js";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

app.use(cors());
app.use(express.json());

// --- API routes ---
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/llm", llmRouter);

// --- Production: serve SPA ---
if (isProd) {
  const clientDist = path.resolve(__dirname, "../client");
  app.use(express.static(clientDist, { index: false }));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
