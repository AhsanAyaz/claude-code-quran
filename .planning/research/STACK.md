# Stack Research

**Domain:** Claude Code plugin — terminal Quran ayah display
**Researched:** 2026-03-14
**Confidence:** HIGH (Claude Code hooks verified against official docs; Quran API verified against live endpoint; terminal rendering verified via npm ecosystem)

---

## Critical Constraint Discovered During Research

**Hook stdout is NOT visible to users in normal terminal operation.**

This is the most important finding for this project. Claude Code hooks execute scripts, but their stdout is captured internally — it appears in Claude's context (for SessionStart/UserPromptSubmit) or in verbose mode only (Ctrl+O). In normal mode, users do not see hook stdout in their terminal.

**The implication:** Ayah display cannot work through normal stdout from a command hook script. You must use one of two mechanisms:

1. **`systemMessage`** — JSON field in hook output, displays a short warning/notice to the user in the Claude Code UI. Limited to plain text, not suitable for multi-line ASCII art.
2. **Write directly to `/dev/tty`** — bypasses stdout capture by writing directly to the controlling terminal. This is the correct approach for this plugin. Tested and confirmed working in the community (stderr to /dev/tty works even when stdout is captured).

The hook script must open and write to `/dev/tty` directly:

```javascript
const tty = require('fs');
const ttyFd = tty.openSync('/dev/tty', 'w');
tty.writeSync(ttyFd, displayOutput + '\n');
tty.closeSync(ttyFd);
```

This bypasses the stdout/stderr capture entirely and renders directly in the user's terminal.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 18+ LTS | Hook script runtime | Required by project constraints; universal on dev machines; async fetch built-in (node:https); no extra install |
| Claude Code Hooks | Current (hooks schema v1) | Plugin integration | The only mechanism Claude Code exposes for third-party lifecycle integration |
| `/dev/tty` direct write | N/A (POSIX) | Terminal display | Bypasses stdout capture; the only reliable way to display rich output to users from a hook script |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chalk` | **4.1.2** (NOT 5.x) | ANSI terminal colors | Use v4 because hook scripts use CommonJS (`require()`). Chalk 5+ is ESM-only and will throw `ERR_REQUIRE_ESM`. Pin to `^4.1.2`. |
| `boxen` | **8.0.1** | Framed box rendering (ayah panel) | Drawing the ayah display box with borders, padding, title. Supports borderStyle: 'round', borderColor, padding. |
| `string-width` | **7.x** | Visual column width of strings | Required for correct centering/padding of Arabic text — Arabic characters can have different visual widths than byte counts suggest. boxen uses this internally; import it for width calculations. |
| `node-fetch` | N/A (use built-in) | HTTP requests to Quran API | Node.js 18+ has `fetch` built-in (stable). Do not add node-fetch as a dependency. |

**No-dependency alternative for colors only:** Node.js v22+ has `util.styleText()` built-in. If targeting Node 22+, skip chalk entirely and use `util.styleText('green', text)`. For Node 18 compatibility, use chalk@4.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| No build step | Hook scripts run directly with `node` | Keep as plain `.js` CommonJS files. No transpilation, no bundler. Claude Code invokes them with `node script.js` directly. |
| `node --check` | Syntax validation | Run in CI to catch errors without executing |

---

## Claude Code Hook System — Reference

### Configuration Location

Hooks live in `.claude/settings.json` (project-level, shareable via git) under a top-level `"hooks"` key. There is no separate `hooks.json` at plugin level for user-installed plugins — use `.claude/settings.json`.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/display-ayah.js",
            "timeout": 10,
            "async": true
          }
        ]
      }
    ]
  }
}
```

### Hook Events — Complete List (Confirmed)

| Event | Fires When | Matcher Support | Blocking? | Relevant for This Plugin |
|-------|-----------|-----------------|-----------|--------------------------|
| `SessionStart` | Session begins or resumes | `startup`, `resume`, `clear`, `compact` | NO | YES — show ayah on session open |
| `UserPromptSubmit` | User submits a prompt | None | YES | MAYBE — show ayah while Claude processes |
| `PreToolUse` | Before any tool executes | Tool name (`Bash`, `Edit`, `Write`, `Read`, `Glob`, `Grep`, `*`) | YES | YES — thematic by tool type |
| `PostToolUse` | After tool succeeds | Tool name | NO | MAYBE — show after long Bash commands |
| `PostToolUseFailure` | After tool fails | Tool name | NO | YES — sabr (patience) ayahs on errors |
| `Stop` | Claude finishes responding | None | YES | MAYBE — closing ayah |
| `SessionEnd` | Session terminates | `clear`, `logout`, etc. | NO (1.5s limit) | NO — too brief |
| `PreCompact` | Before transcript compaction | `manual`, `auto` | NO | NO — background event |
| `InstructionsLoaded` | CLAUDE.md loaded | None | NO | NO |
| `Notification` | Permission/idle prompts | `permission_prompt`, `idle_prompt` | NO | NO |
| `SubagentStart/Stop` | Subagent lifecycle | Agent name | Varies | NO |

