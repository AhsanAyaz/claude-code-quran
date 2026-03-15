---
phase: 02-display-rendering-and-theming
plan: 03
subsystem: hooks
tags: [nodejs, commonjs, hooks, rate-limiting, pre-tool-use, tdd]

# Dependency graph
requires:
  - phase: 02-01
    provides: renderPanel function from scripts/lib/render-panel.js
  - phase: 02-02
    provides: selectAyah function from scripts/lib/select-ayah.js
  - phase: 01-03
    provides: session-start.js resolvePluginRoot pattern, hooks.json structure, systemMessage output channel
provides:
  - scripts/pre-tool-use.js — PreToolUse hook entry point with 60s rate limiting
  - scripts/pre-tool-use.test.js — unit tests for isWithinCooldown and stampCooldown
  - hooks/hooks.json — PreToolUse entry registered with matcher="" for all tools
affects:
  - 03-lifecycle-hooks (pre-compact.js follows identical pattern — no isWithinCooldown call)
  - Phase 3 PostToolUse handler (error→sabr path deferred here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Rate-limit gate via /tmp/claude-code-quran-last-display timestamp file (60s cooldown)
    - isWithinCooldown / stampCooldown helpers inlined per-script (not shared module)
    - resolvePluginRoot copied verbatim per script (self-contained pattern)
    - Silent skip on cooldown: empty systemMessage + exit 0
    - Zero-crash outer try/catch wrapping main() call (DATA-05)

key-files:
  created:
    - scripts/pre-tool-use.js
    - scripts/pre-tool-use.test.js
  modified:
    - hooks/hooks.json

key-decisions:
  - "Rate-limit logic (isWithinCooldown, RATE_FILE) lives exclusively in pre-tool-use.js — never in session-start.js (RATE-03)"
  - "60-second cooldown enforced via /tmp/claude-code-quran-last-display epoch timestamp (RATE-01, RATE-02)"
  - "PreToolUse hook uses matcher='' to match all tool types (resolved RESEARCH.md open question)"
  - "No async field on PreToolUse hook entry — sync execution required for systemMessage output"
  - "toolName='error' path (sabr theme) NOT synthesized in PreToolUse — reserved for Phase 3 PostToolUse"

patterns-established:
  - "PreToolUse entry-point pattern: read stdin JSON → rate gate → selectAyah → renderPanel → stampCooldown → output"
  - "RATE-04 (pre-compact.js always-display) follows this same pattern but omits isWithinCooldown call"

requirements-completed: [RATE-01, RATE-02, RATE-03, HOOK-02]

# Metrics
duration: 10min
completed: 2026-03-15
---

# Phase 2 Plan 03: Pre-Tool-Use Hook Summary

**PreToolUse hook entry wired with 60s rate limiting — connects render-panel + select-ayah into the first live tool-intercepting hook, registered for all tool types in hooks.json**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-15T00:14:15Z
- **Completed:** 2026-03-15T00:24:15Z
- **Tasks:** 1 (TDD: RED + GREEN commits)
- **Files modified:** 3

## Accomplishments

- Implemented `scripts/pre-tool-use.js` — reads stdin PreToolUse JSON, enforces 60s rate limit, selects thematic ayah, renders box panel, stamps cooldown, outputs `systemMessage` JSON
- Registered `PreToolUse` hook in `hooks/hooks.json` with `matcher: ""` (matches all tools), no `async` field (sync required for systemMessage)
- Written `scripts/pre-tool-use.test.js` with 5 unit tests covering all RATE-01/RATE-02/RATE-03 requirements
- Full test suite passes: 37 tests total across render-panel, select-ayah, and pre-tool-use

## Task Commits

Each task was committed atomically via TDD:

1. **Task 1 (RED): Rate-limit tests** - `fb83931` (test)
2. **Task 1 (GREEN): pre-tool-use.js + hooks.json** - `def77df` (feat)

_TDD task: test commit (RED) followed by implementation commit (GREEN)_

## Files Created/Modified

- `scripts/pre-tool-use.js` — PreToolUse hook entry point: stdin read, 60s rate gate, selectAyah, renderPanel, stampCooldown, systemMessage output
- `scripts/pre-tool-use.test.js` — Unit tests for isWithinCooldown (missing/30s/90s), stampCooldown, and RATE-03 guard on session-start.js
- `hooks/hooks.json` — Added PreToolUse entry with `matcher: ""` and `node ${CLAUDE_PLUGIN_ROOT}/scripts/pre-tool-use.js` command

## Decisions Made

- Rate-limit helpers (`isWithinCooldown`, `stampCooldown`) are inlined in `pre-tool-use.js`, not extracted to a shared module — each entry-point script is self-contained per established Phase 1 pattern
- `matcher: ""` used for PreToolUse to intercept all tool types (confirmed correct per RESEARCH.md resolution)
- `toolName='error'` is NOT synthesized in PreToolUse — the sabr theme via error path is reserved for Phase 3 PostToolUse which has actual error context
- stampCooldown is called BEFORE `process.stdout.write` to close the race window for parallel hook invocations

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 2 wave 2 complete: PreToolUse hook is live and connects both wave-1 libraries
- Phase 3 (lifecycle hooks) can use this script as the pattern for `pre-compact.js` — identical entry-point structure, simply omit the `isWithinCooldown` call (RATE-04 deferral)
- Phase 3 PostToolUse handler can add the `error → sabr` path that was explicitly excluded here

---
*Phase: 02-display-rendering-and-theming*
*Completed: 2026-03-15*
