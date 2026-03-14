# Project Research Summary

**Project:** halal-code — Claude Code Quran Ayah Display Plugin
**Domain:** Claude Code hooks-based terminal display with Islamic content
**Researched:** 2026-03-14
**Confidence:** HIGH (hook mechanics and API verified against official docs and live endpoints)

## Executive Summary

halal-code is a Claude Code plugin that displays Quranic ayahs (verses) during coding sessions — triggered by Claude Code's hook system at session start, before tool use, and on tool failure. The plugin combines three concerns: Claude Code hook integration, a Quran text API (alquran.cloud), and terminal rendering of Arabic/English content. Research found well-documented patterns for all three, with one critical unresolved question that must be resolved early in implementation.

The recommended approach is a zero-external-dependency Node.js plugin using the bundled `fallback.json` (50 curated ayahs) as the primary display source, with the alquran.cloud API providing background cache refreshes at session start. Ayahs are selected by mapping the triggering Claude Code tool name to a spiritual theme (ilm/knowledge for Read/Grep, tawakkul/reliance for Bash, ihsan/excellence for Write/Edit, sabr/patience for errors), with time-of-day as a secondary selector. The `en.hilali` edition (Hilali-Khan translation) is the required English translation per user specification; use `quran-uthmani` for Arabic text. Display is non-blocking via `async: true` hooks.

The single most critical risk is **how hook output reaches the user's terminal**. Three research sources give conflicting answers: STACK.md says write to `/dev/tty` directly; FEATURES.md says `systemMessage` JSON field is the only reliable path; ARCHITECTURE.md says write to `process.stderr`. All three approaches have documented supporting evidence. This question must be tested against a live Claude Code session before any rendering code is finalized — the architecture of the entire display pipeline depends on the answer. All other pitfalls (Arabic rendering limitations, ESM/CJS library conflicts, path resolution after install) are well-understood and avoidable with the patterns documented in research.

## Key Findings

### Recommended Stack

The plugin runs as plain CommonJS Node.js scripts (`require()`, no build step) invoked directly by Claude Code's hook system. Node.js 18+ is required because `fetch` is stable built-in at that version. For colors, use chalk v4.1.2 (the last CJS-compatible version — chalk 5+ is ESM-only and will fail with `require()`). For box drawing, implement a custom Unicode renderer (~100 lines) using `─ │ ┌ ┐ └ ┘` characters rather than depending on boxen, which is ESM-only in v8. String width measurement for Arabic text requires `string-width@4` (last CJS version) or manual width heuristics — Arabic glyph width calculation is unreliable regardless of library, so layouts should not depend on precise Arabic string width.

The alquran.cloud API (`https://api.alquran.cloud/v1`) requires no authentication, has no documented rate limits, and returns clean plain-text translations (unlike api.quran.com, which embeds HTML footnote markup requiring stripping). The required English edition identifier is `en.hilali` (Hilali-Khan translation). Combine with `quran-uthmani` for Arabic text in multi-edition requests: `/v1/ayah/{ref}/editions/quran-uthmani,en.hilali`. Use the `/v1/ayah/random/editions/quran-uthmani,en.hilali` endpoint for random selection.

**Core technologies:**
- Node.js 18+ (CJS): Hook script runtime — no installation required on dev machines; built-in `fetch` eliminates `node-fetch` dependency
- Claude Code Hooks (hooks.json schema v1): Plugin integration — the only mechanism Claude Code exposes for third-party lifecycle events
- alquran.cloud API (`en.hilali` edition): Quran content source — keyless, plain-text responses, random and reference-based endpoints verified against live API
- `/dev/tty` or `process.stderr` or `systemMessage`: Terminal display — OUTPUT MECHANISM UNRESOLVED (see Gaps section)
- chalk@4.1.2: ANSI color output — pinned to v4 because v5+ is ESM-only
- Custom Unicode box renderer: Framed panel display — avoids ESM issues with boxen; gives full control over Arabic centering

