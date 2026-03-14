# Architecture Research

**Domain:** Claude Code plugin — hooks-based terminal display (halal-code)
**Researched:** 2026-03-14
**Confidence:** HIGH (official Claude Code docs + live API verification)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Claude Code Process                             │
│  (SessionStart / PreToolUse / PostToolUse / SessionEnd fires)       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  JSON via stdin (tool_name, hook_event_name,
                           │  session_id, cwd, ...)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Hook Dispatcher (hooks/hooks.json)                │
│  matcher: "Bash|Read|Write|Edit|Glob|Grep|WebFetch|WebSearch"       │
│  command: "${CLAUDE_PLUGIN_ROOT}/scripts/display-ayah.js"           │
│  type: "command"   async: true   timeout: 10                        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  spawns Node.js process
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      display-ayah.js (main hook script)             │
│                                                                     │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────────┐   │
│  │ Event Parser│→  │Theme Selector│→  │   Ayah Resolver       │   │
│  │ (reads stdin│   │(tool+time →  │   │ cache hit → serve     │   │
│  │  JSON)      │   │ theme tag)   │   │ cache miss → fallback │   │
│  └─────────────┘   └──────────────┘   └──────────┬────────────┘   │
│                                                   │                │
│  ┌────────────────────────────────────────────────▼────────────┐   │
│  │                   Renderer                                  │   │
│  │  ASCII mosque art + Arabic ayah + English translation       │   │
│  │  → width-aware framed box → process.stderr (visible now)   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                           │  writes to stderr
                           ▼
             Terminal (user sees the display immediately)

┌─────────────────────────────────────────────────────────────────────┐
│                Background Cache Refresher (async)                   │
│  SessionStart hook (sync, short) → spawn detached fetch process     │
│  fetch from alquran.cloud API → write to ~/.cache/halal-code/       │
│  TTL: 24 hours per theme bucket (8 themes × ~10 ayahs each)        │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Location |
|-----------|----------------|----------|
| hooks/hooks.json | Declares which hook events trigger which script; sets async:true and matcher patterns | `hooks/hooks.json` |
| .claude-plugin/plugin.json | Plugin identity manifest (name, version, author) | `.claude-plugin/plugin.json` |
| display-ayah.js | Main entry point: reads stdin, selects theme, resolves ayah, renders to stderr | `scripts/display-ayah.js` |
| event-parser.js | Parses stdin JSON; extracts tool_name, hook_event_name, session_id | `scripts/lib/event-parser.js` |
| theme-selector.js | Maps (tool_name, hour-of-day) → theme tag string | `scripts/lib/theme-selector.js` |
| ayah-resolver.js | Returns an ayah object: cache first, fallback bundle second | `scripts/lib/ayah-resolver.js` |
| cache.js | Reads/writes ~/.cache/halal-code/cache.json; enforces 24-hour TTL per theme | `scripts/lib/cache.js` |
| cache-refresher.js | Fetches new ayahs from alquran.cloud; run async at SessionStart | `scripts/cache-refresher.js` |
| renderer.js | Composes ASCII art + Arabic text + English translation into width-aware box | `scripts/lib/renderer.js` |
| fallback.json | Bundled ~50 curated ayahs with Arabic text, English translation, and theme tags | `data/fallback.json` |

## Recommended Project Structure

```
halal-code/
├── .claude-plugin/
│   └── plugin.json                # name, version, description
├── hooks/
│   └── hooks.json                 # hook event → script mappings
├── scripts/
│   ├── display-ayah.js            # main hook entry point (all events except SessionStart)
│   ├── session-start.js           # SessionStart entry point (triggers cache refresh)
│   ├── cache-refresher.js         # async API fetch + cache write (spawned detached)
│   └── lib/
│       ├── event-parser.js        # reads stdin, returns structured event object
│       ├── theme-selector.js      # (tool_name, hour) → theme tag
│       ├── ayah-resolver.js       # cache + fallback lookup
│       ├── cache.js               # file-system cache read/write
│       └── renderer.js            # ASCII art + text → terminal box
├── data/
│   └── fallback.json              # 50 curated ayahs with theme tags
└── README.md
```

### Structure Rationale