**Recommended hook events for this plugin:** `SessionStart`, `PreToolUse` (with `async: true`).

### Hook Input (stdin JSON)

All command hooks receive this JSON on stdin:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "npm test" }
}
```

`tool_name` and `tool_input` are present on `PreToolUse`/`PostToolUse`. Use `tool_name` to select thematic ayahs.

### Environment Variables Available

| Variable | Available In | Value |
|----------|-------------|-------|
| `CLAUDE_PROJECT_DIR` | All hooks | Absolute path to project root |
| `CLAUDE_PLUGIN_ROOT` | Plugin hooks | Plugin directory |
| `CLAUDE_CODE_REMOTE` | All hooks | `"true"` if running in remote web environment |
| `CLAUDE_ENV_FILE` | SessionStart only | Path to env file for persisting exports |

### Hook Invocation and Output

```
Script receives: JSON via stdin
Script writes: Display output to /dev/tty (NOT stdout)
Script exits: 0 (success) always — never exit 2 for this plugin
Async: true — set this so Claude is NOT blocked waiting for ayah display
```

**Do not return JSON output** from the hook script. Just write to `/dev/tty` and exit 0. Returning JSON decisions from an async hook has no effect (Claude has already proceeded).

### Timeout

Default command hook timeout: **600 seconds**. Set `"timeout": 10` in the hook config — ayah display should complete in under 2 seconds even with API fetch.

---

## Quran API — Reference

### Primary: alquran.cloud (api.alquran.cloud/v1)

**Base URL:** `https://api.alquran.cloud/v1`
**Authentication:** None required
**Rate limits:** Not published — no auth, no documented limits. Treat as a public free API; implement caching/fallback to avoid hammering it.
**Format:** JSON, supports `Accept-Encoding: gzip` or `zstd`

#### Recommended Endpoint: Single Ayah, Multiple Editions

```
GET https://api.alquran.cloud/v1/ayah/{reference}/editions/{edition1},{edition2}
```

Example — Ayat al-Kursi with Arabic text + Saheeh International translation:
```
GET https://api.alquran.cloud/v1/ayah/2:255/editions/quran-uthmani,en.sahih
```

**Response structure:**
```json
{
  "code": 200,
  "status": "OK",
  "data": [
    {
      "number": 262,
      "text": "ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ...",
      "edition": {
        "identifier": "quran-uthmani",
        "language": "ar",
        "name": "Uthmani",
        "direction": "rtl",
        "type": "quran"
      },
      "surah": {
        "number": 2,
        "name": "سُورَةُ البَقَرَةِ",
        "englishName": "Al-Baqara",
        "numberOfAyahs": 286,
        "revelationType": "Medinan"
      },
      "numberInSurah": 255,
      "juz": 3,
      "page": 42,
      "sajda": false
    },
    {
      "number": 262,
      "text": "Allah - there is no deity except Him...",
      "edition": {
        "identifier": "en.sahih",
        "language": "en",
        "direction": "ltr",
        "type": "translation"
      }
    }
  ]
}
```

#### Random Ayah Endpoint

```
GET https://api.alquran.cloud/v1/ayah/random/editions/quran-uthmani,en.sahih
```

Use this for random ayah selection when no thematic match is needed.

#### Available English Translation Identifiers (Verified)

| Identifier | Translator | Notes |
|------------|-----------|-------|
| `en.sahih` | Saheeh International | **Recommended.** Clear modern English, widely used, most accessible |
| `en.asad` | Muhammad Asad | Literary, scholarly — good secondary option |
| `en.itani` | Talal Itani (Clear Quran) | Very readable modern English |
| `en.yusufali` | Abdullah Yusuf Ali | Classic, widely known but archaic English |
| `en.pickthall` | Marmaduke Pickthall | Archaic English, historical value |
| `en.hilali` | Hilali & Khan | Long footnote-heavy text, less suitable for display |
| `en.maududi` | Abul Ala Maududi | Scholarly commentary style |

**Recommendation:** Use `en.sahih` as primary. It's the most readable for the target audience and has clean concise text suitable for terminal display.

To get the full list dynamically:
```
GET https://api.alquran.cloud/v1/edition/language/en
```

