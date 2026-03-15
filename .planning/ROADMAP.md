# Roadmap: halal-code (claude-code-quran)

## Overview

Four phases build a complete Claude Code plugin from working foundation to live API enrichment. Phase 1 answers the single blocking question (does hook output reach the terminal?) and ships a plugin that displays ayahs. Phase 2 delivers the full visual and thematic experience. Phase 3 completes the session lifecycle with PreCompact and Stop hooks. Phase 4 adds live API freshness on top of a plugin that already works completely without it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation and Hook Scaffold** - Working plugin with bundled ayahs and confirmed output mechanism (completed 2026-03-14)
- [ ] **Phase 2: Display Rendering and Theming** - Full framed panel, ASCII mosque art, thematic selection, rate limiting
- [ ] **Phase 3: Full Lifecycle** - PreCompact and Stop hooks complete the session arc
- [ ] **Phase 4: API Integration and Cache** - Live alquran.cloud fetches with stale-while-revalidate cache

## Phase Details

### Phase 1: Foundation and Hook Scaffold
**Goal**: A working plugin that displays a bundled ayah when Claude Code events fire, with the output mechanism confirmed
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, DATA-01, DATA-02, DATA-05, DISP-04, HOOK-01
**Success Criteria** (what must be TRUE):
  1. Installing the plugin and starting a Claude Code session displays an ayah (Arabic text + English translation + surah reference) in the terminal
  2. The plugin directory structure, plugin.json, and hooks.json are valid and Claude Code loads the plugin without errors
  3. All hook scripts use `${CLAUDE_PLUGIN_ROOT}` for paths and `node` as the explicit runtime — no hardcoded paths, no shell shebang
  4. Bundled fallback.json contains at least 50 ayahs, each with Arabic, transliteration, en.hilali translation, surah name, surah number, ayah number, and theme tags
  5. If the bundled fallback is the only data source, the plugin runs silently — no error messages or stack traces visible to the user
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Plugin manifest (.claude-plugin/plugin.json) and hook registration (hooks/hooks.json)
- [ ] 01-02-PLAN.md — Bundled ayah dataset: 50 curated ayahs tagged by theme and time of day (data/fallback.json)
- [ ] 01-03-PLAN.md — Hook scripts: output test, ayah loader library, and production SessionStart hook

### Phase 2: Display Rendering and Theming
**Goal**: Users see a beautiful, thematic framed panel display with ASCII mosque art, color, and ayah selection driven by tool type and time of day
**Depends on**: Phase 1
**Requirements**: DISP-01, DISP-02, DISP-03, DISP-05, DISP-06, THEME-01, THEME-02, THEME-03, THEME-04, RATE-01, RATE-02, RATE-03, RATE-04, HOOK-02
**Success Criteria** (what must be TRUE):
  1. When Claude uses a Read/Grep/Glob tool, the displayed ayah is from the `ilm` (knowledge) theme; Bash tool displays `tawakkul`; Write/Edit displays `ihsan`
  2. The terminal display renders a framed Unicode box containing ASCII mosque art, Arabic text, transliteration, English translation, and surah reference — all within terminal width bounds
  3. Setting `NO_COLOR=1` produces the same content with no ANSI color codes; narrow terminals (under 60 cols) degrade to text-only without the mosque art frame
  4. During rapid tool sequences, ayahs appear at most once every 60 seconds via PreToolUse — no ayah flood across back-to-back tool calls
  5. Session-start ayahs and session-boundary events (RATE-03) are never suppressed by the cooldown — only PreToolUse is rate-limited
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — render-panel.js library: Unicode box renderer, mosque art variants, chalk colors, NO_COLOR support (TDD)
- [ ] 02-02-PLAN.md — select-ayah.js library: tool-type + time-of-day theme resolution, session no-repeat tracking (TDD)
- [ ] 02-03-PLAN.md — pre-tool-use.js hook + hooks.json registration: rate limiting, stdin reading, full pipeline wiring
- [ ] 02-04-PLAN.md — session-start.js upgrade to full panel + human verification of live rendering

### Phase 3: Full Lifecycle
**Goal**: The plugin covers the complete session arc — PreCompact displays an ayah during context compaction, and Stop displays a closing ayah at session end
**Depends on**: Phase 2
**Requirements**: HOOK-03, HOOK-04
**Success Criteria** (what must be TRUE):
  1. When Claude Code compacts context, an ayah displays immediately (not rate-limited) before compaction proceeds
  2. When the Claude Code session ends, a closing ayah displays in the terminal (using the Stop hook, not SessionEnd, to avoid the 1.5-second timeout drop)
**Plans**: TBD

### Phase 4: API Integration and Cache
**Goal**: The plugin fetches fresh ayahs from alquran.cloud in the background, expanding beyond the 50 bundled ayahs without adding any latency to tool execution
**Depends on**: Phase 3
**Requirements**: DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. After a Claude Code session starts, a background process (detached child) fetches ayahs from alquran.cloud using the `en.hilali` edition and writes them to `~/.cache/halal-code/cache.json` — the display hook never touches the network
  2. On subsequent displays the plugin reads from the local cache first; if cache is empty or stale, it falls back to the bundled fallback silently — no user-visible error when alquran.cloud is unavailable
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Hook Scaffold | 3/3 | Complete   | 2026-03-14 |
| 2. Display Rendering and Theming | 3/4 | In Progress|  |
| 3. Full Lifecycle | 0/TBD | Not started | - |
| 4. API Integration and Cache | 0/TBD | Not started | - |