- **scripts/lib/**: All pure logic modules with no I/O side effects. Individually testable, no dependency on Claude's runtime.
- **scripts/ (top level)**: Entry point scripts only — these are what hooks invoke. They wire lib/ together and handle stdin/stdout/stderr.
- **data/fallback.json**: Static asset bundled with the plugin, never fetched at display time.
- **hooks/hooks.json**: Kept at plugin root (not inside .claude-plugin/). Claude Code requires this exact location.
- **.claude-plugin/plugin.json**: Only the manifest lives here — a common mistake is putting other directories inside .claude-plugin/.

## Architectural Patterns

### Pattern 1: Async Hook with Sync Display

**What:** Mark hook as `async: true` so Claude Code does not wait for it. The display script writes to stderr immediately from the fallback/cache, making the user see the ayah the moment the event fires, but without blocking Claude's tool execution.

**When to use:** All PreToolUse and PostToolUse hooks. These must not slow down the tool pipeline.

**Trade-offs:** With `async: true`, hook output goes to verbose mode (Ctrl+O) by default for stdout. Writing to stderr instead causes immediate visible output in the terminal even for async hooks. This is the correct output channel for display.

**Configuration:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Read|Write|Edit|Glob|Grep|WebFetch|WebSearch",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/display-ayah.js",
            "async": true,
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Key insight:** `async: true` is only available on `type: "command"` hooks. HTTP, prompt, and agent hooks cannot be async. The 10-second timeout is a safety ceiling; the display script should complete in under 100ms when serving from cache or fallback.

### Pattern 2: Stale-While-Revalidate Cache

**What:** On every display, serve from the on-disk cache immediately (or from fallback.json if cache is empty). At SessionStart, separately spawn a cache refresher that fetches from alquran.cloud and overwrites the cache for the next session.

**When to use:** Any plugin that talks to an external API but cannot afford the latency at display time.

**Trade-offs:** The user may see the same ayah from the last session on first use. This is acceptable — the ayah is still valid and beautiful. Freshness improves session-over-session, not within-session.

**Data flow:**
```
SessionStart fires (sync hook, short timeout)
  → session-start.js reads stdin
  → spawns cache-refresher.js as detached child process (no await)
  → exits immediately (Claude continues)

cache-refresher.js (background, detached)
  → for each theme tag, fetch 3 ayahs from alquran.cloud
  → write to ~/.cache/halal-code/cache.json
  → set TTL timestamp

PreToolUse / PostToolUse fires
  → display-ayah.js reads stdin
  → ayah-resolver: check cache for theme tag → found? use it
  → not found? random from fallback.json for that theme
  → render to stderr
  → exit 0
```

**Cache file format** (`~/.cache/halal-code/cache.json`):
```json
{
  "fetchedAt": "2026-03-14T08:00:00Z",
  "themes": {
    "ilm": [
      {
        "arabic": "اقْرَأْ بِاسْمِ رَبِّكَ...",
        "english": "Read in the name of your Lord...",
        "reference": "96:1",
        "surahName": "Al-Alaq",
        "surahNameTranslation": "The Clot"
      }
    ],
    "tawakkul": [],
    "ihsan": [],
    "sabr": [],
    "fajr": [],
    "nahar": [],
    "maghrib": [],
    "isha": []
  }
}
```

### Pattern 3: Two-Axis Theme Selection

**What:** Combine tool_name → primary theme with hour-of-day → time overlay. The time overlay can either select a time-specific pool or boost/filter from the primary theme pool.

**When to use:** Always — random selection produces spiritually incoherent output. This is the core differentiator.

**Mapping table:**
```
Tool name → Primary theme:
  Read, Glob, Grep, WebFetch, WebSearch  → "ilm"     (knowledge/seeking)
  Bash                                   → "tawakkul" (effort + reliance)
  Write, Edit                            → "ihsan"    (excellence/craft)
  PostToolUseFailure                     → "sabr"     (patience)
  SessionStart                           → "fajr" if morning, else "nahar"
  SessionEnd                             → "maghrib" if evening, else "isha"
  PreCompact                             → "sabr"    (compression = letting go)

Hour of day → Time modifier:
  04:00–07:59  → prefer fajr pool (or fajr-tagged ayahs from primary pool)
  08:00–11:59  → no modification
  12:00–15:59  → prefer nahar pool (perseverance, midday)
  16:00–18:59  → no modification
  19:00–21:59  → prefer maghrib pool (gratitude)
  22:00–03:59  → prefer isha pool (reflection, night)
```

**Resolution logic:** If tool theme pool has ayahs AND time pool has ayahs, alternate or pick randomly from the intersection/union depending on pool sizes. If only one pool populated, use it. If neither, fall through to any ayah from fallback.json.

### Pattern 4: Stderr for Immediate Terminal Visibility

**What:** Write all display output to `process.stderr` rather than `process.stdout`.

**When to use:** Always, for async hooks. Critical distinction:

- `stdout` from async hooks: suppressed unless verbose mode (Ctrl+O) is active
- `stderr` from async hooks: immediately visible in the terminal even without verbose mode

**Trade-offs:** stderr is conventionally for errors. Using it for display output is unconventional but necessary here. Claude Code's own documentation confirms stderr is "shown to user" for non-blocking events regardless of verbose state. This is the correct choice for a display plugin.

**Implementation:**
```javascript
// CORRECT — visible immediately
process.stderr.write(renderedBox + '\n');

// WRONG for async hooks — only in verbose mode
process.stdout.write(renderedBox + '\n');
```

## Data Flow

### Hook Event → Display (happy path, cache warm)

```
Claude Code fires PreToolUse (tool: "Read")
  │
  ├─ stdin JSON: { tool_name: "Read", hook_event_name: "PreToolUse", ... }
  │
  ▼
display-ayah.js starts (Node.js, ~5ms startup)
  │
  ├─ event-parser.js: extract tool_name = "Read"
  ├─ theme-selector.js: "Read" → "ilm", hour=14 → "nahar"
  ├─ ayah-resolver.js:
  │    check ~/.cache/halal-code/cache.json
  │    themes.ilm has 3 ayahs → pick random one
  │
  ├─ renderer.js:
  │    read process.stdout.columns (fallback: 80)
  │    compose ASCII mosque art (width-scaled)
  │    wrap Arabic text centered (line by line — RTL handled by terminal)
  │    wrap English translation left-aligned
  │    draw border box with surah reference footer
  │
  └─ process.stderr.write(box)   ← user sees it now
     exit 0 (no JSON output needed — async hook, no decisions)
```

### Hook Event → Display (cold start, cache empty)

```
Same as above, but:
  ├─ ayah-resolver.js: cache miss for "ilm"
  │    → load data/fallback.json (sync require — bundled, always present)
  │    → filter fallback by theme tag "ilm"
  │    → pick random from filtered set
  └─ continue to renderer.js as normal
```

### SessionStart → Cache Refresh (background)

```
Claude Code fires SessionStart
  │
  ▼
session-start.js starts (sync hook, timeout: 30s)
  │
  ├─ Read stdin (session source: "startup"/"resume"/etc.)
  ├─ Check cache TTL: if fetchedAt < 24h ago → skip refresh
  ├─ If refresh needed:
  │    spawn({ detached: true }): node cache-refresher.js
  │    child.unref()  ← detach from parent process
  └─ exit 0 immediately

cache-refresher.js (background process, ~2–5 seconds total)
  ├─ For each theme: fetch 3 ayahs from alquran.cloud
  │    GET /v1/ayah/{ref}/editions/quran-uthmani,en.asad
  │    Response: data[0].text = Arabic, data[1].text = English
  ├─ Build cache object with fetchedAt timestamp
  └─ Write ~/.cache/halal-code/cache.json (atomic: write temp, rename)
```

### alquran.cloud API — Verified Response Format

```
GET https://api.alquran.cloud/v1/ayah/2:255/editions/quran-uthmani,en.asad

Response:
{
  "code": 200,
  "status": "OK",
  "data": [
    {
      "number": 255,
      "text": "ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ...",   ← Arabic (quran-uthmani)
      "edition": { "identifier": "quran-uthmani", "direction": "rtl", ... },
      "surah": { "number": 2, "englishName": "Al-Baqara", "numberOfAyahs": 286, ... },
      "numberInSurah": 255
    },
    {
      "number": 255,
      "text": "God - there is no deity save Him...",    ← English (en.asad)
      "edition": { "identifier": "en.asad", "direction": "ltr", ... },
      "surah": { "number": 2, "englishName": "Al-Baqara", ... },
      "numberInSurah": 255
    }
  ]
}
```

Extraction: `data[0].text` = Arabic, `data[1].text` = English, `data[0].surah.englishName` + `data[0].numberInSurah` = reference label.

## Rendering Pipeline

### Terminal Width Awareness

```javascript
const width = process.stdout.columns || 80;
const boxWidth = Math.min(width - 4, 100);  // cap at 100 for readability
```

### Box Composition Order

```
┌──── Surah Name ────────────────────────────────────────────────────┐
│                                                                    │
│                     [ASCII mosque art]                             │
│                  (scaled to ~40% of box width)                     │
│                                                                    │
│  بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ                         │
│  [Arabic ayah text — centered, right-origin layout]                │
│                                                                    │
│  "Read in the name of your Lord who created —"                     │
│  [English translation — left-aligned, wrapped at box width]        │
│                                                                    │
│                        — Al-Alaq 96:1                              │
└────────────────────────────────────────────────────────────────────┘
```

### Arabic RTL Rendering Note

Modern terminals (macOS Terminal, iTerm2, Windows Terminal, most Linux terminals) correctly display Unicode Arabic text right-to-left when the characters are output as-is. The bidirectional algorithm (Unicode Bidi) runs in the terminal emulator. The hook script does not need to reverse Arabic strings — it outputs them directly and lets the terminal handle direction. For centering, measure the string's display width using the `string-width` npm package (handles wide characters) and pad accordingly.

**Known limitation:** Some SSH sessions and older terminal emulators do not render Arabic RTL correctly. This is acceptable — the fallback is readable English and surah reference remains visible.

## Scaling Considerations

This is a single-user terminal plugin. "Scale" means multiple active Claude Code sessions on one machine, or a busy developer running 100+ tool calls per session.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 session, light use | No changes needed. Async hooks, file cache, bundled fallback handles everything. |
| 1 session, 100+ tool calls | Ensure display-ayah.js startup is fast (<50ms). Use `require()` (CJS) or cached ESM imports. Don't re-read fallback.json on every invocation — load once. |
| Multiple concurrent sessions | Cache file write: use atomic rename (write tmp, rename to final) to avoid corruption from concurrent writes. Reader lock is unnecessary — reads are atomic at OS level for small JSON files. |
| Developer who uses Claude offline | Fallback.json always works. Cache refresh silently fails (no network) — no user-visible error. |

### Scaling Priorities

1. **First bottleneck:** Node.js process startup latency. Each hook invocation spawns a new Node.js process. Minimize require() chain depth. Do not import large libraries (no full chalk, no boxen — custom renderer is faster).
2. **Second bottleneck:** cache.json read on every tool call. Keep the file small (<10KB). If it grows, switch to one file per theme.

## Anti-Patterns

### Anti-Pattern 1: Synchronous Hook for Display

**What people do:** Register display hook without `async: true`, causing it to block Claude's tool execution until the display completes.

**Why it's wrong:** Even a 50ms Node.js startup blocks every Bash call, every Read, every Write. Over a session with 200 tool calls this adds 10 full seconds of dead time. The user notices.

**Do this instead:** Always set `"async": true` on display hooks. Write to stderr for immediate visibility. Accept that the display fires slightly after the tool — the human cannot tell the difference.

### Anti-Pattern 2: Fetching from API at Display Time

**What people do:** Call alquran.cloud inside display-ayah.js (the hook script) to get a fresh ayah on every tool use.

**Why it's wrong:** Even on a fast connection, an HTTP fetch adds 100–500ms per hook invocation. On slow networks or API downtime, it adds multi-second delays or causes the hook to fail. This directly violates the project constraint: "display must not add noticeable latency."

**Do this instead:** Cache refresh happens only at SessionStart, detached and in background. The display script never touches the network.

### Anti-Pattern 3: Putting Logic Files Inside .claude-plugin/

**What people do:** Place scripts/, hooks/, or data/ directories inside the .claude-plugin/ folder.

**Why it's wrong:** Claude Code only expects plugin.json inside .claude-plugin/. Placing other directories there means Claude Code does not recognize them and hooks will not fire.

**Do this instead:** Only plugin.json goes in .claude-plugin/. All other directories (scripts/, hooks/, data/) go at the plugin root.

### Anti-Pattern 4: Writing Display to stdout (for async hooks)

**What people do:** Use process.stdout.write() to render the ayah box.

**Why it's wrong:** For async command hooks, stdout is suppressed unless the user has verbose mode (Ctrl+O) enabled. The user sees nothing by default.

**Do this instead:** Write display output to process.stderr. Claude Code shows stderr to the user immediately for non-blocking hooks, regardless of verbose mode.

### Anti-Pattern 5: Importing boxen or chalk for the Renderer

**What people do:** Reach for boxen (ESM-only, heavy) and chalk for terminal styling.

**Why it's wrong:** boxen v8 is ESM-only, which requires either `import()` (adds async startup complexity) or switching the entire plugin to ESM. boxen also does not handle Arabic RTL width correctly out of the box. chalk adds another dependency.

**Do this instead:** Write a custom renderer in ~100 lines of CJS JavaScript. Use `string-width` for one precise width measurement. Use ANSI escape codes directly for color (`\x1b[33m`, `\x1b[0m`). Use `─ │ ┌ ┐ └ ┘` box-drawing chars directly. This is simpler, faster, and gives full control over Arabic centering.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| alquran.cloud API | HTTP GET via Node.js `https` module (no dependencies) | Endpoint: `/v1/ayah/{ref}/editions/quran-uthmani,en.asad`. No auth required. No stated rate limit. Use `https.get()` with timeout. |
| File system cache | Read/write `~/.cache/halal-code/cache.json` | Use `os.homedir()` to resolve path. Atomic write: write to `.tmp` file then `fs.renameSync()`. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| hooks.json → display-ayah.js | Claude Code spawns Node.js process; JSON piped to stdin | Script must read all of stdin before processing (stream, not sync read). |
| display-ayah.js → lib/ | Direct CommonJS require() calls | All lib/ modules are pure functions; no I/O except cache.js and renderer.js (stderr write). |
| session-start.js → cache-refresher.js | child_process.spawn with detached: true + unref() | Fully decoupled after spawn. No IPC. No stdout/stderr piping from child. |
| cache-refresher.js → cache.js | Function call; cache.js owns the file | cache-refresher.js does not write directly to the file. |
| ayah-resolver.js → fallback.json | require('./../../data/fallback.json') | Bundled JSON loads synchronously; safe at startup. Node.js caches require() results. |

## Suggested Build Order

Build in this order because each layer depends on the one below it:

1. **data/fallback.json** — Curate 50 ayahs with Arabic, English, theme tags, and references. This is the safety net for everything else. Nothing works without it.

2. **scripts/lib/cache.js** — File-system cache read/write with TTL. Pure I/O, no logic.

3. **scripts/lib/event-parser.js** — Parses stdin JSON. Validate against known hook_event_name values. No external dependencies.

4. **scripts/lib/theme-selector.js** — Pure function: (tool_name, hour) → theme tag string. Fully testable without Claude Code running.

5. **scripts/lib/ayah-resolver.js** — Composes cache.js + fallback.json lookup. Pure I/O, deterministic output.

6. **scripts/lib/renderer.js** — Custom terminal box renderer. Build this standalone; test by running `node scripts/lib/renderer.js` directly. No Claude Code required.

7. **scripts/display-ayah.js** — Wires event-parser → theme-selector → ayah-resolver → renderer → stderr. The integration entry point.

8. **scripts/cache-refresher.js** — API fetch + cache write. Test in isolation by running directly.

9. **scripts/session-start.js** — Thin wrapper: check TTL, spawn cache-refresher detached, exit.

10. **hooks/hooks.json + .claude-plugin/plugin.json** — Wire the plugin. Test with `claude --plugin-dir ./halal-code`.

## Sources

- [Claude Code Hooks Reference (official docs)](https://code.claude.com/docs/en/hooks) — stdin JSON format, exit codes, async behavior, stderr visibility, timeout defaults (HIGH confidence)
- [Claude Code Plugins Guide (official docs)](https://code.claude.com/docs/en/plugins) — plugin.json schema, directory structure, ${CLAUDE_PLUGIN_ROOT} env var, hooks/hooks.json location (HIGH confidence)
- [alquran.cloud API](https://alquran.cloud/api) — base URL, edition system, ayah endpoint format (HIGH confidence — verified against live API)
- [Live API response verification](https://api.alquran.cloud/v1/ayah/2:255/editions/quran-uthmani,en.asad) — confirmed exact JSON schema including data[], text, edition.direction, surah.englishName, numberInSurah (HIGH confidence)
- [boxen v8.0.1 (GitHub)](https://github.com/sindresorhus/boxen) — ESM-only status, border options, unicode width limitation (MEDIUM confidence — docs don't address Arabic RTL)
- [string-width (npmjs)](https://www.npmjs.com/package/string-width) — unicode-aware string width measurement (HIGH confidence)
- [Claude Code hooks mastery (GitHub)](https://github.com/disler/claude-code-hooks-mastery) — community patterns for async hooks, stderr vs stdout behavior in practice (MEDIUM confidence)

---
*Architecture research for: halal-code (Claude Code plugin — Quranic ayah terminal display)*
*Researched: 2026-03-14*