### Secondary: api.quran.com (QuranFoundation)

**Base URL:** `https://api.quran.com/api/v4`
**Authentication:** None for read endpoints
**Rate limits:** Returns HTTP 429 on excess; no published thresholds

The QuranFoundation API has more complex translation resource IDs (numeric) and the response includes HTML markup in translation text (footnotes as `<sup>` tags). This requires HTML stripping before terminal display. **Use alquran.cloud as primary** — cleaner plain-text responses, simpler API shape.

Use QuranFoundation as a fallback mirror only, not primary.

---

## Terminal Rendering — Reference

### Strategy: Direct tty write + Unicode box-drawing + ANSI colors

Since hook stdout is captured, all display must go to `/dev/tty`. The display pipeline is:

1. Fetch ayah (async, with timeout — fall to bundled fallback if slow)
2. Build display string: chalk colors + boxen frame + Arabic text + English translation
3. Write to `/dev/tty` via `fs.writeSync(ttyFd, output)`

### Arabic Text Rendering Constraints

Arabic text is Right-to-Left (RTL). Standard terminals handle display of Arabic characters correctly at the character level — the glyphs render right-to-left automatically. However:

- **Column width calculation is unreliable for Arabic.** Arabic characters are counted as 1 column wide by most tools, but combining characters (diacritics, harakat) have zero visual width. `string-width` v7 handles this via Unicode east-asian-width data.
- **Do not attempt programmatic right-alignment of Arabic text** — the terminal itself handles RTL rendering. Just output the Arabic string and the terminal will right-align it. Alignment tricks using spaces will break rendering.
- **Recommendation:** Display Arabic text as a left-aligned block inside the box. The terminal's RTL support handles the visual direction. Do not fight it.
- **Boxen width:** Set a fixed `width` on boxen (e.g., 80 columns or `process.stdout.columns`) to prevent layout shifts from Arabic Unicode counting errors.

### Library Versions and ESM/CJS

Hook scripts run as plain Node.js scripts via `node script.js`. They use CommonJS (`require()`) unless `"type": "module"` is in package.json or the file uses `.mjs` extension. **Use CommonJS** — simpler, no build step, widely supported.

This means:
- chalk: **v4.1.2** (last CJS version, stable for years, no plans to remove)
- boxen: **v8.0.1** — CHECK: boxen v8 may be ESM-only (sindresorhus has moved many packages to ESM). If so, use v7.x or implement box-drawing manually with Unicode characters.
- string-width: same ESM concern — use v4.x for CJS compatibility

**ESM-safe alternative to boxen:** Implement box drawing manually using Unicode box-drawing characters (`┌`, `─`, `┐`, `│`, `└`, `┘`) with chalk for color. This eliminates the ESM dependency risk entirely and is straightforward for a fixed-width panel.

```javascript
// Manual box drawing — no boxen needed
const chalk = require('chalk');
const width = Math.min(process.stdout.columns || 80, 80);
const horizontal = '─'.repeat(width - 2);
const top    = chalk.green('┌' + horizontal + '┐');
const bottom = chalk.green('└' + horizontal + '┘');
const line = (text) => chalk.green('│') + text + chalk.green('│');
```

### No-External-Dependency Option

If the project requirement "no external dependencies beyond Node.js" is strictly enforced:

- **Colors:** Node.js v22+ has `util.styleText()` built-in. For Node 18-21, use raw ANSI escape codes directly.
- **Box drawing:** Unicode box characters + manual padding (see above)
- **String width:** `Intl.Segmenter` (built-in Node 16+) for grapheme segmentation; implement basic width heuristic manually
- **HTTP fetch:** Node.js 18+ `fetch` is stable

This approach is viable and keeps the plugin to zero npm dependencies.

---

## Installation

```bash
# If using npm dependencies (chalk v4 for CJS compatibility):
npm install chalk@4

# If boxen is CJS-compatible at chosen version:
npm install boxen@7

# string-width CJS-compatible version:
npm install string-width@4

# Dev dependencies — none required (no build step)
```