**Explicitly avoid:**
- chalk@5, boxen@8, string-width@5+: All ESM-only, will break `require()` in hook scripts
- `process.stdout` for display output: Captured by Claude Code in normal mode, not visible to users
- Synchronous network requests in display hooks: Adds 200-800ms latency to every tool call
- `api.quran.com` as primary: HTML in translation text; numeric edition IDs less ergonomic

### Expected Features

The plugin has a clear feature dependency chain: the bundled fallback JSON must exist before any display feature can work, and the hook integration must be confirmed before any display logic is meaningful. Build in that order.

**Must have (table stakes):**
- Bundled fallback JSON (~50 curated ayahs, tagged by theme) — the safety net; everything else depends on it; build first
- PreToolUse hook with non-blocking async display — primary delivery mechanism; must not add latency to tool execution
- SessionStart hook — opening ayah display with barakah/bismillah theme
- Arabic text + English translation (en.hilali) + surah reference — core content; without these it is not a Quran plugin
- Tool-type to theme mapping (5 groups: ilm, tawakkul, ihsan, sabr, barakah) — makes selection feel intentional
- Rate limiting on PreToolUse (45-90 second cooldown) — prevents ayah flood during rapid tool sequences
- Terminal width detection with graceful narrow-terminal fallback (text-only below 60 columns)
- ASCII mosque silhouette art (1 design, 2-3 width variants) — the visual differentiator

**Should have (competitive):**
- Transliteration line — bridge for non-Arabic readers; alquran.cloud has transliteration editions
- Time-of-day theme layering (Fajr/Dhuhr/Asr/Maghrib/Isha buckets)
- PostToolUse on-failure display with sabr theme — contextually the most spiritually resonant moment in the plugin
- SessionEnd or Stop hook closing ayah with shukr/gratitude theme
- Async alquran.cloud API cache refresh at SessionStart (stale-while-revalidate)
- Framed panel display with Unicode box-drawing border

**Defer (v2+):**
- Multiple ASCII mosque art designs (3-5 variants)
- Multiple translation options with config file (`~/.halal-code.json`)
- Surah completion tracking
- Session-level persistence beyond what a timestamp file provides

**Anti-features (explicitly out of scope):**
- Audio recitation: No terminal audio API; disruptive in shared environments
- Full Quran browser/search: Different UX paradigm; use QuranCLI as companion
- Prayer time notifications: Requires a daemon; out of scope; use Azan CLI

### Architecture Approach

The plugin follows a layered architecture with strict separation between pure logic modules (`scripts/lib/`) and I/O entry points (`scripts/`). The core loop is: hook fires → event-parser reads stdin JSON → theme-selector maps tool name + hour to theme tag → ayah-resolver checks file-system cache then falls back to bundled JSON → renderer composes ASCII art + Arabic + English into a terminal box → output written to display channel (mechanism TBD). A separate cache-refresher process runs detached at SessionStart, fetching from alquran.cloud and writing to `~/.cache/halal-code/cache.json` — the display hook never touches the network.

**Major components:**
1. `data/fallback.json` — 50 curated ayahs with Arabic text, en.hilali translation, theme tags, and surah references; the foundation that makes everything else work offline
2. `scripts/lib/theme-selector.js` — pure function mapping `(tool_name, hour_of_day)` to a theme tag; fully testable without Claude Code
3. `scripts/lib/ayah-resolver.js` — cache-first, fallback-second ayah lookup; never blocks on network
4. `scripts/lib/renderer.js` — custom Unicode box renderer with ASCII mosque art; handles terminal width detection and narrow-terminal degradation
5. `scripts/display-ayah.js` — entry point wiring all lib modules; receives hook stdin, writes to display channel, exits 0
6. `scripts/cache-refresher.js` — background process fetching alquran.cloud into `~/.cache/halal-code/cache.json`; spawned detached from session-start.js
7. `hooks/hooks.json` — declares hook events, matchers, async flag, and timeout; `${CLAUDE_PLUGIN_ROOT}` for all path references

