# Phase 1: Foundation and Hook Scaffold - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the plugin infrastructure skeleton and a working SessionStart hook that confirms ayah output reaches the terminal. Delivers: valid plugin.json/hooks.json, bundled fallback.json with ~50 curated ayahs, and a minimal text display that proves the output pipeline end-to-end. Full rendering (framed box, mosque art, colors) is Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Output Mechanism

- **Strategy: test first** — Before writing any real Phase 1 display code, create a minimal test hook that tries all four output mechanisms so the blocking question is empirically answered
- **Test all four**: `process.stderr`, `process.stdout`, `/dev/tty` (via `fs.writeFileSync`), and `systemMessage` (if available)
- **Test reporting**: each mechanism writes a visually labeled line (e.g. `[stderr] visible?`, `[tty] visible?`) so results are immediately readable in the terminal without opening a file
- **Production choice**: researcher/Claude selects the most standard mechanism that confirmed as visible — no pre-decision here, let the test evidence decide

### Phase 1 Display Format

- **Minimal plain text** — no Unicode box-drawing, no colors, no ASCII mosque art (those are Phase 2)
- **Content order**: Arabic text → Transliteration → English translation → Reference (mirrors Mushaf reading order)
- **Arabic handling**: display Arabic as-is unconditionally; transliteration line immediately below acts as readable fallback if Arabic renders as boxes in user's terminal
- **Separator**: blank line + `------` dashes before and after the block — makes the ayah visually distinct from Claude's output without any Unicode dependencies

Example output:
```
------
اللَّهُ الصَّمَدُ
Allahu-s-Samad
"Allah is the Eternal Refuge."
— Al-Ikhlas 112:2
------
```

### Fallback Ayah Dataset

- **Curation**: Claude suggests ~50 well-known ayahs, user reviews before Phase 1 ships (can swap any out)
- **Distribution**: equal — 10 ayahs per theme: `ilm`, `tawakkul`, `ihsan`, `sabr`, `shukr`
- **Time-of-day tags**: include now (fajr, duha, asr, maghrib, isha) even though selection logic runs in Phase 2 — avoids a data migration later
- **No specific surah preferences** — Claude picks from widely recognized ayahs across themes
- **Selection format for Phase 1**: random pick from the `ilm` theme (no tool-type routing until Phase 2)

### Package Structure

- **Zero dependencies in Phase 1** — only Node.js built-ins: `fs` (read fallback.json), `path` (`__dirname` resolution), `process` (stderr)
- **No package.json in Phase 1** — chalk and string-width are Phase 2 concerns; don't create a dependency file that lies about what's needed
- **Plugin at repo root** — `plugin.json` at repo root, `scripts/` and `data/` directories alongside it. The repo IS the plugin. No extra nesting.
- **Installation: git clone** — users clone the repo and point Claude Code's plugin config to the directory; `$CLAUDE_PLUGIN_ROOT` resolves to wherever they cloned

### Claude's Discretion

- Which specific ayahs Claude selects for the bundled fallback (subject to user review)
- Which output mechanism to use in production hooks after seeing test results
- Exact fallback.json field names and JSON structure (as long as it satisfies DATA-02 fields)
- How to handle `/dev/tty` gracefully if the environment doesn't support it in the test hook

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- None — fresh project, no existing code

### Established Patterns

- None established yet — Phase 1 creates the foundational patterns

### Integration Points

- `plugin.json` at repo root is the Claude Code plugin entry point
- `hooks.json` (inside `hooks/` or at root) defines which Node scripts fire on which lifecycle events
- All hook scripts invoked as `node ${CLAUDE_PLUGIN_ROOT}/scripts/<name>.js` per INFRA-03
- Output via confirmed mechanism (TBD from test) goes to terminal during Claude Code tool execution

</code_context>

<specifics>
## Specific Ideas

- The test hook approach was user-preferred over just guessing at stderr — empirical resolution of the CRITICAL blocker before any real code is written
- Arabic rendering concern noted: user observed Arabic may not render correctly depending on terminal font. Transliteration line directly below is the mitigation for Phase 1.
- The dashed separator (`------`) format was shown in preview and confirmed — simple, no Unicode required

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation-and-hook-scaffold*
*Context gathered: 2026-03-14*