**Strongly consider the zero-dependency approach** given the project's "no external dependencies beyond Node.js" constraint. The manual ANSI + Unicode box-drawing approach is ~50 lines of code and eliminates npm dependency management entirely.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| alquran.cloud (primary) | api.quran.com (QuranFoundation) | If alquran.cloud goes down; has more translation options but complex API and HTML in responses |
| chalk@4 (CJS) | chalk@5 (ESM) | Only if hook scripts are converted to `.mjs` ES modules — adds complexity for no benefit |
| Manual box drawing | boxen | If boxen ESM migration is confirmed; same output, fewer dependencies |
| `/dev/tty` direct write | stdout | stdout is captured by Claude Code and not shown to user — never use stdout for display |
| `async: true` hook | Blocking hook | If the plugin needs to gate tool execution — not the goal; display is fire-and-forget |
| Node.js built-in fetch | node-fetch | node-fetch is redundant on Node 18+; built-in fetch is stable |
| Bundled fallback JSON | API-only | API is rate-limit-free but network calls can fail or add latency — fallback ensures instant display |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `chalk@5` | ESM-only, breaks `require()` in CommonJS hook scripts | `chalk@4.1.2` or raw ANSI escape codes |
| `boxen@8` (if ESM-only) | Same ESM problem — sindresorhus packages migrated to ESM | `boxen@7` or manual Unicode box drawing |
| `string-width@5+` | ESM-only | `string-width@4` or manual grapheme counting |
| `stdout` for display output | Claude Code captures hook stdout; user never sees it in normal mode | Write to `/dev/tty` with `fs.openSync('/dev/tty', 'w')` |
| `exit code 2` | Marks hook as a blocking error, feeds stderr to Claude as context | Only exit 0; this plugin is display-only, never a blocker |
| `async: false` (blocking) | Blocks Claude tool execution until ayah displays; adds latency | `async: true` — fire and forget |
| `api.quran.com` as primary | HTML in translation text requires stripping; numeric resource IDs are less ergonomic | `api.alquran.cloud/v1` — clean plain text, named edition identifiers |
| Python scripts for hooks | Project constraint is Node.js only; Python adds a dependency assumption | Node.js `.js` scripts with `#!/usr/bin/env node` shebang |

---

## Stack Patterns by Variant

**If targeting Node 18-21 (minimum compatibility):**
- Use chalk@4 for colors (CJS)
- Use built-in `fetch` (stable in 18+)
- Use `string-width@4` for column calculation
- Manual box drawing to avoid boxen ESM issues

**If targeting Node 22+ only:**
- Use `util.styleText()` instead of chalk (zero dependencies)
- Built-in fetch
- Consider ESM scripts (`.mjs`) to unlock chalk@5 and boxen@8

**If zero npm dependencies is enforced:**
- Raw ANSI codes (hardcoded escape sequences)
- Unicode box-drawing characters
- Built-in `fetch`
- Built-in `Intl.Segmenter` for grapheme counting
- Bundled fallback JSON only (skip API entirely on first pass)

---

## Version Compatibility

| Package | Version | Compatible Node | Notes |
|---------|---------|-----------------|-------|
| chalk | 4.1.2 | 12+ | Last CJS version. Stable, no planned removal. |
| chalk | 5.x | 14+ (ESM only) | Breaks `require()`. Do not use in CJS scripts. |
| boxen | 7.x | 14+ | Last version before potential ESM migration — verify before install |
| boxen | 8.0.1 | 18+ | Verify CJS support before using |
| string-width | 4.x | 12+ | CJS compatible |
| string-width | 5-7 | ESM only | Do not use in CJS scripts |
| node fetch | — | 18+ (built-in) | `fetch` is stable in Node 18 LTS; no package needed |

---

## Sources

- `https://code.claude.com/docs/en/hooks` — Claude Code hooks reference (official docs). Hook event names, configuration schema, timeout defaults, stdin/stdout behavior. HIGH confidence.
- `https://github.com/anthropics/claude-code/issues/11120` — Feature request confirming hook stdout is NOT visible to users in normal mode. Closed as NOT PLANNED. HIGH confidence.
- `https://github.com/anthropics/claude-code/issues/12653` — SessionStart stderr behavior. Resolution: use `systemMessage` JSON field or `/dev/tty` for user-visible output. HIGH confidence.
- `https://api.alquran.cloud/v1/edition/language/en` — Live endpoint, verified all 17 English translation identifiers. HIGH confidence.
- `https://api.alquran.cloud/v1/ayah/2:255/editions/quran-uthmani,en.sahih` — Live endpoint, verified response structure. HIGH confidence.
- `https://www.npmjs.com/package/chalk` — chalk version history, ESM migration in v5. HIGH confidence.
- `https://www.npmjs.com/package/boxen` — boxen v8.0.1 current, borderStyle options. MEDIUM confidence (need to verify CJS vs ESM for v8).
- `https://www.npmjs.com/package/string-width` — string-width version 7, Unicode width handling. MEDIUM confidence.
- `https://github.com/chalk/chalk/issues/527` — Confirms chalk@5 ESM-only, chalk@4 is CJS workaround. HIGH confidence.

---

*Stack research for: halal-code Claude Code plugin*
*Researched: 2026-03-14*
