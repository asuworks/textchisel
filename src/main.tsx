import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initDatabase } from "@/db";
import { ErrorBoundary } from "@/shell/ErrorBoundary";
import App from "./App";
import "./app.css";

function boot() {
  // Render immediately — state persists via localStorage/Zustand.
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );

  // PGlite init in background — non-blocking, optional for long-term DB persistence.
  initDatabase().catch((err) => {
    console.warn(
      "[textchisel] PGlite init failed (app runs without DB persistence):",
      err,
    );
  });
}

boot();
