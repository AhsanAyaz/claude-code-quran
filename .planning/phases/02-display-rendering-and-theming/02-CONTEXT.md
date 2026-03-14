# Phase 2: Display Rendering and Theming - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the full visual experience: a framed Unicode box panel with hand-crafted ASCII mosque art, ANSI colors, and ayah selection driven by tool type and time of day. Add the PreToolUse hook with rate limiting. SessionStart upgrades from Phase 1's plain-text format to the full panel. Full rendering, thematic selection, and rate limiting are all in scope. API integration is Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Mosque Art Style
- **Minimalist outline**: dome shape + minaret silhouette — clean line-art, no ornamental detail
- **Hand-crafted**: multi-line string constants in code — no external library (figlet, art generators, etc.)
- **Standard variant height**: 5–7 lines tall
- **Small variant (< ~60 cols)**: omit the mosque art entirely — degrade to text-only with the box frame still present

### Color Palette
- **Frame and mosque art**: Islamic green (chalk `green` or `#2d6a4f` — Claude picks the exact shade that works on both dark and light terminals)
- **Arabic text**: plain white / default terminal color — no special tinting
- **Transliteration line**: dimmed (chalk `dim`)
- **English translation**: plain white / default
- **Surah reference line** (— Surah N:N): green, same as the frame — ties the reference visually to the frame
- **NO_COLOR=1**: all ANSI codes stripped, content preserved exactly (DISP-05)

### Panel Layout
- **Fixed width**: 64 columns regardless of terminal width (above the narrow threshold)
- **Text alignment**: left-aligned inside the box, with 1-space padding on each side
- **Art-to-text separator**: one blank line between the mosque art block and the ayah text
- **Content order inside box**: mosque art → blank line → Arabic → transliteration → translation → reference (mirrors Phase 1 content order, now framed)
- **Narrow threshold**: below 60 columns, drop the mosque art; below a further threshold (Claude's discretion), fall back to Phase 1 plain-text style with no box

### PreToolUse Hook
- **Same full panel**: PreToolUse displays the identical framed panel as SessionStart — no lighter variant for mid-session hits
- **Rate limiting**: 60-second cooldown enforced via temp file (`/tmp/claude-code-quran-last-display`); PreToolUse skips display silently if within cooldown
- **Session-boundary hooks exempt**: SessionStart and Stop never suppressed (RATE-03)

### Thematic Selection
- **Tool type → theme mapping** (THEME-01, tool type takes priority per THEME-03):
  - Read / Grep / Glob / LS → `ilm` (knowledge)
  - Bash → `tawakkul` (reliance/effort)
  - Write / Edit → `ihsan` (excellence)
  - Tool errors → `sabr` (patience)
  - Unknown / unrecognised tool types → fall back to time-of-day theme (not skipped, not defaulted to ilm)
- **Time-of-day → theme** (THEME-02, used when no tool-type signal or as fallback):
  - Pre-dawn/morning (Fajr, 4am–9am) → awakening/intention → `ilm` or `tawakkul`
  - Midday/afternoon (Dhuhr/Asr, 9am–5pm) → perseverance/effort → `tawakkul` or `ihsan`
  - Evening/night (Maghrib/Isha, 5pm–4am) → gratitude/reflection → `shukr` or `sabr`
- **`shukr` theme surfaces via time-of-day only** (evening/Maghrib-Isha window) — not mapped to any tool type
- **No-repeat within session** (THEME-04): track displayed ayah IDs in a session state file; Claude's discretion on implementation

### Claude's Discretion
- Exact chalk color value for "Islamic green" — pick what renders well on both dark and light terminals
- Specific mosque art character design for both variants (within the minimalist outline style and 5–7 line height constraint)
- Exact time-of-day boundary hours for Fajr/Dhuhr/Asr/Maghrib/Isha (approximate values given above are directional)
- Session no-repeat state file location and format
- Inner padding amount (1 space specified on left/right; top/bottom padding at Claude's discretion)
- Exact narrow fallback threshold (below 60 cols → no art is locked; further fallback to no-box is discretionary)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/lib/load-ayah.js`: Ayah loader with theme-based selection and three-strategy root resolver. Phase 2 extends this with tool-type and time-of-day logic, or wraps it in a new `select-ayah.js` module.
- `scripts/session-start.js`: Root resolver pattern, `systemMessage` JSON output pattern — both reused verbatim in Phase 2 scripts.
- `data/fallback.json`: 50 ayahs with `theme` and `time_slots` fields already populated — ready for thematic selection without data changes.

### Established Patterns
- **Output channel**: `process.stdout.write(JSON.stringify({ systemMessage: displayText }))` + `process.exit(0)` — NEVER `console.log`, never stderr
- **Sync execution required**: `async: true` in hooks.json suppresses `systemMessage` rendering (confirmed in Phase 1 live test) — all Phase 2 hooks must be synchronous
- **CommonJS only**: `'use strict'; const x = require(...)` — no ESM, no `import`
- **Root resolver**: three-strategy fallback (env var → installed_plugins.json → `__dirname`) from `session-start.js` — copy into each new hook script
- **Zero-crash guarantee**: every file I/O wrapped in try/catch, exit 0 with empty systemMessage on any error (DATA-05 pattern)

### Integration Points
- `hooks/hooks.json`: needs a new `PreToolUse` hook entry alongside the existing `SessionStart` entry
- `scripts/session-start.js`: replace Phase 1 plain-text `formatAyah()` with new renderer module
- New module: `scripts/lib/render-panel.js` (or similar) — contains box renderer, color logic, mosque art strings, NO_COLOR handling

</code_context>

<specifics>
## Specific Ideas

- The confirmed output mechanism is `systemMessage` JSON on stdout with sync (non-async) hook execution — this was empirically validated in Phase 1 live testing
- The green + white palette was selected from a visual preview; the exact chalk green shade should look good on dark terminals (the primary use case)
- Mosque art should be "hand-drawn" in code — the user's reference to figlet was clarifying that they want a proper shape, not the broken placeholder. Claude's interpretation: draw something that actually reads as a mosque dome + minaret

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-display-rendering-and-theming*
*Context gathered: 2026-03-15*