**Build order:** fallback.json → cache.js → event-parser.js → theme-selector.js → ayah-resolver.js → renderer.js → display-ayah.js → cache-refresher.js → session-start.js → hooks.json

### Critical Pitfalls

1. **Synchronous API fetch in display hook** — fetching from alquran.cloud inside `display-ayah.js` adds 200-800ms latency to every tool call; compounds to 10-40 seconds in a 50-tool session. Prevent by never touching the network in the display hook; all API calls happen in the detached background cache-refresher only.

2. **Hook output not reaching the user** — three research sources disagree on the correct output mechanism: `/dev/tty` direct write (STACK.md), `systemMessage` JSON field (FEATURES.md), and `process.stderr` (ARCHITECTURE.md). This is the single most critical implementation question. Must be validated against a live Claude Code session before rendering code is finalized. Recommendation: test all three approaches in Phase 1 and commit to whichever works reliably.

3. **Arabic string width corrupting box alignment** — Arabic characters are classified as 1-column-wide by `string-width` but shaped ligatures render as fewer cells, causing box borders to misalign. Prevent by never mixing Arabic text with precise horizontal alignment calculations; give Arabic its own block, padded by margin rather than calculated padding.

4. **Hardcoded paths breaking after marketplace installation** — Claude Code copies plugins to `~/.claude/plugins/cache/`; any hardcoded or `process.cwd()`-relative path breaks immediately. Prevent by using `${CLAUDE_PLUGIN_ROOT}` in `hooks.json` for all script paths, and `__dirname` in Node.js scripts for all sibling file references (e.g. `data/fallback.json`).

5. **SessionEnd hook output silently dropped** — SessionEnd has a 1.5-second hardcoded timeout and its output is not surfaced to the user. Do not use SessionEnd for visible display; use the `Stop` hook instead for closing-session ayah display.

## Implications for Roadmap

Based on the dependency chain discovered in research, the project builds in 4 natural phases: foundation first, then display scaffold, then content enrichment, then API integration. Each phase is a working increment.

### Phase 1: Foundation and Hook Scaffold

**Rationale:** Every feature depends on the bundled fallback JSON existing and hooks firing correctly. The hook output mechanism question is also blocking — nothing can be built confidently until it is answered. This phase answers both questions and leaves a working plugin.

**Delivers:** A working plugin that displays a hardcoded or randomly-selected fallback ayah when Claude Code events fire. No API calls, no theming, just proof the delivery mechanism works.

**Addresses:** Bundled fallback JSON (P1), hook integration (P1), SessionStart hook (P1), basic Arabic + translation display (P1)

**Avoids:** Synchronous API fetch pitfall (by not touching the network yet), hardcoded path pitfall (by using `${CLAUDE_PLUGIN_ROOT}` from day one), shell profile stdout pitfall (by using `node` invocation in hook command), executable bit pitfall (by using explicit `node` command rather than relying on shebang)

**Critical test:** Confirm which output mechanism works in a live Claude Code session — `/dev/tty`, `systemMessage`, or `process.stderr`. Document the result; all subsequent rendering depends on it.

**Research flag:** This phase needs empirical testing, not more research. Run it first.

### Phase 2: Display Rendering and Theming

**Rationale:** With hooks confirmed working, build the full visual experience and the theme selection engine. This is the highest-value phase for user experience.

**Delivers:** Full framed panel display with ASCII mosque art, tool-type theme selection, rate limiting on PreToolUse, terminal width handling, and narrow-terminal fallback.

**Uses:** Custom Unicode box renderer (avoiding boxen ESM issues), chalk@4.1.2 for colors, `string-width@4` for width measurement, `process.stdout.columns` for terminal width detection

**Implements:** renderer.js, theme-selector.js, ayah-resolver.js (fallback path only), rate-limiting logic

