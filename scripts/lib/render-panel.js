'use strict';

const chalk = require('chalk');

// Build chalk helpers dynamically on each call so NO_COLOR env changes take effect.
// Pitfall 3: hook stdout is not a TTY — chalk auto-detects level 0, must force level 3.
// Lazily re-checked so test harness can set/unset NO_COLOR between renderPanel calls.
function makeHelpers() {
  const c = new chalk.Instance({ level: process.env.NO_COLOR ? 0 : 3 });
  return {
    green: s => c.hex('#2d6a4f')(s),
    dim:   s => c.dim(s)
  };
}

// Box drawing characters
const B = {
  tl: '\u250C',  // ┌
  tr: '\u2510',  // ┐
  bl: '\u2514',  // └
  br: '\u2518',  // ┘
  h:  '\u2500',  // ─
  v:  '\u2502'   // │
};

// Panel width constants
const BOX_WIDTH      = 64;  // fixed panel width (above narrow threshold)
const NARROW_NO_ART  = 60;  // below: omit mosque art, keep box frame
const NARROW_NO_BOX  = 40;  // below: fall back to Phase 1 plain-text style

// Mosque art — minimalist dome + minaret silhouette, hand-crafted
// Each line <= 62 chars (inner width = BOX_WIDTH - 2 border chars)
// Lines are colored green when displayed
const MOSQUE_ART_LINES = [
  '       |         |         |       ',
  '      _|_       _|_       _|_      ',
  '     /   \\     /   \\     /   \\     ',
  '    |  O  |   |  O  |   |  O  |    ',
  '    |_____|___|_____|___|_____|    ',
  '   /                               \\',
  '  |_________________________________|'
];

/**
 * Wrap a content line inside box borders.
 * Pads/truncates text to innerWidth chars, adds border + space on each side.
 *
 * @param {string} text - Raw text (may contain ANSI codes)
 * @param {number} innerWidth - Width of content area (box width - 2 borders - 2 spaces)
 * @param {function} greenFn - Color function for borders (respects NO_COLOR context)
 */
function boxLine(text, innerWidth, greenFn) {
  // Measure visible width (strip ANSI for length calculation)
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
  let displayText = text;
  if (stripped.length > innerWidth) {
    // Truncate: count visible chars, keep that slice
    let visCount = 0;
    let cutIdx = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\x1b') {
        // Skip entire ANSI sequence
        const m = text.slice(i).match(/^\x1b\[[0-9;]*m/);
        if (m) { cutIdx += m[0].length; i += m[0].length - 1; continue; }
      }
      if (visCount >= innerWidth) break;
      cutIdx++;
      visCount++;
    }
    displayText = text.slice(0, cutIdx);
  }
  const strippedFinal = displayText.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = ' '.repeat(Math.max(0, innerWidth - strippedFinal.length));
  const border = greenFn(B.v);
  return border + ' ' + displayText + pad + ' ' + border;
}

/**
 * renderPanel(ayah, opts) — pure function, returns formatted display string.
 *
 * @param {object} ayah - Ayah object from loadAyah()
 * @param {object} opts - { cols: number }
 * @returns {string} Formatted panel string
 */
function renderPanel(ayah, opts) {
  try {
    // Rebuild chalk helpers on every call so NO_COLOR changes take effect mid-session
    const { green, dim } = makeHelpers();

    const cols = (opts && opts.cols) || 80;

    // NARROW_NO_BOX: fall back to Phase 1 plain-text style
    if (cols < NARROW_NO_BOX) {
      return [
        '------',
        ayah.arabic,
        ayah.transliteration,
        '"' + ayah.translation + '"',
        '\u2014 ' + ayah.surah_name + ' ' + ayah.surah_number + ':' + ayah.ayah_number,
        '------'
      ].join('\n');
    }

    // Determine panel width
    const width     = cols < NARROW_NO_ART ? Math.min(cols, BOX_WIDTH) : BOX_WIDTH;
    const innerWidth = width - 4;  // 1 border + 1 space on each side
    const useArt    = cols >= NARROW_NO_ART;

    // Build content lines
    const lines = [];

    // Mosque art (wide mode only)
    if (useArt) {
      for (const artLine of MOSQUE_ART_LINES) {
        // Center art line within innerWidth
        const stripped = artLine.replace(/\x1b\[[0-9;]*m/g, '');
        const padLeft  = Math.max(0, Math.floor((innerWidth - stripped.length) / 2));
        const padRight = Math.max(0, innerWidth - stripped.length - padLeft);
        const centered = ' '.repeat(padLeft) + green(artLine) + ' '.repeat(padRight);
        lines.push(boxLine(centered, innerWidth, green));
      }
      // Blank separator line between art and text
      lines.push(boxLine('', innerWidth, green));
    }

    // Ayah content lines
    lines.push(boxLine(ayah.arabic, innerWidth, green));
    lines.push(boxLine(dim(ayah.transliteration), innerWidth, green));
    lines.push(boxLine(ayah.translation, innerWidth, green));
    lines.push(boxLine(
      green('\u2014 ' + ayah.surah_name + ' ' + ayah.surah_number + ':' + ayah.ayah_number),
      innerWidth,
      green
    ));

    // Build top and bottom borders
    const topBorder    = green(B.tl + B.h.repeat(width - 2) + B.tr);
    const bottomBorder = green(B.bl + B.h.repeat(width - 2) + B.br);

    return [topBorder, ...lines, bottomBorder].join('\n');

  } catch (_) {
    // Zero-crash guarantee: return empty systemMessage-compatible fallback
    return '';
  }
}

module.exports = { renderPanel };
