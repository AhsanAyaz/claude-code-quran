# halal-code

## What This Is

A Claude Code plugin that displays Quranic ayahs with English translations and ASCII mosque art in the terminal whenever Claude is thinking, processing, or waiting. Instead of seeing default Claude status messages, the user is greeted with a beautiful, spiritually grounding moment — an ayah from the Quran rendered in a full-panel terminal display. Built for Muslim developers who want their workflow to carry barakah.

## Core Value

Every moment Claude makes the user wait becomes an opportunity for dhikr — a Quranic ayah displayed beautifully should feel like opening a page of the Mushaf, not a loading spinner.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Plugin hooks into Claude Code lifecycle events (SessionStart, PreToolUse, PreCompact, SessionEnd) to trigger ayah display
- [ ] Ayahs fetched from a Quran API (e.g. alquran.cloud) with English translation
- [ ] Bundled fallback of ~50 curated ayahs for offline/API-failure scenarios
- [ ] Ayah selection is thematic: driven by tool type and time of day
- [ ] Full-panel terminal display: ASCII mosque/dome art + Arabic ayah text + English translation in a framed box
- [ ] Display is beautiful and readable in a standard terminal (color, alignment, width-aware)
- [ ] Works as a standalone Claude Code plugin with no external dependencies beyond Node.js

### Out of Scope

- Replacing Claude's actual status text (e.g. "Spelunking…") — not possible via plugin API; we output separately to terminal
- Mobile or web UI — terminal only
- Audio recitation — terminal text only
- User accounts or cloud sync of preferences

## Context

- **Plugin type**: Claude Code plugin (hooks-based, shell/Node.js scripts)
- **Hook events available**: PreToolUse, PostToolUse, SessionStart, SessionEnd, PreCompact, UserPromptSubmit
- **Ayah display mechanism**: Hook scripts output to stdout/stderr — this renders in the terminal alongside Claude's output
- **Thematic selection logic**:
  - Tool type mapping: Read/Glob/Grep → 'ilm (knowledge), Bash → tawakkul (reliance/effort), Write/Edit → ihsan (excellence), errors/failures → sabr (patience)
  - Time of day: Fajr (pre-dawn/morning) → spiritual awakening ayahs, Dhuhr/Asr (midday/afternoon) → perseverance, Maghrib/Isha (evening/night) → gratitude and reflection
- **API**: alquran.cloud or api.quran.com (both free, no auth required)
- **Fallback**: ~50 hand-curated ayahs bundled in JSON with transliteration and theme tags

## Constraints

- **Tech stack**: Node.js scripts for hooks (no Python dependency), shell-compatible
- **Terminal**: Must work in standard 80-col terminals; art should be width-aware
- **Performance**: Ayah display must not add noticeable latency to Claude's tool execution — async fetch, display immediately with cached/bundled fallback
- **Plugin format**: Follows Claude Code plugin conventions (.claude-plugin/plugin.json, hooks/hooks.json, scripts/)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hooks-based display (not status message replacement) | Claude Code doesn't expose a status message API for plugins | — Pending |
| API-first with bundled fallback | User wants live API but reliability matters; offline fallback ensures it always works | — Pending |
| Node.js for hook scripts | Universal on dev machines, async-capable, rich terminal formatting libraries available | — Pending |
| Thematic by tool type + time of day | More meaningful than random; tool type gives context, time of day adds rhythm to the day | — Pending |

---
*Last updated: 2026-03-14 after initialization*
