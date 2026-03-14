# Feature Research

**Domain:** Claude Code plugin — terminal Quranic ayah display with ASCII mosque art
**Researched:** 2026-03-14
**Confidence:** HIGH (hook mechanics verified via official docs and GitHub issues; Quran API verified via official docs; ASCII art feasibility verified via existing examples)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must exist or the plugin feels unfinished or unreliable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Ayah text (Arabic + English translation) | Core identity — without Arabic, this is just a quote app, not a Quran plugin | MEDIUM | Arabic rendering in terminals is inconsistent; display as a centered block, not inline. Arabic will appear LTR-flipped in most terminals — accept this as a known constraint, not a bug. Most terminals (iTerm2, Alacritty, Windows Terminal) do not implement UAX #9 BiDi algorithm. |
| Surah name + ayah reference (e.g. Al-Baqarah 2:255) | Users need to verify and look up what they see; attribution is an Islamic obligation | LOW | Include both the English name and transliterated Arabic name (Al-Baqarah, not just "The Cow"). |
| English translation attribution | Multiple Quran translations exist; "whose translation is this?" is a basic scholarly question | LOW | Include translator name (e.g. "Trans: Saheeh International"). |
| Bundled offline fallback (~50 curated ayahs) | Plugin must work without internet; API failure at an inopportune moment destroys trust | MEDIUM | ~50 ayahs in a static JSON file, tagged by theme. This is the safety net for the entire plugin. Build this first. |
| Width-aware terminal display | Standard terminals are 80 columns; art or text that overflows looks broken | MEDIUM | Detect terminal width via `process.stdout.columns`. Clamp to 80 if wider, gracefully degrade if narrower. Minimum usable width: 60 columns. |
| Non-blocking async display | Hook must not add latency to Claude's tool execution — a 500ms delay every tool call is intolerable | HIGH | Fetch from API async in background; display cached/bundled ayah immediately; update cache for next display. Never block the hook exit on a network call. |
| Hook integration into Claude Code lifecycle | This is the delivery mechanism — without it, the plugin doesn't exist | HIGH | Use `PreToolUse` for during-work moments (highest frequency), `SessionStart` for opening, `SessionEnd` for closing. Display via `systemMessage` JSON output field (the only reliably user-visible output mechanism — confirmed via GitHub issue #4084, resolved in v1.0.64). |
| Thematic ayah selection by tool type | Random selection feels thoughtless; thematic selection makes each ayah feel intentional and spiritually coherent | MEDIUM | Minimum viable: map tool names to 4-5 themes (see thematic mapping below). |
| Graceful no-op on fast/repeated triggers | PreToolUse fires on every tool call — displaying an ayah before every single Read/Grep would be overwhelming | MEDIUM | Rate-limit: display at most once per N seconds (suggested: 45–90s) or once per tool-call group (not each tool in a sequence). |

---

### Differentiators (Competitive Advantage)

