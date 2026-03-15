---
phase: 02-display-rendering-and-theming
plan: "02"
subsystem: theming
tags: [node, commonjs, ayah-selection, theme-resolution, no-repeat, session-state]

# Dependency graph
requires:
  - phase: 02-display-rendering-and-theming-01
    provides: load-ayah.js — random single-ayah loader from fallback.json
  - phase: 01-foundation-and-hook-scaffold
    provides: fallback.json dataset with multi-theme ayah objects
provides:
  - scripts/lib/select-ayah.js — theme resolution + no-repeat ayah selection module
  - scripts/lib/select-ayah.test.js — unit tests covering THEME-01 through THEME-04
  - resolveTheme(toolName) — maps tool name to theme string (never null)
  - selectAyah(toolName, sessionId, pluginRoot) — session-aware non-repeating ayah selector
affects:
  - hook scripts (PreToolUse, SessionStart) — call selectAyah as their decision layer
  - render-panel.js — receives ayah object returned by selectAyah

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "No-repeat session state persisted to /tmp/claude-code-quran-sessions/{sessionId}.json as JSON array of ayah keys"
    - "Pool reset on exhaustion — never null unless data is genuinely missing"
    - "Zero-crash guarantee: entire selectAyah body in try/catch"
    - "Tool name lookup is case-sensitive exact match (per Claude Code docs)"

key-files:
  created:
    - scripts/lib/select-ayah.js
    - scripts/lib/select-ayah.test.js
  modified: []

key-decisions:
  - "selectAyah reads fallback.json directly (not via loadAyah) to get full theme pool for no-repeat filtering — loadAyah only returns one random item"
  - "resolveTheme never returns null — always produces a theme string (tool map hit or time-of-day fallback)"
  - "When sessionId is falsy (empty/undefined), no-repeat tracking is skipped entirely — random selection still works"
  - "Pool reset strategy on exhaustion: reset to full theme pool rather than returning null"

patterns-established:
  - "TOOL_THEME_MAP: case-sensitive exact-match object for O(1) tool→theme lookup"
  - "resolveTimeOfDayTheme: hour-based bucketing into 3 windows (Fajr/Dhuhr-Asr/Maghrib-Isha)"
  - "Session state file: /tmp/claude-code-quran-sessions/{sessionId}.json — JSON array of 'surah:ayah' keys"

requirements-completed: [THEME-01, THEME-02, THEME-03, THEME-04]

# Metrics
duration: 8min
completed: 2026-03-15
---

# Phase 2 Plan 02: select-ayah.js Summary

**Tool-type and time-of-day theme resolution with session-scoped no-repeat ayah selection, implemented TDD with 20 passing tests.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T00:04:33Z
- **Completed:** 2026-03-15T00:12:00Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 2

## Accomplishments

- `resolveTheme(toolName)` maps Read/Grep/Glob/LS → ilm, Bash → tawakkul, Write/Edit → ihsan, with time-of-day fallback for unknown tools (THEME-01, THEME-02, THEME-03)
- `selectAyah(toolName, sessionId, pluginRoot)` reads the full theme pool from fallback.json, excludes already-displayed ayahs per session, resets on exhaustion (THEME-04)
- Session state persisted as JSON array in /tmp/claude-code-quran-sessions/{sessionId}.json — idempotent across restarts
- Zero-crash guarantee via try/catch and DATA-05 silent failure on all I/O operations

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — failing select-ayah tests** - `06eccf2` (test)
2. **Task 2: GREEN — select-ayah.js implementation** - `9ce5d66` (feat)

_Note: TDD tasks have two commits (test RED → feat GREEN)_

## Files Created/Modified

- `scripts/lib/select-ayah.test.js` — 20 unit tests covering THEME-01 through THEME-04; assert-and-report pattern matching load-ayah.test.js style
- `scripts/lib/select-ayah.js` — resolveTheme, resolveTimeOfDayTheme, selectAyah, loadAyahsForTheme, getDisplayedIds, saveDisplayedId

## Decisions Made

- `selectAyah` reads `fallback.json` directly (not via `loadAyah`) to obtain the full filtered pool for no-repeat exclusion — `loadAyah` only returns a single random item and cannot support this pattern.
- When `sessionId` is falsy, no-repeat tracking is skipped entirely — selection still works, just without deduplication.
- Pool reset strategy: when all theme ayahs have been shown, reset to the full pool rather than returning null — ensures hooks always get content.
- Kept `require('./load-ayah')` import for interface compatibility; `loadAyahsForTheme` is a separate internal function.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `selectAyah` and `resolveTheme` are exported and ready for hook scripts to import.
- Hook scripts (PreToolUse, SessionStart) can now call `selectAyah(toolName, sessionId, pluginRoot)` and pass the returned ayah directly to `renderPanel`.
- Phase 2 Plan 03 (hook script wiring) depends on both this module and `render-panel.js`.

---
*Phase: 02-display-rendering-and-theming*
*Completed: 2026-03-15*

## Self-Check: PASSED

- FOUND: scripts/lib/select-ayah.js
- FOUND: scripts/lib/select-ayah.test.js
- FOUND: .planning/phases/02-display-rendering-and-theming/02-02-SUMMARY.md
- FOUND: commit 06eccf2 (RED test)
- FOUND: commit 9ce5d66 (GREEN implementation)
