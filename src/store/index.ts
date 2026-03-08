import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { temporal } from 'zundo'
import type { SessionStatus } from '@shared/types'

// --- State shape ---

interface PromptState {
  systemPrompt: string
  userTemplate: string
  setSystemPrompt: (prompt: string) => void
  setUserTemplate: (template: string) => void
}

interface EvaluationState {
  targetScores: Record<string, number>
  lockedDimensions: Set<string>
  setTargetScore: (dimensionId: string, score: number) => void
  toggleLock: (dimensionId: string) => void
}

interface UIState {
  activeSessionId: string | null
  sessionStatus: SessionStatus | null
  sidebarOpen: boolean
  setActiveSession: (id: string | null) => void
  setSessionStatus: (status: SessionStatus | null) => void
  toggleSidebar: () => void
}

export type AppState = PromptState & EvaluationState & UIState

// --- Store ---
// Middleware order (outside → inside): devtools → persist → temporal → immer

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      temporal(
        immer((set) => ({
          // --- Prompt slice ---
          systemPrompt: '',
          userTemplate: '',
          setSystemPrompt: (prompt) =>
            set((state) => {
              state.systemPrompt = prompt
            }),
          setUserTemplate: (template) =>
            set((state) => {
              state.userTemplate = template
            }),

          // --- Evaluation slice ---
          targetScores: {},
          lockedDimensions: new Set<string>(),
          setTargetScore: (dimensionId, score) =>
            set((state) => {
              state.targetScores[dimensionId] = score
            }),
          toggleLock: (dimensionId) =>
            set((state) => {
              if (state.lockedDimensions.has(dimensionId)) {
                state.lockedDimensions.delete(dimensionId)
              } else {
                state.lockedDimensions.add(dimensionId)
              }
            }),

          // --- UI slice ---
          activeSessionId: null,
          sessionStatus: null,
          sidebarOpen: true,
          setActiveSession: (id) =>
            set((state) => {
              state.activeSessionId = id
            }),
          setSessionStatus: (status) =>
            set((state) => {
              state.sessionStatus = status
            }),
          toggleSidebar: () =>
            set((state) => {
              state.sidebarOpen = !state.sidebarOpen
            }),
        })),
        {
          // Temporal: only track data state, not UI
          partialize: (state) => ({
            systemPrompt: state.systemPrompt,
            userTemplate: state.userTemplate,
            targetScores: state.targetScores,
          }),
          limit: 50,
        }
      ),
      {
        // Persist: save to localStorage
        name: 'textchisel-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          systemPrompt: state.systemPrompt,
          userTemplate: state.userTemplate,
          targetScores: state.targetScores,
          sidebarOpen: state.sidebarOpen,
        }),
      }
    ),
    { name: 'TextChisel Store' }
  )
)