**Avoids:** Arabic string width alignment pitfall (Arabic in its own margin-padded block), ANSI codes in non-TTY environments (check `process.stdout.isTTY` and `NO_COLOR`), box overflow in narrow terminals (degrade to text-only below 60 columns)

**Research flag:** Arabic rendering across terminal emulators needs visual QA during this phase — validate in macOS Terminal, iTerm2, and VS Code integrated terminal. No additional pre-research needed; test empirically.

### Phase 3: Content Enrichment

**Rationale:** With the display pipeline stable, enrich the content experience: transliteration, time-of-day theming, error-state sabr ayahs, and session-closing display. These are all additive to the Phase 2 foundation.

**Delivers:** Transliteration line below Arabic, time-of-day secondary theme selection, PostToolUse-on-failure sabr ayah display (bypassing rate limiter), Stop hook closing ayah with shukr theme

**Addresses:** Transliteration (P2), time-of-day theming (P2), PostToolUse on-failure (P2), SessionEnd/Stop closing ayah (P2)

**Avoids:** SessionEnd silent output pitfall (use `Stop` hook instead for closing display)

**Research flag:** Standard patterns apply. No pre-research needed.

### Phase 4: API Integration and Cache

**Rationale:** The bundled fallback provides variety for most users. The API layer adds freshness and expands beyond 50 ayahs without plugin updates. This is an enhancement, not a foundation — build it last so it does not block Phase 1-3.

**Delivers:** Stale-while-revalidate cache populated by background alquran.cloud API fetches at SessionStart. Cache stored at `~/.cache/halal-code/cache.json` with 24-hour TTL per theme bucket. Display hook reads from cache first, falls to fallback on miss.

**Uses:** Node.js built-in `fetch` (Node 18+), `AbortController` signal with 5-second timeout, atomic file writes (write `.tmp` then `fs.renameSync`), `en.hilali` edition identifier for all API requests

**Implements:** cache-refresher.js, cache.js, session-start.js (spawning detached refresher), ayah-resolver.js (cache path)

**Avoids:** API fetch in display hook (cache-refresher is detached; display-ayah.js never touches network), HTTP 200 with error body (validate `data` field, not just status code), no timeout on fetch (AbortController required)

**Research flag:** Standard patterns; alquran.cloud response format verified against live API. No pre-research needed.

### Phase Ordering Rationale

- Phase 1 before all others: The hook output mechanism question is blocking. Cannot design the renderer until the display channel is confirmed.
- Phase 2 before Phase 3: Theming and enrichment add to the display pipeline; the pipeline must exist first.
- Phase 3 before Phase 4: API integration is an enhancement. Content richness from the 50-ayah fallback is sufficient for phases 1-3; API adds freshness, not correctness.
- Phase 4 last: Keeps network complexity out of the critical path. If the API is never built, the plugin is still complete and useful.

### Research Flags

Phases needing deeper investigation during planning:
- **Phase 1:** Output mechanism empirical test — do not skip; must run actual Claude Code session to determine whether `/dev/tty`, `systemMessage`, or `stderr` reliably surfaces output to the user. This determines the architecture of every subsequent phase.

Phases with well-documented patterns (skip additional pre-research):
- **Phase 2:** Terminal rendering patterns are well-established; custom Unicode box drawing is ~100 lines; Arabic display limitations are documented and the recommendation (accept imperfect rendering, test visually) is clear.
- **Phase 3:** Hook events, theme selection logic, and rate limiting are all documented patterns; no novel integrations.
- **Phase 4:** alquran.cloud API shape is verified against the live endpoint; stale-while-revalidate with detached child process is a standard Node.js pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Claude Code docs + live npm registry verification; CJS/ESM version constraints confirmed via GitHub issues |
| Features | HIGH | Hook mechanics verified via official docs and GitHub issues; API capabilities verified against live alquran.cloud endpoint; ASCII art feasibility confirmed via existing examples |
| Architecture | HIGH | Component boundaries and data flow derived from official docs; build order follows strict dependency chain |
| Pitfalls | HIGH (hooks) / MEDIUM (Arabic rendering) | Hook pitfalls sourced from official docs and confirmed GitHub issues; Arabic rendering limitations sourced from Unicode working group docs and terminal project issues |

