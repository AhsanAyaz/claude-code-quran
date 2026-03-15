<p align="center">
  <img src="crescent.svg" alt="Crescent Moon" width="100" height="100" />
</p>

<h1 align="center">claude-halal-code</h1>

<p align="center">
  A Claude Code plugin that displays a Quranic ayah at the start of every session.<br/>
  One verse. One intention. Before the work begins.
</p>

---

## What it looks like

```
┌──────────────────────────────────────────────────────────────┐
│ Wa ma tawfeeqi illa billah                                   │
│ And my success cannot come from anywhere except from Allah.  │
│ — Hud 11:88                                                  │
│                                                              │
│ Open: https://quran.com/11/88                                │
└──────────────────────────────────────────────────────────────┘
```

The panel appears once — when you open a session. No interruptions mid-work.

---

## Why

AI tools are fast and dense. Developers feel the pressure to match that pace.
This plugin is a small counter to that: a moment of stillness at the start,
grounded in something that has nothing to do with shipping code.

The Quran is meant to be read and reflected on — not consumed in passing.
So it shows once, at the beginning, and gets out of the way.

---

## Installation

**Requirements:** Claude Code

No dependencies. The plugin uses zero external packages.

### Install via marketplace (recommended)

```
/plugin marketplace add AhsanAyaz/cwa-cc-plugins
/plugin install claude-halal-code@cwa-cc-plugins
```

That's it. The plugin loads automatically on every session from then on.

### Try it manually (session only)

```bash
git clone https://github.com/AhsanAyaz/claude-halal-code
claude --plugin-dir ./claude-halal-code
```

`--plugin-dir` loads the plugin for the current session only. Useful for testing.

---

## How it works

On session start, the plugin:

1. Picks a theme based on the time of day:
   - **4am–9am** — *ilm* (knowledge / intention)
   - **9am–5pm** — *tawakkul* (reliance / effort)
   - **5pm–4am** — *shukr* (gratitude / reflection)

2. Selects a random ayah from that theme's pool (50 curated ayahs across 5 themes)

3. Tracks displayed ayahs per session so you never see the same one twice in one sitting

4. Renders a framed panel with the transliteration, English translation, surah reference, and a direct link to [quran.com](https://quran.com)

---

## Themes

| Theme | Meaning | Time window |
|-------|---------|-------------|
| `ilm` | Knowledge | Fajr / early morning |
| `tawakkul` | Reliance on Allah | Dhuhr / afternoon |
| `shukr` | Gratitude | Maghrib / evening |
| `ihsan` | Excellence | (available in pool) |
| `sabr` | Patience | (available in pool) |

---

## Structure

```
claude-halal-code/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── hooks/
│   └── hooks.json           # SessionStart hook config
├── scripts/
│   ├── session-start.js     # Hook entry point
│   └── lib/
│       ├── load-ayah.js     # Loads ayahs from fallback dataset
│       ├── select-ayah.js   # Theme + time-of-day selection
│       └── render-panel.js  # Framed terminal panel renderer
├── data/
│   └── fallback.json        # 50 curated ayahs, 5 themes
└── crescent.svg
```

---

## Running tests

```bash
node scripts/lib/render-panel.test.js
node scripts/lib/select-ayah.test.js
node scripts/lib/load-ayah.test.js
```

---

## License

MIT
