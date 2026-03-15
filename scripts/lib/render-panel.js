'use strict';

// Zero-dependency ANSI helpers. Raw escape codes so the plugin works
// when installed via marketplace (no npm install step in cache).
// NO_COLOR: https://no-color.org/
function makeHelpers() {
  if (process.env.NO_COLOR) {
    return { green: s => s, dim: s => s };
  }
  return {
    green: s => '\x1b[38;2;45;106;79m' + s + '\x1b[39m',
    dim:   s => '\x1b[2m' + s + '\x1b[22m'
  };
}

const B = {
  tl: '\u250C', tr: '\u2510',
  bl: '\u2514', br: '\u2518',
  h:  '\u2500', v:  '\u2502'
};

const BOX_WIDTH   = 64;
const NARROW_NO_BOX = 40;

// Strip ANSI and BiDi control chars before measuring visible width.
function visibleWidth(text) {
  return text
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .length;
}

// Word-wrap text to fit within width visible columns.
function wrapLine(text, width) {
  const words = text.split(' ');
  const lines = [];
  let cur = '', curW = 0;
  for (const w of words) {
    const ww = visibleWidth(w);
    const sep = cur ? 1 : 0;
    if (curW + sep + ww <= width) {
      cur = cur ? cur + ' ' + w : w;
      curW += sep + ww;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      curW = ww;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// Render one line inside box borders, padded to innerWidth.
// U+200E after padding anchors the right border in LTR context without
// corrupting adjacent URLs (terminal link detection stops at the padding).
function boxLine(text, innerWidth, greenFn) {
  const vw = visibleWidth(text);
  let displayText = text;
  if (vw > innerWidth) {
    // Safety truncation — wrapLine should prevent this in normal use
    let count = 0, cutIdx = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\x1b') {
        const m = text.slice(i).match(/^\x1b\[[0-9;]*m/);
        if (m) { cutIdx += m[0].length; i += m[0].length - 1; continue; }
      }
      if (count >= innerWidth) break;
      cutIdx++; count++;
    }
    displayText = text.slice(0, cutIdx);
  }
  const pad = ' '.repeat(Math.max(0, innerWidth - visibleWidth(displayText)));
  const border = greenFn(B.v);
  return border + ' ' + displayText + pad + '\u200E' + ' ' + border;
}

function renderPanel(ayah, opts) {
  try {
    const { green, dim } = makeHelpers();
    const cols = (opts && opts.cols) || 80;
    const quranUrl = 'https://quran.com/' + ayah.surah_number + '/' + ayah.ayah_number;

    if (cols < NARROW_NO_BOX) {
      return [
        '------',
        ayah.transliteration,
        '"' + ayah.translation + '"',
        '\u2014 ' + ayah.surah_name + ' ' + ayah.surah_number + ':' + ayah.ayah_number,
        quranUrl,
        '------'
      ].join('\n');
    }

    const width      = Math.min(cols, BOX_WIDTH);
    const innerWidth = width - 4;
    const lines      = [];

    for (const line of wrapLine(ayah.transliteration, innerWidth)) {
      lines.push(boxLine(dim(line), innerWidth, green));
    }
    for (const line of wrapLine(ayah.translation, innerWidth)) {
      lines.push(boxLine(line, innerWidth, green));
    }
    lines.push(boxLine(
      green('\u2014 ' + ayah.surah_name + ' ' + ayah.surah_number + ':' + ayah.ayah_number),
      innerWidth, green
    ));
    lines.push(boxLine('', innerWidth, green));
    lines.push(boxLine(dim('Open: ' + quranUrl), innerWidth, green));

    const topBorder    = green(B.tl + B.h.repeat(width - 2) + B.tr);
    const bottomBorder = green(B.bl + B.h.repeat(width - 2) + B.br);

    // Leading \n so the box starts on its own line after "SessionStart:startup says:"
    return '\n' + [topBorder, ...lines, bottomBorder].join('\n');

  } catch (_) {
    return '';
  }
}

module.exports = { renderPanel };
