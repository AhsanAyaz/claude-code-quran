# Pitfalls Research

**Domain:** Claude Code plugin — terminal display via hook scripts, Arabic/Quran content
**Researched:** 2026-03-14
**Confidence:** HIGH (hooks: official docs verified) / MEDIUM (Arabic terminal: community sources) / MEDIUM (API reliability: limited data)

---

## Critical Pitfalls

### Pitfall 1: Synchronous Hooks Block Every Tool Call

**What goes wrong:**
PreToolUse and PostToolUse hooks fire on every single tool invocation in Claude's agentic loop. If the hook script makes a synchronous network request to fetch an ayah before displaying anything, every Read, Write, Bash, and Grep call will stall by the HTTP round-trip time (often 200–800ms per call). A session with 50 tool calls adds 10–40 seconds of dead waiting.

**Why it happens:**
The natural implementation is "fetch ayah then print it." Developers test with a fast network and small sessions and never notice the accumulated latency. In real long agentic loops the tax compounds invisibly.

**How to avoid:**
Display immediately from the bundled fallback JSON, then fire the API request asynchronously in the background to warm the cache for the next display. Never block the hook's exit on a network request. The hook script should exit (returning control to Claude) within ~200ms; network I/O happens after `process.exitCode = 0` is set and the process detaches. Alternatively, mark the hook `"async": true` to run fully out-of-band — but note that async hooks cannot produce output Claude sees, so only use async for pre-warming cache; keep the display hook synchronous but instant (reading from cache/fallback).

**Warning signs:**
- Hook takes noticeably longer on first tool call of a session vs. subsequent calls
- `time node scripts/display-ayah.js` consistently exceeds 300ms
- User reports Claude "pausing" before each file read

**Phase to address:** Phase 1 (Hook scaffold and display) — architecture decision must be made before any network code is written.

---

### Pitfall 2: SessionEnd Hook's 1.5-Second Timeout Silently Kills Output

**What goes wrong:**
SessionEnd hooks have a hardcoded default timeout of 1.5 seconds. Any output written to stdout or stderr during SessionEnd is suppressed — it does not appear in the terminal as the session closes. A "closing blessing" or summary ayah placed in SessionEnd will either time out or be silently swallowed.

**Why it happens:**
The 1.5-second limit exists so Claude Code can exit promptly. The docs note that SessionEnd output is logged silently. Developers see the hook listed as supported and assume it behaves like PreToolUse output.

**How to avoid:**
Do not use SessionEnd as a display hook for visible output. Use SessionStart for an opening ayah (its stdout is shown as context to Claude but also appears to the user). For a closing experience, use `Stop` or `SubagentStop` hooks instead, which do surface output and have the full 600-second command timeout. If SessionEnd must be used (e.g. for cleanup), increase the timeout via `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` environment variable and accept that output may still not be visible.

**Warning signs:**
- Script runs fine in isolation (`node scripts/session-end.js`) but nothing appears when Claude exits
- Ayah display works on PreToolUse but not at session close

**Phase to address:** Phase 1 (Hook scaffold) — hook event selection must account for this constraint.

---

### Pitfall 3: Arabic Text Renders Broken Across Nearly Every Terminal