Features that set this plugin apart. Not required for launch, but they define the experience.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| ASCII mosque silhouette art | Transforms a text display into a spiritual visual moment — no other Quran CLI tool does this | MEDIUM | Use Unicode block characters (█, ▓, ▒, ░) and box-drawing characters (─, │, ╔, ╗) for clean, scalable silhouettes. Width: ~45–60 chars for dome+minarets. Multiple art variants (3–5) to avoid repetition. Feasibility confirmed: existing mosque ASCII art at ascii.co.uk and textart.sh demonstrates this is achievable with standard characters. |
| Transliteration line | Allows non-Arabic-readers to sound out the ayah — creates a bridge to the language | LOW | Single line below Arabic, above translation. Source from API (alquran.cloud supports transliteration editions) or bundle in fallback JSON. |
| Time-of-day theming | Fajr ayahs feel different from Isha ayahs; aligning spiritual content with the rhythm of the Islamic day adds depth | LOW | Map system time to rough prayer window buckets: Fajr (4–7am), Dhuhr (12–2pm), Asr (3–5pm), Maghrib (6–8pm), Isha (9pm–3am). Combine with tool-type theme for selection. |
| Framed panel display | A box-drawn border around the ayah makes it feel like a page of the Mushaf rather than a log line | LOW | Use Unicode box-drawing characters. Frame width = terminal width - 4. Include padding inside frame. |
| Multiple translation options | Different Muslims prefer different translations; Saheeh International vs. Yusuf Ali vs. Dr. Mustafa Khattab | LOW | Ship with Saheeh International as default (clear, modern English). Store preferred edition in a config file. Do not require users to edit JSON to change it. |
| Surah emoji/symbol decoration | A small crescent (☪) or star in the frame header adds Islamic visual identity without complexity | LOW | Single character, renders universally in modern terminals. Use sparingly — once in the header, not scattered throughout. |
| PostToolUse display on error/failure | Displaying a sabr ayah when a tool fails (e.g. Bash exits non-zero) is the most contextually perfect spiritual moment in the entire plugin | MEDIUM | Hook into `PostToolUse` with a matcher for failure conditions. Read `tool_result.exit_code` or `tool_result.error` from the PostToolUse JSON input. |
| SessionEnd closing ayah | A du'a or ayah about gratitude (shukr) at session end gives closure — the Islamic equivalent of closing the Mushaf | LOW | One ayah, no art needed, shorter display format. Theme: shukr/gratitude or tawakkul. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Audio recitation playback | "Hearing the Quran is beautiful" | Terminals have no universal audio API; requires system audio configuration; disruptive in shared/office environments; impossible via Claude Code hooks which are text-only | Text transliteration achieves 80% of the spiritual value without any of the complexity |
| User account / cloud preferences | "Sync my settings across machines" | No auth infrastructure; adds network dependency; privacy concern for religious usage data; massive scope creep for a CLI plugin | Store preferences in a local `~/.claude/halal-code.json` or in the plugin directory. Dotfiles already handle cross-machine sync for most devs. |
| Full Quran browser / search | "Let me search the Quran from here" | Completely different UX paradigm — browsing requires interactivity that hooks cannot support; QuranCLI already does this well | Keep the plugin as a passive display tool. If search is needed, recommend quranCLI as a companion tool. |
| Customizable ayah curation UI | "I want to manage my own ayah list" | A UI for curating 50 ayahs is more complex than the entire rest of the plugin; 95% of users will never use it | Ship a well-curated default set. Power users can edit the JSON fallback file directly. |
| Prayer time notifications | "Remind me when it's prayer time" | Requires a persistent background process; Claude Code hooks are not daemons; proper prayer time calculation needs location data | Recommend Muslimtify or Azan CLI as dedicated tools for this. Out of scope. |
| Rate limiting configurable per hook event | "I want different frequencies for PreToolUse vs SessionStart" | Complex configuration surface for minimal benefit; most users will never tune this | Sensible defaults: SessionStart always shows, PreToolUse rate-limited, SessionEnd always shows. One global rate-limit config value if any. |
| Animated/typewriter text reveal | "Make the ayah appear letter by letter" | Adds artificial delay to every hook execution; fighting against the "non-blocking" constraint; looks gimmicky in a dev tool | Static display loads instantly and feels more like opening a book than a loading animation. |
| Full Arabic BiDi/RTL rendering | "The Arabic should display right-to-left properly" | Terminal BiDi support is fragmented — only Konsole reliably implements UAX #9; attempting to force RTL with ANSI escapes creates garbage in most terminals | Display Arabic text as-is from the API. Most Muslim developers understand their terminal will not render it perfectly. Acknowledge this in the README. Do not try to fix it programmatically. |

---

## Feature Dependencies

```
[Bundled fallback JSON (50 ayahs + themes)]
    └──required by──> [All ayah display features]
                          └──required by──> [ASCII mosque panel display]
                          └──required by──> [Thematic selection]

[Hook integration (systemMessage output)]
    └──required by──> [Any user-visible display]
                          └──required by──> [SessionStart opening ayah]
                          └──required by──> [PreToolUse thematic display]
                          └──required by──> [SessionEnd closing ayah]

[Tool-type theme mapping]
    └──required by──> [Thematic ayah selection]
                          └──enhances──> [Transliteration line]
                          └──enhances──> [Framed panel display]

[Async API fetch + cache]
    └──enhances──> [Bundled fallback JSON]
    (fetch fills cache; fallback covers misses)

[Rate limiting logic]
    └──required by──> [PreToolUse hook] (without it, ayah spam on every tool call)
    └──conflicts with──> [PostToolUse on-failure display]
    (failure display should bypass rate limit — a sabr ayah on error is always timely)

[Terminal width detection]
    └──required by──> [ASCII mosque art]
    └──required by──> [Framed panel display]
```

### Dependency Notes

