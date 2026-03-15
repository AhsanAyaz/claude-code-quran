'use strict';
const assert = require('assert');
const path = require('path');

// Sample ayah fixture
const SAMPLE_AYAH = {
  arabic: 'اقْرَأْ بِاسْمِ رَبِّكَ',
  transliteration: "Iqra' bismi rabbika",
  translation: 'Read in the name of your Lord',
  surah_name: 'Al-Alaq',
  surah_number: 96,
  ayah_number: 1,
  themes: ['ilm'],
  time_slots: ['fajr']
};

// Load module under test
const { renderPanel } = require('./render-panel');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log('PASS: ' + description);
    passed++;
  } catch (err) {
    console.log('FAIL: ' + description + ' — ' + err.message);
    failed++;
  }
}

// Test 1: output contains box top-left corner (U+250C) — DISP-01
test('renderPanel() output contains U+250C (box top-left corner)', () => {
  const output = renderPanel(SAMPLE_AYAH, { cols: 80 });
  assert.ok(typeof output === 'string', 'output should be a string');
  assert.ok(output.includes('\u250C'), 'output should contain ┌ (U+250C)');
});

// Test 2: output contains box horizontal (U+2500) — DISP-01
test('renderPanel() output contains U+2500 (box horizontal)', () => {
  const output = renderPanel(SAMPLE_AYAH, { cols: 80 });
  assert.ok(output.includes('\u2500'), 'output should contain ─ (U+2500)');
});

// Test 3: output contains box vertical (U+2502) — DISP-01
test('renderPanel() output contains U+2502 (box vertical)', () => {
  const output = renderPanel(SAMPLE_AYAH, { cols: 80 });
  assert.ok(output.includes('\u2502'), 'output should contain │ (U+2502)');
});

// Test 4: output contains ayah.arabic as a substring — DISP-02, DISP-06
test('renderPanel() output contains ayah.arabic', () => {
  const output = renderPanel(SAMPLE_AYAH, { cols: 80 });
  assert.ok(output.includes(SAMPLE_AYAH.arabic), 'output should contain Arabic text');
});

// Test 5: output contains ayah.transliteration as a substring — DISP-02
test('renderPanel() output contains ayah.transliteration', () => {
  const output = renderPanel(SAMPLE_AYAH, { cols: 80 });
  assert.ok(output.includes(SAMPLE_AYAH.transliteration), 'output should contain transliteration');
});

// Test 6: output contains ayah.translation as a substring — DISP-02
test('renderPanel() output contains ayah.translation', () => {
  const output = renderPanel(SAMPLE_AYAH, { cols: 80 });
  assert.ok(output.includes(SAMPLE_AYAH.translation), 'output should contain translation');
});

// Test 7: output contains ayah.surah_name as a substring — DISP-02
test('renderPanel() output contains ayah.surah_name', () => {
  const output = renderPanel(SAMPLE_AYAH, { cols: 80 });
  assert.ok(output.includes(SAMPLE_AYAH.surah_name), 'output should contain surah name');
});

// Test 8: cols >= 60 → output contains mosque art — DISP-02, DISP-03
// Check by comparing line count with narrow version (art adds lines)
test('renderPanel() with cols=80 contains mosque art lines', () => {
  const outputWide = renderPanel(SAMPLE_AYAH, { cols: 80 });
  const outputNarrow = renderPanel(SAMPLE_AYAH, { cols: 50 });
  const wideLineCount = outputWide.split('\n').length;
  const narrowLineCount = outputNarrow.split('\n').length;
  assert.ok(wideLineCount > narrowLineCount,
    'wide output (' + wideLineCount + ' lines) should have more lines than narrow (' + narrowLineCount + ' lines) due to mosque art');
});

// Test 9: cols < 60 → mosque art is absent — DISP-03
test('renderPanel() with cols=50 does NOT contain mosque art', () => {
  const outputWide = renderPanel(SAMPLE_AYAH, { cols: 80 });
  const outputNarrow = renderPanel(SAMPLE_AYAH, { cols: 50 });
  // Strip ANSI to get raw content for comparison
  const stripAnsi = s => s.replace(/\x1b\[[0-9;]*m/g, '');
  const wideLines = stripAnsi(outputWide).split('\n');
  const narrowLines = stripAnsi(outputNarrow).split('\n');
  // The wide version should have more lines because it includes mosque art
  assert.ok(wideLines.length > narrowLines.length,
    'narrow output should have fewer lines (no mosque art)');
});

// Test 10: NO_COLOR=1 → output has no ANSI escape sequences — DISP-05
test('NO_COLOR=1: output contains no ANSI escape codes', () => {
  const savedNoColor = process.env.NO_COLOR;
  process.env.NO_COLOR = '1';
  let output;
  try {
    output = renderPanel(SAMPLE_AYAH, { cols: 80 });
  } finally {
    if (savedNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = savedNoColor;
    }
  }
  const hasAnsi = /\x1b\[[0-9;]*m/.test(output);
  assert.ok(!hasAnsi, 'output with NO_COLOR=1 should have no ANSI escape codes');
});

// Test 11: without NO_COLOR → output contains at least one ANSI code (colors applied)
test('without NO_COLOR: output contains ANSI color codes', () => {
  const savedNoColor = process.env.NO_COLOR;
  delete process.env.NO_COLOR;
  let output;
  try {
    output = renderPanel(SAMPLE_AYAH, { cols: 80 });
  } finally {
    if (savedNoColor !== undefined) {
      process.env.NO_COLOR = savedNoColor;
    }
  }
  const hasAnsi = /\x1b\[[0-9;]*m/.test(output);
  assert.ok(hasAnsi, 'output without NO_COLOR should contain ANSI color codes');
});

// Test 12: Arabic text passes through unchanged — DISP-06
test('Arabic text is included verbatim (DISP-06)', () => {
  const arabicText = 'اقْرَأْ بِاسْمِ رَبِّكَ';
  const output = renderPanel(SAMPLE_AYAH, { cols: 80 });
  // Strip ANSI codes to get raw content
  const stripped = output.replace(/\x1b\[[0-9;]*m/g, '');
  assert.ok(stripped.includes(arabicText),
    'output should include Arabic text verbatim without transformation');
});

// Summary
console.log('');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed out of ' + (passed + failed) + ' tests');
process.exit(failed > 0 ? 1 : 0);