**What goes wrong:**
Arabic is a right-to-left, cursive script where each letter has up to 4 contextual forms (initial, medial, final, isolated) and mandatory ligatures (especially lam-alif). Terminals work on a cell grid designed for left-to-right monospace output. Most terminals (including macOS Terminal.app, many Linux VTE-based terminals, and Windows Terminal) do not implement the Unicode Bidirectional Algorithm (UAX #9) at the rendering layer for terminal cell output. The result is that Arabic characters appear reversed, disconnected (each letter in isolated form rather than joined), or intermixed with English in visually wrong order. There is no reliable way to emit RTL or BiDi text and have it appear correctly across all terminals.

**Why it happens:**
Terminal emulators were designed for ASCII and extended into Unicode incrementally. Complex script shaping (joining, ligature formation) and BiDi reordering require a text-shaping engine (e.g. HarfBuzz) that most terminals simply do not have. Each terminal handles BiDi differently, so output correct in one terminal is broken in another.

**How to avoid:**
Accept that raw Unicode Arabic will not render correctly in most terminals. Use one of two strategies:
1. **Pre-shaped transliteration fallback**: Display Arabic in transliterated Latin script (e.g. "Bismillāhi r-raḥmāni r-raḥīm") alongside the English translation, and treat Arabic display as a bonus for capable terminals.
2. **Test-and-degrade**: At startup, detect if the terminal claims Unicode/UTF-8 support (`LANG`, `LC_ALL` containing `UTF-8`, `TERM` not being `dumb`), then attempt to display Arabic. Always print the English translation as the primary readable content regardless.

Do not rely on Unicode directional control characters (RLM, LRM) to fix ordering — terminals do not interpret them for cell reordering.

**Warning signs:**
- Arabic appears as a sequence of disconnected glyphs reading left-to-right
- Box-drawing borders misalign when Arabic text is in the same line
- Characters show as boxes or question marks (missing font)

**Phase to address:** Phase 2 (Display rendering) — must be validated across at least 3 terminals before considering Arabic display "done."

---

### Pitfall 4: Arabic String Width Corrupts Box Alignment

**What goes wrong:**
Terminal box drawing (using `─`, `│`, `╭`, `╰` characters) requires knowing the exact column width of every string inside the box. The `string-width` npm package (which powers most terminal formatting libraries) uses the Unicode East Asian Width property. Arabic characters are classified as "neutral" or "narrow" — width 1 per code point. However, when Arabic is shaped and rendered, a single visible glyph may correspond to multiple code points (e.g. the lam-alif ligature is two code points displayed as one cell). The measured width and the rendered width diverge, causing box borders to misalign or overflow.

**Why it happens:**
`string-width` follows the Unicode standard for column width, which does not account for terminal-specific glyph shaping or ligature collapsing. This is a fundamental mismatch between Unicode's abstract model and terminal cell rendering.

**How to avoid:**
Never mix Arabic text and precise box-drawing alignment in the same line. Structure the display so Arabic occupies its own block, visually separated from the box frame rather than padded to align with it. Use left-padding margins instead of calculated right-padding. Test with actual terminal rendering and measure visually, not programmatically. The `boxen` library's fixed-width mode will produce broken output when Arabic is inside; prefer a simple bordered format where the Arabic line is allowed to overflow the box width naturally.

**Warning signs:**
- Box right border appears mid-line or after a variable gap
- `boxen` or similar library truncates or mis-wraps Arabic lines
- Width calculation returns 40 but terminal renders 35 columns

**Phase to address:** Phase 2 (Display rendering) — design the layout to avoid this class of problem entirely.

---

### Pitfall 5: Shell Startup Output Breaks Hook JSON Communication

**What goes wrong:**
Claude Code hooks communicate via stdout (JSON output) and stderr (error messages). If the hook script is a shell script that sources `.bashrc` or `.zshrc` (which often print welcome messages, conda/nvm activation banners, or `echo` statements), that text is prepended to the JSON output. Claude Code's JSON parser then fails to parse the hook output, causing a "JSON validation failed" warning and the hook's decision or context being silently dropped.

**Why it happens:**
Shell scripts default to sourcing the user profile. Developers test scripts interactively where banner messages are expected; the problem is invisible until Claude Code runs the hook in a non-interactive subshell.

**How to avoid:**
All hook scripts must use shebangs that invoke non-login, non-interactive shells: `#!/usr/bin/env node` for Node.js scripts (preferred — avoids the problem entirely) or `#!/bin/bash` with no `-l` flag. If shell is needed, guard all profile echo statements with `[[ $- == *i* ]] && echo "banner"`. Use Node.js as the primary hook runtime to sidestep shell profile sourcing entirely.

**Warning signs:**
- Hook works when run directly in terminal but Claude Code shows "JSON validation failed"
- Output visible in `/hooks` debug menu shows unexpected text before `{`
- Hook output appears doubled or corrupted

**Phase to address:** Phase 1 (Hook scaffold) — use Node.js as runtime from day one.

---

### Pitfall 6: Hook Script Not Marked Executable

**What goes wrong:**
Hook scripts with a `command` configuration must be executable (`chmod +x`). If the file is committed without the executable bit (common on macOS/Linux, and the bit is always lost on Windows), the hook silently fails with a non-blocking error. Nothing appears in the terminal; Claude continues normally; there is no user-visible error unless verbose mode is on.

**Why it happens:**
Developers write the script, test it with `node script.js` directly, and never set the executable bit. Git does not track the executable bit by default across platforms. The failure is silent because Claude Code treats non-blocking hook errors non-fatally.

**How to avoid:**
Set executable bit in git: `git update-index --chmod=+x scripts/*.js`. Include a setup check in the plugin install instructions. Use `"command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/display-ayah.js"` in hooks.json rather than `"command": "${CLAUDE_PLUGIN_ROOT}/scripts/display-ayah.js"` — this invokes Node.js explicitly and does not require the executable bit on the script file.

**Warning signs:**
- Plugin installed, hooks configured, but nothing appears in terminal during tool use
- Running `${CLAUDE_PLUGIN_ROOT}/scripts/display-ayah.js` directly gives "Permission denied"
- Claude Code verbose mode (`Ctrl+O`) shows hook errored with non-zero exit

**Phase to address:** Phase 1 (Hook scaffold) — bake the `node` invocation into the command string from the start.

---

### Pitfall 7: Hardcoded Paths Break Plugin After Installation to Cache

**What goes wrong:**
Claude Code copies marketplace plugins to `~/.claude/plugins/cache/`. Any absolute path or relative path that assumes the plugin lives at a specific location (e.g. `./scripts/display-ayah.js` or `/Users/username/projects/halal-code/scripts/`) breaks after installation because the cached copy is at a completely different path.

**Why it happens:**
Works perfectly during local development with `claude --plugin-dir ./`, breaks immediately when installed from a marketplace.

**How to avoid:**
Use `${CLAUDE_PLUGIN_ROOT}` for every intra-plugin path in `hooks.json`. Example: `"command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/display-ayah.js"`. Similarly, use `__dirname` in Node.js scripts to resolve sibling files (e.g. the bundled fallback JSON) — never `process.cwd()` which resolves to the user's project directory, not the plugin directory.

**Warning signs:**
- Plugin works with `claude --plugin-dir ./` but fails after `claude plugin install`
- Error: `Cannot find module './fallback-ayahs.json'`
- Bundled fallback data not loading in production install

**Phase to address:** Phase 1 (Hook scaffold) — path strategy must be set before any file references are written.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Always use bundled fallback, no API calls | Zero network latency, no API dependency | Ayahs are static, no fresh content | During Phase 1 scaffold only |
| Hardcode terminal width to 80 columns | Simpler display code | Box overflows in narrow terminals (e.g. split panes, VS Code integrated terminal) | Never — use `process.stdout.columns` from day one |
| Skip Arabic rendering, English-only | Eliminates RTL complexity | Loses the primary visual identity of the project | Acceptable for MVP if transliteration is included |
| Use `chalk` without `supports-color` check | Easy color output | Dumps raw ANSI codes in CI, piped output, or `NO_COLOR` environments | Never — always check `process.stdout.isTTY` or use a library that does |
| Single Quran API with no fallback | Simpler code | API downtime = no display at all in 100% of sessions | Never — bundled fallback is a core requirement |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-----------------|
| alquran.cloud API | Fetching on every hook invocation synchronously | Fetch async in background; display from cache/fallback immediately |
| alquran.cloud API | Assuming consistent response shape across editions | Validate `data.ayahs[0].text` exists before accessing; API shape differs between surah and ayah endpoints |
| api.quran.com | Sending requests from terminal with no User-Agent | Some proxy layers reject requests without `User-Agent`; set a descriptive header |
| Both Quran APIs | No timeout configured on fetch | Default Node.js `fetch` may hang indefinitely; set `AbortController` signal with 3–5 second timeout |
| Both Quran APIs | Treating HTTP 200 with error JSON body as success | These APIs sometimes return `{status: "Bad Request", data: null}` with HTTP 200; check response body, not just status |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous API fetch in hook | Claude pauses 200–800ms before every tool call | Display from cache, fetch async | Every session with >10 tool calls |
| Spawning Node.js process per hook invocation | 100–300ms startup cost per tool call (Node.js cold start) | Keep hook scripts minimal; avoid heavy `require()` chains | Always on slower machines or with large node_modules |
| Loading entire Quran JSON fallback file on each hook | 50–200ms file read per invocation | Pre-select 50 curated ayahs into a small JSON; keep file under 50KB | Negligible at small fallback size; becomes a problem if file grows |
| Uncached random ayah selection | Different ayah every call in same session; no sense of continuity | Cache selected ayah per session using a temp file or env variable | On every session with multiple tool calls |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging full API response to a file with no size limit | Log file grows unboundedly; potential disk fill | No persistent logging; if debugging, use a rotating strategy |
| Fetching user-supplied surah/ayah numbers without validation | Malformed API URL if numbers come from config; SSRF if config is tampered | Whitelist surah (1–114) and ayah ranges; never interpolate unvalidated strings into URLs |
| Storing API keys in plugin files committed to git | Credential exposure | alquran.cloud and api.quran.com are both public/keyless — do not add authentication unless a future API requires it |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Displaying an ayah before every single tool call (PreToolUse on all tools) | Overwhelming; terminal floods with repeated displays during a 30-tool session | Display on PreToolUse for select tool types only, or rate-limit to once per N seconds using a timestamp file/env var |
| Same ayah repeated throughout a session | Spiritually inert; feels like a stuck record | Cache the selected ayah but rotate it per tool-type theme; ensure variety across a session |
| Box or art wider than the terminal | Wrapping creates visual garbage; breaks alignment entirely | Always read `process.stdout.columns` (fallback 80) and constrain art width to `Math.min(columns, 80)` |
| ANSI color codes in CI or piped output | Garbled output in logs; broken pipe errors | Detect `!process.stdout.isTTY` and `NO_COLOR` env var; strip ANSI in non-TTY contexts |
| Silent failure when API is down and fallback is misconfigured | Nothing appears at all; user thinks plugin is broken | Test fallback path explicitly; always log a minimal plaintext ayah to stderr as last resort |

---

## "Looks Done But Isn't" Checklist

- [ ] **Hook output visible**: Tested in actual Claude Code session (`claude` CLI), not just by running the script directly — output to stdout from hooks only appears in certain contexts.
- [ ] **Fallback works offline**: Tested by blocking network (`unshare -n` or disabling wifi) — bundled JSON loads and displays without any API call.
- [ ] **Arabic renders acceptably**: Tested in at least macOS Terminal, iTerm2, and VS Code integrated terminal — not just in the developer's preferred terminal.
- [ ] **Narrow terminal handled**: Tested with `COLUMNS=40` or a narrow split pane — art and box do not overflow or wrap destructively.
- [ ] **NO_COLOR respected**: Tested with `NO_COLOR=1 claude` — output is readable plain text without ANSI escape sequences.
- [ ] **Executable bit set in git**: Verified with `git ls-files --stage scripts/` — mode should be `100755`, not `100644`.
- [ ] **Paths work from cache**: Tested with `claude plugin install` (not just `--plugin-dir`) — `${CLAUDE_PLUGIN_ROOT}` resolves correctly.
- [ ] **Hook version survives plugin update**: After bumping version and reinstalling, hooks.json paths resolve to new version — old cached path not retained.
- [ ] **API timeout fires correctly**: Tested by pointing fetch at a non-responsive host — hook exits within 5 seconds, falls back gracefully.
- [ ] **Session-long ayah caching works**: Multiple tool calls in one session show the same thematic ayah, not random rotation per call.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Synchronous hook blocking all tool calls | MEDIUM | Add `async: true` to hook config as immediate fix; then refactor to cache-first display in next iteration |
| Arabic rendering broken in user's terminal | LOW | Ship an environment variable `HALAL_CODE_ARABIC=0` to disable Arabic display; document which terminals work |
| API always failing (service outage) | LOW | Bundled fallback is already required; ensure fallback path is exercised in CI test |
| Executable bit lost on deploy | LOW | Change hook command to `node ${CLAUDE_PLUGIN_ROOT}/scripts/display-ayah.js` — Node invoked explicitly, bit irrelevant |
| Plugin paths broken after marketplace install | MEDIUM | Audit all path references for `${CLAUDE_PLUGIN_ROOT}`; replace any `__dirname` workarounds that don't apply across install modes |
| Box layout broken in narrow terminal | LOW | Detect `process.stdout.columns < 60`; switch to a minimal single-line format instead of full-panel display |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Synchronous hook blocking tool calls | Phase 1: Hook scaffold | Measure hook exit time: `time claude` with a tool call; must be under 300ms |
| SessionEnd timeout / silent output | Phase 1: Hook scaffold | Attempt to display in SessionEnd; confirm nothing appears; switch to SessionStart/Stop hooks |
| Arabic RTL rendering broken | Phase 2: Display rendering | Visual QA across 3 terminal emulators; document which render correctly |
| Arabic string width corrupting box alignment | Phase 2: Display rendering | Render box with Arabic content; verify right border aligns consistently |
| Shell startup output breaking JSON | Phase 1: Hook scaffold | Use Node.js runtime in hook command from the start; never shell scripts |
| Script not executable | Phase 1: Hook scaffold | Use explicit `node` invocation; verify with `git ls-files --stage` |
| Hardcoded paths breaking after install | Phase 1: Hook scaffold | Test with `claude plugin install` before Phase 1 is considered done |
| No-color / CI environment | Phase 2: Display rendering | Run with `NO_COLOR=1`; verify readable plain output |
| Narrow terminal overflow | Phase 2: Display rendering | Test at `COLUMNS=40`; verify graceful degradation |
| API timeout hanging hook | Phase 3: API integration | Test with unreachable host; confirm fallback triggers within 5 seconds |
| Plugin version update breaking hook paths | Phase 3 or distribution | Test full update cycle: install v1, bump to v2, reinstall, verify hooks fire |

---

## Sources

- [Claude Code Hooks Reference — official docs](https://code.claude.com/docs/en/hooks) — hook timeouts, exit codes, blocking behavior (HIGH confidence)
- [Claude Code Plugins Reference — official docs](https://code.claude.com/docs/en/plugins-reference) — path resolution, `${CLAUDE_PLUGIN_ROOT}`, directory structure, common issues (HIGH confidence)
- [PostToolUse Hook Exit Code 1 Blocks Claude — GitHub Issue #4809](https://github.com/anthropics/claude-code/issues/4809) — confirmed blocking behavior bug (MEDIUM confidence)
- [Plugin hooks not updated when plugin version changes — GitHub Issue #18517](https://github.com/anthropics/claude-code/issues/18517) — version upgrade path pitfall (MEDIUM confidence)
- [RTL and BiDi text in terminal emulators — freedesktop.org](https://terminal-wg.pages.freedesktop.org/bidi/bidi-intro/rtl-bidi-text.html) — fundamental architectural issue with Arabic in terminals (HIGH confidence)
- [Proper Complex Script Support in Text Terminals — Unicode L2/2023](https://www.unicode.org/L2/L2023/23107-terminal-suppt.pdf) — academic treatment of Arabic width and alignment in terminals (HIGH confidence)
- [RTL support issue — Windows Terminal #538](https://github.com/microsoft/terminal/issues/538) — BiDi rendering not implemented (HIGH confidence)
- [Arabic/RTL support request — Claude Code #12635](https://github.com/anthropics/claude-code/issues/12635) — RTL problem applies to Claude Code's own UI (MEDIUM confidence)
- [string-width — npm](https://www.npmjs.com/package/string-width) — East Asian Width classification, Arabic character handling (MEDIUM confidence)
- [Claude Code hooks guide — automate-workflows](https://code.claude.com/docs/en/hooks-guide) — shell profile stdout interference, JSON validation failure (HIGH confidence)
- [supports-color — npm](https://www.npmjs.com/package/supports-color) — NO_COLOR, FORCE_COLOR, isTTY detection (HIGH confidence)
- [boxen — GitHub](https://github.com/sindresorhus/boxen) — fixed-width box overflow behavior (MEDIUM confidence)
- [SessionEnd hook does not fire with /clear — GitHub Issue #6428](https://github.com/anthropics/claude-code/issues/6428) — SessionEnd behavioral edge case (MEDIUM confidence)

---
*Pitfalls research for: Claude Code plugin (halal-code) — hooks, Arabic terminal rendering, Quran API, terminal display*
*Researched: 2026-03-14*