- **Bundled fallback requires building first:** Every display feature depends on ayahs being available. The fallback JSON is the foundation — build and tag it before wiring any hooks.
- **systemMessage is the only reliable display path:** Direct terminal write via `/dev/tty` is suppressed by Claude Code (confirmed in issues #11120, #12653, #4084). The `systemMessage` JSON field in hook stdout is the only documented, working mechanism for user-visible hook output. All display must go through this path.
- **Rate limiting conflicts with failure display:** The PostToolUse-on-failure sabr ayah should bypass the rate limiter. Implement rate limiting as a check, not a global throttle that blocks all paths.
- **ASCII art requires width detection:** Without knowing terminal width, art will break. Detect width before rendering art; fall back to text-only display if width < 60.
- **Async fetch enhances but does not replace fallback:** The fallback is not a degraded mode — it is the primary path. API is a quality enhancement, not a requirement for functionality.

---

## Thematic Mapping (Tool Type to Quran Theme)

This is core feature logic that affects ayah curation in the fallback JSON.

| Claude Code Tool(s) | Theme | Rationale | Example Ayah Topics |
|---------------------|-------|-----------|---------------------|
| `Read`, `Glob`, `Grep`, `WebSearch`, `WebFetch` | 'Ilm (knowledge/seeking) | These are information-gathering tools — the Muslim developer is seeking understanding | "My Lord, increase me in knowledge" (20:114), value of reading (96:1-5) |
| `Bash` | Tawakkul (reliance on Allah after effort) | Executing commands is the effort; the result is in Allah's hands | "And when you have decided, then rely upon Allah" (3:159) |
| `Write`, `Edit`, `MultiEdit` | Ihsan (excellence/craftsmanship) | Creating and editing code — the Islamic ethic of doing one's best work | "Allah has prescribed excellence (ihsan) in all things" (Muslim hadith-adjacent), ayahs about careful work |
| `PostToolUse` (error/failure) | Sabr (patience/perseverance) | A tool failed; the developer needs fortitude | "Indeed, Allah is with the patient" (2:153), "After hardship comes ease" (94:5-6) |
| `SessionStart` | Barakah / Bismillah (blessing/beginning) | Opening the session — the Islamic practice of beginning with the name of Allah | Ayahs about seeking Allah's help at the start of endeavors |
| `SessionEnd` | Shukr (gratitude) + Tawakkul | Closing the session — gratitude for what was accomplished, trust for what remains | "If you are grateful, I will surely increase you" (14:7) |
| Time: Fajr (4–7am) | Spiritual awakening, dawn | The blessing of Fajr time; ayahs about waking for worship | Ayahs about the night prayer, standing in worship |
| Time: Dhuhr/Asr (12–5pm) | Perseverance, midday effort | The grind of the working day | Ayahs about steadfastness in effort |
| Time: Maghrib/Isha (6pm–3am) | Reflection, gratitude, hope | Evening contemplation | Ayahs about the mercy of Allah, reflection on the day |

**Note:** When both tool-type theme and time-of-day theme apply, prefer tool-type theme as primary selector (it is more contextually specific). Use time-of-day as a tiebreaker within the theme bucket.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what is needed to demonstrate the concept works.

- [ ] Bundled fallback JSON (~50 ayahs, tagged by theme) — the entire plugin depends on this; build first
- [ ] PreToolUse hook with `systemMessage` output — primary delivery mechanism for most ayah displays
- [ ] SessionStart hook — first impression display with barakah-themed ayah
- [ ] ASCII mosque silhouette (1 design, 2–3 width variants) — the visual signature of the plugin
- [ ] Arabic + English translation + surah/ayah reference in the display — table stakes content
- [ ] Tool-type to theme mapping (5 tool groups) — makes the plugin feel intentional, not random
- [ ] Rate limiting on PreToolUse (45–90 second cooldown) — prevents ayah spam on rapid tool sequences
- [ ] Terminal width detection + graceful narrow-terminal fallback (text only) — avoids broken display

### Add After Validation (v1.x)

Features to add once the core experience is confirmed to feel good.

- [ ] Transliteration line — add after confirming API delivers it; add to fallback JSON in v1.1
- [ ] Time-of-day theme layering — straightforward once theme system is in place
- [ ] PostToolUse on-failure display (sabr theme) — requires reading PostToolUse JSON for error signal
- [ ] SessionEnd closing ayah — simple addition; low effort once SessionStart works
- [ ] Async API fetch + local cache — improves variety beyond bundled 50; validate bundled set works first
- [ ] Framed panel display (box-drawing border) — visual polish; defer until layout is stable

### Future Consideration (v2+)

Features to defer until the plugin has real usage and feedback.

- [ ] Multiple ASCII mosque art designs (3–5 variants) — needs the art assets to be created; time-intensive
- [ ] Multiple translation options (Yusuf Ali, Khattab, etc.) — needs config UX to be worthwhile; not needed at launch
- [ ] Surah completion detection (notify when you've seen all ayahs from a surah) — novelty feature; only valuable with significant usage
- [ ] Plugin config file (`~/.halal-code.json`) for user preferences — only needed when there are preferences worth storing

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Bundled fallback JSON | HIGH | LOW | P1 |
| PreToolUse hook + systemMessage output | HIGH | MEDIUM | P1 |
| ASCII mosque art (1 design) | HIGH | MEDIUM | P1 |
| Arabic + translation + reference display | HIGH | LOW | P1 |
| Tool-type theme mapping | HIGH | LOW | P1 |
| SessionStart hook | HIGH | LOW | P1 |
| Rate limiting on PreToolUse | HIGH | LOW | P1 |
| Terminal width detection | HIGH | LOW | P1 |
| Transliteration line | MEDIUM | LOW | P2 |
| Time-of-day theme layering | MEDIUM | LOW | P2 |
| PostToolUse on-failure (sabr) | HIGH | MEDIUM | P2 |
| SessionEnd closing ayah | MEDIUM | LOW | P2 |
| Async API fetch + cache | MEDIUM | HIGH | P2 |
| Framed panel display | MEDIUM | LOW | P2 |
| Multiple ASCII mosque designs | MEDIUM | HIGH | P3 |
| Multiple translation options | LOW | MEDIUM | P3 |
| Plugin config file | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

No direct competitors exist — no other tool combines Claude Code hooks + Quran display + ASCII Islamic art. The closest comparables are:

| Feature | QuranCLI (ahmedsaheed) | fortune-islamicus (hypothetical) | halal-code (this plugin) |
|---------|------------------------|----------------------------------|--------------------------|
| Arabic text display | Yes | N/A | Yes |
| English translation | Yes (flag-triggered) | Yes | Yes (always shown) |
| Transliteration | No | Unknown | Yes (P2) |
| ASCII art | No | No | Yes — differentiator |
| Hook integration | Not a plugin | Not a plugin | Yes — core mechanism |
| Thematic selection | No (manual surah selection) | Random | Yes — contextual by tool type |
| Offline fallback | Unclear | Likely | Yes — bundled JSON |
| Time-of-day awareness | No | No | Yes (P2) |

---

## Critical Implementation Notes

### Hook Output Visibility (CONFIRMED CONSTRAINT)

The only reliably user-visible output mechanism from a Claude Code hook is the `systemMessage` field in JSON written to stdout. Direct writes to `/dev/tty` are suppressed. stderr is suppressed for exit-0 hooks. Do not attempt workarounds — use `systemMessage`.

```json
{
  "systemMessage": "[ayah display content here]"
}
```

This renders as a system message visible to the user in the Claude Code interface. The ayah display content will appear inline in the conversation panel, not as a separate terminal window.

**Implication for design:** The "full-panel terminal display" vision from PROJECT.md must be understood as a rich inline system message, not a true full-screen takeover. ANSI color codes in `systemMessage` content — verify whether these render or are stripped. This is an open question requiring testing.

### Arabic Rendering (CONFIRMED CONSTRAINT)

Most terminals do not implement the Unicode Bidirectional Algorithm (UAX #9). Arabic text from the API will appear left-to-right in most terminals. This is expected and acceptable. Do not attempt to reverse Arabic strings or inject RTL markers — this creates garbage output in terminals that do partially implement BiDi. Display Arabic as-is; document the limitation.

### API Response Fields (MEDIUM CONFIDENCE)

alquran.cloud supports:
- Arabic text via `quran-uthmani` edition
- English translations via editions like `en.asad`, `en.pickthall`, `en.sahih`
- Transliteration via dedicated transliteration editions

The exact field names in the JSON response require API testing to confirm. The bundled fallback JSON structure should be designed first to define the canonical schema, then the API response mapped to it.

---

## Sources

- [Claude Code Hooks Reference — official docs](https://code.claude.com/docs/en/hooks)
- [Hook Output Visibility Issue #4084 — resolved in v1.0.64, systemMessage is the solution](https://github.com/anthropics/claude-code/issues/4084)
- [SessionStart stdout not displayed Issue #11120 — closed not planned](https://github.com/anthropics/claude-code/issues/11120)
- [SessionStart stderr not displaying Issue #12653 — confirmed intentional behavior](https://github.com/anthropics/claude-code/issues/12653)
- [alquran.cloud API documentation](https://alquran.cloud/api)
- [QuranCLI — existing Quran terminal tool for feature comparison](https://github.com/ahmedsaheed/quranCLI)
- [ascii.co.uk mosque art — feasibility reference](https://ascii.co.uk/art/mosques)
- [textart.sh mosque collection — Unicode block character approach](https://textart.sh/topic/mosque)
- [RTL/BiDi terminal support overview](https://terminal-wg.pages.freedesktop.org/bidi/bidi-intro/rtl-bidi-text.html)
- [Muslimtify — Linux prayer time daemon (out-of-scope comparison)](https://medium.com/@rizkirakasiwi09/integrating-muslimtify-with-waybar-prayer-times-on-your-linux-status-bar-3ceaacaad40b)

---

*Feature research for: Claude Code Quran ayah display plugin (halal-code)*
*Researched: 2026-03-14*
