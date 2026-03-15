# Requirements: claude-code-quran

**Defined:** 2026-03-14
**Core Value:** Every moment Claude makes the user wait becomes an opportunity for dhikr — a Quranic ayah displayed beautifully in the terminal.

## v1 Requirements

### Plugin Infrastructure

- [x] **INFRA-01**: Plugin has a valid `.claude-plugin/plugin.json` manifest with name `claude-code-quran`
- [x] **INFRA-02**: Plugin uses `$CLAUDE_PLUGIN_ROOT` for all intra-plugin path references (no hardcoded paths)
- [x] **INFRA-03**: Hook scripts are invoked as `node ${CLAUDE_PLUGIN_ROOT}/scripts/...` (not shell scripts) to avoid shell profile interference
- [x] **INFRA-04**: All display hooks use `async: true` so Claude's tool execution is never blocked

### Ayah Data

- [x] **DATA-01**: Plugin ships a bundled `data/fallback.json` containing ~50 curated ayahs tagged by theme (ilm, tawakkul, ihsan, sabr, shukr) and time-of-day slot (fajr, duha, asr, maghrib, isha)
- [x] **DATA-02**: Each bundled ayah includes: Arabic text, transliteration (romanized), Hilali-Khan English translation, surah name, surah number, ayah number
- [ ] **DATA-03**: Plugin fetches ayahs from alquran.cloud API using `en.hilali` edition for English and `en.transliteration` (or equivalent) for transliteration
- [ ] **DATA-04**: API response is cached locally (e.g. `~/.claude/cache/claude-code-quran/`) with stale-while-revalidate strategy
- [x] **DATA-05**: If API is unavailable or cache is empty, plugin falls back to bundled `fallback.json` silently (no error shown to user)

### Display Rendering

- [x] **DISP-01**: Display is rendered as a framed box using ANSI escape codes and Unicode box-drawing characters (no external dependencies like boxen)
- [x] **DISP-02**: Box contains: ASCII mosque/dome art at top, Arabic ayah text, transliteration line, Hilali-Khan English translation, surah name + ayah reference at bottom
- [x] **DISP-03**: ASCII mosque art is at least 2 variants (small ~40 cols, standard ~60 cols) and selected based on terminal width (`process.stdout.columns`)
- [x] **DISP-04**: Display output goes to stderr (shown immediately in terminal regardless of verbose mode)
- [x] **DISP-05**: Display respects `NO_COLOR` environment variable — renders plain text without ANSI codes when set
- [x] **DISP-06**: Arabic text is displayed as-is (plugin does not attempt RTL correction — English translation is the primary readable surface)

### Thematic Selection

- [x] **THEME-01**: Ayah theme is selected based on tool type: Read/Grep/Glob/LS → `ilm` (knowledge); Bash → `tawakkul` (reliance/effort); Write/Edit → `ihsan` (excellence); tool errors → `sabr` (patience)
- [x] **THEME-02**: Ayah theme is also influenced by time of day: pre-dawn/morning (Fajr, 4am–9am) → awakening/intention ayahs; midday/afternoon (Dhuhr/Asr, 9am–5pm) → perseverance/effort; evening/night (Maghrib/Isha, 5pm–4am) → gratitude/reflection
- [x] **THEME-03**: When tool type and time-of-day themes conflict, tool type takes priority
- [x] **THEME-04**: Ayah selection within a theme is random (no repeat of the same ayah within a session)

### Rate Limiting

- [x] **RATE-01**: PreToolUse hook enforces a minimum 60-second cooldown between ayah displays (prevents ayah spam across rapid tool calls)
- [x] **RATE-02**: Cooldown state is stored in a temp file (e.g. `/tmp/claude-code-quran-last-display`) and checked before rendering
- [x] **RATE-03**: SessionStart and Stop hooks always display (no cooldown applied to session boundary events)
- [ ] **RATE-04**: PreCompact hook always displays (context compaction is a significant wait moment — no cooldown)

### Lifecycle Hooks

- [x] **HOOK-01**: SessionStart hook displays an opening ayah when a new Claude Code session begins (and triggers background cache refresh as a detached child process)
- [x] **HOOK-02**: PreToolUse hook displays an ayah when Claude is about to use a tool (rate-limited per RATE-01)
- [ ] **HOOK-03**: PreCompact hook displays an ayah during context compaction
- [ ] **HOOK-04**: Stop hook displays a closing ayah when the session ends (Stop hook is used instead of SessionEnd to avoid 1.5s timeout)

## v2 Requirements

### Enhanced Display

- **VIS-01**: Animated character-by-character text reveal for ayah translation
- **VIS-02**: Multiple ASCII mosque art styles (geometric, silhouette, dome-focused) randomized per display
- **VIS-03**: Color themes (green/gold for day, deep blue for night) based on time of day

### Content

- **CONT-01**: Full Quran API coverage — fetch any ayah, not just curated 50
- **CONT-02**: User-configurable preferred surahs or themes
- **CONT-03**: "Ayah of the day" — consistent ayah throughout a single calendar day

### Plugin Settings

- **SET-01**: User can configure cooldown duration (default 60s)
- **SET-02**: User can enable/disable individual hook triggers
- **SET-03**: User can switch translation edition (though Hilali-Khan is default)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Audio recitation | Terminal-only plugin; audio requires OS integration outside scope |
| Replacing Claude's "Spelunking…" status messages | Claude Code doesn't expose a status message API for plugins |
| Web or mobile UI | Terminal-only by design |
| User accounts / cloud sync | No personal data; no server needed |
| Multi-language translations | Hilali-Khan English is the chosen translation; others deferred |
| Prayer time calculation / adhan | Out of scope for a coding tool plugin |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| DISP-04 | Phase 1 | Complete |
| HOOK-01 | Phase 1 | Complete |
| DISP-01 | Phase 2 | Complete |
| DISP-02 | Phase 2 | Complete |
| DISP-03 | Phase 2 | Complete |
| DISP-05 | Phase 2 | Complete |
| DISP-06 | Phase 2 | Complete |
| THEME-01 | Phase 2 | Complete |
| THEME-02 | Phase 2 | Complete |
| THEME-03 | Phase 2 | Complete |
| THEME-04 | Phase 2 | Complete |
| RATE-01 | Phase 2 | Complete |
| RATE-02 | Phase 2 | Complete |
| RATE-03 | Phase 2 | Complete |
| RATE-04 | Phase 2 | Pending |
| HOOK-02 | Phase 2 | Complete |
| HOOK-03 | Phase 3 | Pending |
| HOOK-04 | Phase 3 | Pending |
| DATA-03 | Phase 4 | Pending |
| DATA-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after roadmap creation — DATA-03/DATA-04 moved to Phase 4 (API Integration), corrected total count to 27*
