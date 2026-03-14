'use strict';
/**
 * TDD tests for scripts/lib/load-ayah.js
 * Run: node scripts/lib/load-ayah.test.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

// Try to require the module — may fail if not yet implemented
let loadAyah;
try {
  ({ loadAyah } = require('./load-ayah'));
} catch (_) {
  loadAyah = undefined;
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  PASS: ' + message);
    passed++;
  } else {
    console.error('  FAIL: ' + message);
    failed++;
  }
}

// ---- Test suite ----

console.log('Test: loadAyah module exists');
assert(typeof loadAyah === 'function', 'loadAyah is a function');

if (typeof loadAyah === 'function') {
  const projectRoot = path.resolve(__dirname, '..', '..');

  console.log('\nTest: returns ayah for valid theme');
  const ayah = loadAyah(projectRoot, 'ilm');
  assert(ayah !== null, 'returns non-null for ilm theme');
  if (ayah !== null) {
    ['arabic', 'transliteration', 'translation', 'surah_name', 'surah_number', 'ayah_number'].forEach(field => {
      assert(ayah[field] != null, 'ayah has field: ' + field);
    });
  }

  console.log('\nTest: returns null for nonexistent root (DATA-05 silent failure)');
  const missing = loadAyah('/nonexistent/path/does/not/exist', 'ilm');
  assert(missing === null, 'returns null for missing fallback.json');

  console.log('\nTest: returns null for unknown theme');
  const noTheme = loadAyah(projectRoot, 'nonexistent_theme_xyz');
  assert(noTheme === null, 'returns null for theme with no matching ayahs');

  console.log('\nTest: returns null for malformed JSON');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'load-ayah-test-'));
  const dataDir = path.join(tmpDir, 'data');
  fs.mkdirSync(dataDir);
  fs.writeFileSync(path.join(dataDir, 'fallback.json'), 'not valid json{{{');
  const malformed = loadAyah(tmpDir, 'ilm');
  assert(malformed === null, 'returns null for malformed JSON');
  fs.rmSync(tmpDir, { recursive: true });

  console.log('\nTest: returns null when ayahs array is empty for requested theme');
  const tmp2Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'load-ayah-test2-'));
  const data2Dir = path.join(tmp2Dir, 'data');
  fs.mkdirSync(data2Dir);
  fs.writeFileSync(path.join(data2Dir, 'fallback.json'), JSON.stringify({
    version: '1.0',
    ayahs: [{ arabic: 'a', transliteration: 'b', translation: 'c', surah_name: 'Al-Fatihah', surah_number: 1, ayah_number: 1, themes: ['shukr'], time_slots: ['fajr'] }]
  }));
  const wrongTheme = loadAyah(tmp2Dir, 'ilm');
  assert(wrongTheme === null, 'returns null when no ayahs match requested theme');
  fs.rmSync(tmp2Dir, { recursive: true });
}

// ---- Summary ----
console.log('\n--- Results: ' + passed + ' passed, ' + failed + ' failed ---');
process.exit(failed > 0 ? 1 : 0);