**Overall confidence:** HIGH

### Gaps to Address

- **Output mechanism ambiguity (CRITICAL):** STACK.md, FEATURES.md, and ARCHITECTURE.md each recommend a different output channel (`/dev/tty`, `systemMessage` JSON field, `process.stderr`). The correct answer likely depends on Claude Code version and hook event type. Resolution: test all three in Phase 1 before writing rendering code. The GitHub issues cited suggest behavior changed across Claude Code versions — pin findings to the version tested.

- **boxen v8 CJS compatibility:** STACK.md notes uncertainty about whether boxen v8 supports CommonJS. Resolution: assume ESM-only (as with all recent sindresorhus packages) and use the custom Unicode box renderer instead. No additional research needed; the custom renderer is the safer default.

- **en.hilali translation length:** The `en.hilali` (Hilali-Khan) translation is noted in STACK.md as "footnote-heavy" and potentially long. Some ayahs may produce very long English text that challenges the terminal box layout. Resolution: during fallback JSON curation (Phase 1), preview each selected ayah's en.hilali text and prefer shorter ones; implement word-wrapping in the renderer that gracefully handles long lines.

- **alquran.cloud uptime and rate limiting:** No published SLA or rate limit thresholds. Resolution: the bundled fallback is the primary path; API is a cache warmer. If alquran.cloud is unavailable, the plugin degrades silently with no user-visible error. Add `AbortController` with 5-second timeout on all fetch calls.

## Sources

### Primary (HIGH confidence)
- `https://code.claude.com/docs/en/hooks` — Claude Code hooks reference: event names, configuration schema, stdin/stdout behavior, async flag, timeout defaults
- `https://code.claude.com/docs/en/plugins` — Claude Code plugins guide: plugin.json schema, directory structure, `${CLAUDE_PLUGIN_ROOT}` resolution
- `https://api.alquran.cloud/v1/edition/language/en` — Live endpoint: all 17 English translation identifiers verified including `en.hilali`
- `https://api.alquran.cloud/v1/ayah/2:255/editions/quran-uthmani,en.sahih` — Live endpoint: JSON response structure confirmed (data[], text, edition.direction, surah.englishName, numberInSurah)
- `https://github.com/anthropics/claude-code/issues/11120` — Hook stdout not visible in normal mode: confirmed closed/not-planned
- `https://github.com/anthropics/claude-code/issues/12653` — SessionStart stderr behavior: confirmed intentional, systemMessage is documented resolution
- `https://github.com/anthropics/claude-code/issues/4084` — systemMessage field confirmed working for user-visible hook output (resolved v1.0.64)
- `https://terminal-wg.pages.freedesktop.org/bidi/bidi-intro/rtl-bidi-text.html` — RTL/BiDi terminal emulator support: fundamental architectural constraint on Arabic display

### Secondary (MEDIUM confidence)
- `https://github.com/sindresorhus/boxen` — boxen v8.0.1 ESM-only status (docs do not explicitly state CJS compatibility; treat as ESM-only)
- `https://github.com/disler/claude-code-hooks-mastery` — Community patterns for async hooks and stderr vs stdout behavior in practice
- `https://github.com/anthropics/claude-code/issues/4809` — PostToolUse exit code 1 blocking behavior
- `https://github.com/anthropics/claude-code/issues/18517` — Plugin version upgrade breaking hook paths
- `https://github.com/microsoft/terminal/issues/538` — BiDi rendering not implemented in Windows Terminal

### Tertiary (LOW confidence)
- `https://ascii.co.uk/art/mosques` and `https://textart.sh/topic/mosque` — ASCII mosque art feasibility reference (subjective quality assessment; not a functional constraint)

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
