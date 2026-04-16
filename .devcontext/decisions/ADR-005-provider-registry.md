# ADR-005: Extract Provider Registry to shared/providers.ts

**Date:** 2026-04-07
**Status:** Accepted
**Scope:** New file in shared/, modifications to src/shell/useSettings.ts and server/model.ts

## Context

Provider definitions (type union, model lists, display labels, API key hints) were duplicated across the codebase:

- `src/shell/useSettings.ts` defined `Provider` type, `MODELS`, `PROVIDER_LABELS`, `PROVIDER_KEY_HINTS`
- `server/model.ts` had hardcoded default model strings in a switch statement (e.g., `"gpt-4o"`, `"claude-sonnet-4-20250514"`)

Adding a new provider required editing 3+ files with no shared source of truth. Default model strings in server/model.ts had to be manually kept in sync with the client-side definitions.

## Decision

Create `shared/providers.ts` as the single source of truth for all provider metadata:

- `Provider` type union
- `PROVIDER_MODELS` -- available models per provider (dropdown options)
- `PROVIDER_LABELS` -- display names for UI
- `PROVIDER_KEY_HINTS` -- API key placeholder text
- `DEFAULT_MODEL` -- fallback model per provider (used by server)

Consumer files import from shared and re-export where needed for backward compatibility.

## Consequences

- Adding a new provider now requires editing only `shared/providers.ts` (definitions) + `server/model.ts` (SDK import/case)
- `src/shell/useSettings.ts` is reduced from ~107 lines of definitions to imports + re-exports
- `server/model.ts` uses `DEFAULT_MODEL[provider]` instead of hardcoded strings, eliminating sync risk
- `server/model.ts` parameter `provider` is now typed as `Provider` instead of `string`
- This adds a new file to `shared/` (per Invariant 5, contract changes require an ADR -- this document)
- No existing contracts were modified; this is purely additive
