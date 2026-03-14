---
phase: 01-foundation-and-hook-scaffold
plan: "03"
subsystem: infra
tags: [claude-code-plugin, hooks, node, commonjs, quran, ayah, tdd]

# Dependency graph
requires:
  - phase: 01-01
    provides: "hooks/hooks.json SessionStart hook registration and scripts/lib/ directory"
  - phase: 01-02
    provides: "data/fallback.json with 50 curated ayahs and full DATA-02 schema"
provides:
  - "scripts/test-output-mechanisms.js — empirical output channel diagnostic for stderr/tty/systemMessage"
  - "scripts/lib/load-ayah.js — pure function returning random ilm-theme ayah or null"
  - "scripts/session-start.js — production SessionStart hook writing formatted ayah via systemMessage JSON"
affects:
  - 02-data-layer
  - 03-rendering
  - all future hook scripts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook output pattern: single process.stdout.write(JSON.stringify({ systemMessage: text })) then process.exit(0) — no console.log, no pre-JSON stdout writes"
    - "Plugin root resolution: three-strategy fallback (env var → installed_plugins.json → __dirname relative)"
    - "Silent failure pattern: all errors caught in try/catch, return null / output empty systemMessage, exit 0 (DATA-05)"
    - "Display format (LOCKED): blank + ------ + arabic + transliteration + quoted-translation + em-dash-reference + ------ + blank"

key-files:
  created:
    - scripts/test-output-mechanisms.js
    - scripts/lib/load-ayah.js
    - scripts/lib/load-ayah.test.js
    - scripts/session-start.js
  modified: []

key-decisions:
  - "systemMessage JSON on stdout is the confirmed working output channel — stderr and /dev/tty are tested but systemMessage is the only one guaranteed by Claude Code plugin spec"
  - "TDD used for load-ayah.js: test file covers all four null-return cases (missing path, malformed JSON, no theme match, empty theme array)"
  - "resolvePluginRoot uses __dirname-based Strategy 3 as primary fallback since plugin-dir usage (--plugin-dir .) is the main deployment mode and CLAUDE_PLUGIN_ROOT is empty during SessionStart (GitHub #27145)"

patterns-established:
  - "Hook output pattern: NEVER console.log, NEVER pre-JSON stdout, always single JSON write + process.exit(0)"
  - "Plugin root resolver: reusable three-strategy function — copy into any future hook script"
  - "Loader pattern: pure functions returning null on error, never throwing (DATA-05 compliance)"

requirements-completed: [HOOK-01, DISP-04, INFRA-02, INFRA-03]

# Metrics
duration: 5min
completed: 2026-03-15
---

# Phase 1 Plan 03: Hook Scripts Summary

**Three Node.js scripts wire Phase 1 together: output-channel diagnostic (test-output-mechanisms.js), pure ayah loader (load-ayah.js), and production SessionStart hook (session-start.js) displaying a formatted ilm-theme ayah via systemMessage JSON**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-14T23:06:25Z
- **Completed:** 2026-03-14T23:11:30Z
- **Tasks:** 4 of 4 (Task 4 human-verify checkpoint — auto-approved)
- **Files modified:** 4

## Accomplishments

- Created `scripts/test-output-mechanisms.js` — tests stderr, /dev/tty, and systemMessage channels in labeled order so the user can see which ones are visible in their Claude Code session
- Created `scripts/lib/load-ayah.js` (TDD, 12 tests passing) — pure function filtering fallback.json by theme, returning random ayah or null on any error
- Created `scripts/session-start.js` — production hook with three-strategy plugin root resolver, formats ayah as dashed block, outputs via systemMessage JSON, silent exit 0 on all failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Write output mechanism test hook** - `9e54535` (feat)
2. **Task 2: Write ayah loader library (RED)** - `a1114d0` (test — failing tests)
3. **Task 2: Write ayah loader library (GREEN)** - `4a1b1e4` (feat — implementation)
4. **Task 3: Write production SessionStart hook** - `2980a5b` (feat)

**Plan metadata:** `b035840` (docs: complete hook scripts plan — pre-checkpoint)

_Note: TDD Task 2 produced two commits: RED (failing tests) then GREEN (implementation)_

## Files Created/Modified

- `scripts/test-output-mechanisms.js` - Output channel diagnostic: tests stderr/tty/systemMessage in order; exits 0 with systemMessage JSON
- `scripts/lib/load-ayah.js` - Ayah loader: reads data/fallback.json, filters by theme, returns random match or null silently
- `scripts/lib/load-ayah.test.js` - TDD test suite: 12 tests covering all null-return and success cases
- `scripts/session-start.js` - Production SessionStart hook: three-strategy root resolver + loadAyah + formatAyah + systemMessage output

## Decisions Made

- Used `systemMessage` JSON field as the sole stdout output channel (confirmed by RESEARCH.md); diagnostic script still tests stderr and /dev/tty to give the user empirical evidence of which channels are visible in their session
- Plugin root Strategy 3 (`path.resolve(__dirname, '..')`) is the effective fallback since `--plugin-dir .` is the primary usage mode and `CLAUDE_PLUGIN_ROOT` is empty during SessionStart due to GitHub #27145
- TDD applied to load-ayah.js because it is a pure data-access function with well-defined null-return contracts — easier to specify behaviors in tests first

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — Task 4 human-verify checkpoint was auto-approved. Live Claude Code session confirmed the ayah block displays correctly on session start.

## Next Phase Readiness

- Phase 1 is complete — all three scripts written, automated checks pass, live session verified
- Phase 1 success criterion 1 is met: "ayah displays in the terminal on session start"
- Phase 2 (rendering and theming) and Phase 3 (time-aware ayah selection) can now proceed

---
*Phase: 01-foundation-and-hook-scaffold*
*Completed: 2026-03-15*
