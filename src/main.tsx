import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initDatabase } from "@/db";
import { ErrorBoundary } from "@/shell/ErrorBoundary";
import App from "./App";
import "./app.css";

async function boot() {
  await initDatabase();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

boot();
