import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { temporal } from "zundo";
import { SESSION_STATUS } from "@shared/types";
import type {
  Dimension,
  EvaluationScore,
  SessionStatus,
  SuggestedDimension,
  GeneratedDimensions,
} from "@shared/types";
import {
  createDimensions as dbCreateDimensions,
  updateDimension as dbUpdateDimension,
} from "@/dimensions/crud";

// --- State shape ---

interface SessionState {
  sessionId: string | null;
  intent: string;
  dimensions: Dimension[];
  currentText: string;
  currentScores: Record<string, EvaluationScore>;
  streamingText: string;
  error: string | null;
  sessionStatus: SessionStatus;
}

interface EvaluationState {
  targetScores: Record<string, number>;
  lockedDimensions: Record<string, boolean>;
}

interface UIState {
  sidebarOpen: boolean;
  suggestedDimensions: SuggestedDimension[];
}

interface Actions {
  // Session actions
  setSessionId: (id: string | null) => void;
  setIntent: (intent: string) => void;
  setDimensions: (dims: Dimension[]) => void;
  setCurrentText: (text: string) => void;
  setCurrentScores: (scores: Record<string, EvaluationScore>) => void;
  setStreamingText: (text: string) => void;
  setError: (error: string | null) => void;
  setSessionStatus: (status: SessionStatus) => void;
  clearError: () => void;

  // Dimension CRUD actions
  createAndPersistDimensions: (
    sessionId: string,
    dims: GeneratedDimensions["dimensions"],
  ) => Promise<Dimension[] | null>;
  updateDimension: (
    id: string,
    updates: Partial<
      Pick<
        Dimension,
        | "name"
        | "description"
        | "rubric"
        | "evalPrompt"
        | "rewriteHint"
        | "examples"
      >
    >,
  ) => void;
  addDimension: (dim: Dimension) => void;
  removeDimension: (id: string) => void;

  // Evaluation actions
  setTargetScore: (dimensionId: string, score: number) => void;
  toggleLock: (dimensionId: string) => void;

  // UI actions
  toggleSidebar: () => void;
  setSuggestedDimensions: (dims: SuggestedDimension[]) => void;
  consumeSuggestion: (index: number) => void;
}

export type AppState = SessionState & EvaluationState & UIState & Actions;

// --- Store ---
// Middleware order (outside → inside): devtools → persist → temporal → immer

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      temporal(
        immer((set) => ({
          // --- Session state ---
          sessionId: null,
          intent: "",
          dimensions: [],
          currentText: "",
          currentScores: {},
          streamingText: "",
          error: null,
          sessionStatus: SESSION_STATUS.IDLE as SessionStatus,

          setSessionId: (id) =>
            set((state) => {
              state.sessionId = id;
            }),
          setIntent: (intent) =>
            set((state) => {
              state.intent = intent;
            }),
          setDimensions: (dims) =>
            set((state) => {
              state.dimensions = dims;
            }),
          setCurrentText: (text) =>
            set((state) => {
              state.currentText = text;
            }),
          setCurrentScores: (scores) =>
            set((state) => {
              state.currentScores = scores;
            }),
          setStreamingText: (text) =>
            set((state) => {
              state.streamingText = text;
            }),
          setError: (error) =>
            set((state) => {
              state.error = error;
            }),
          setSessionStatus: (status) =>
            set((state) => {
              state.sessionStatus = status;
            }),
          clearError: () =>
            set((state) => {
              state.error = null;
              state.sessionStatus = SESSION_STATUS.IDLE;
            }),

          // --- Dimension CRUD ---
          createAndPersistDimensions: async (sessionId, dims) => {
            const created = await dbCreateDimensions(sessionId, dims);
            if (created) {
              set((state) => {
                state.dimensions = created;
              });
            }
            return created;
          },
          updateDimension: (id, updates) => {
            set((state) => {
              const dim = state.dimensions.find((d) => d.id === id);
              if (dim) {
                // If substantive fields change (not just meta-prompt updates),
                // clear cached Tier 1 meta-prompts — they describe the old rubric
                const substantiveChange =
                  "rubric" in updates ||
                  "name" in updates ||
                  "description" in updates;
                const metaPromptUpdate =
                  "evalPrompt" in updates || "rewriteHint" in updates;
                if (substantiveChange && !metaPromptUpdate) {
                  dim.evalPrompt = null;
                  dim.rewriteHint = null;
                }
                Object.assign(dim, updates);
                // Clear stale score — rubric/definition changed, old evaluation is invalid
                delete state.currentScores[id];
              }
            });
            // Fire-and-forget persistence
            void dbUpdateDimension(id, updates);
          },
          addDimension: (dim) =>
            set((state) => {
              state.dimensions.push(dim);
            }),
          removeDimension: (id) =>
            set((state) => {
              state.dimensions = state.dimensions.filter((d) => d.id !== id);
              delete state.targetScores[id];
              delete state.currentScores[id];
              delete state.lockedDimensions[id];
            }),

          // --- Evaluation state ---
          targetScores: {},
          lockedDimensions: {},
          setTargetScore: (dimensionId, score) =>
            set((state) => {
              state.targetScores[dimensionId] = score;
            }),
          toggleLock: (dimensionId) =>
            set((state) => {
              state.lockedDimensions[dimensionId] =
                !state.lockedDimensions[dimensionId];
            }),

          // --- UI state ---
          sidebarOpen: true,
          suggestedDimensions: [],
          toggleSidebar: () =>
            set((state) => {
              state.sidebarOpen = !state.sidebarOpen;
            }),
          setSuggestedDimensions: (dims) =>
            set((state) => {
              state.suggestedDimensions = dims;
            }),
          consumeSuggestion: (index) =>
            set((state) => {
              state.suggestedDimensions.splice(index, 1);
            }),
        })),
        {
          // Temporal: only track user-authored state for undo/redo
          partialize: (state) => ({
            intent: state.intent,
            targetScores: state.targetScores,
            lockedDimensions: state.lockedDimensions,
          }),
          limit: 50,
        },
      ),
      {
        // Persist: save to localStorage
        name: "textchisel-storage",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          sessionId: state.sessionId,
          intent: state.intent,
          dimensions: state.dimensions,
          currentText: state.currentText,
          currentScores: state.currentScores,
          targetScores: state.targetScores,
          lockedDimensions: state.lockedDimensions,
          sidebarOpen: state.sidebarOpen,
          suggestedDimensions: state.suggestedDimensions,
        }),
      },
    ),
    { name: "TextChisel Store" },
  ),
);
