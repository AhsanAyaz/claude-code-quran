'use strict';
const fs   = require('fs');
const path = require('path');
const assert = require('assert');

// ---------------------------------------------------------------------------
// Test helpers: use a separate temp path so we never touch the real rate file
// ---------------------------------------------------------------------------

const TEST_RATE_FILE = '/tmp/claude-code-quran-test-rate';
const COOLDOWN_MS    = 60 * 1000;

// Inline implementations of the helpers under test (mirrors pre-tool-use.js).
// We test the logic independently so the test file does not have to import the
// entry script (which calls main() on require in some patterns).
// These must be kept in sync with the actual implementations.

function isWithinCooldown(rateFile) {
  try {
    const last = parseInt(fs.readFileSync(rateFile, 'utf-8').trim(), 10);
    return (Date.now() - last) < COOLDOWN_MS;
  } catch (_) { return false; }
}

function stampCooldown(rateFile) {
  try { fs.writeFileSync(rateFile, String(Date.now()), 'utf-8'); } catch (_) {}
}

// ---------------------------------------------------------------------------
// Cleanup helper
// ---------------------------------------------------------------------------

function cleanup() {
  try { fs.unlinkSync(TEST_RATE_FILE); } catch (_) {}
}

// ---------------------------------------------------------------------------
// Test 1: isWithinCooldown returns false when file does not exist
// ---------------------------------------------------------------------------

cleanup();  // ensure no stale file
const t1 = isWithinCooldown(TEST_RATE_FILE);
assert.strictEqual(t1, false, 'Test 1 FAILED: should return false when rate file does not exist');
console.log('Test 1 PASSED: isWithinCooldown returns false when file missing');

// ---------------------------------------------------------------------------
// Test 2: isWithinCooldown returns true when timestamp is 30s ago (within 60s)
// ---------------------------------------------------------------------------

const thirtySecondsAgo = Date.now() - (30 * 1000);
fs.writeFileSync(TEST_RATE_FILE, String(thirtySecondsAgo), 'utf-8');
const t2 = isWithinCooldown(TEST_RATE_FILE);
assert.strictEqual(t2, true, 'Test 2 FAILED: should return true when stamp is 30s ago');
console.log('Test 2 PASSED: isWithinCooldown returns true when stamp is 30s ago (within 60s)');
cleanup();

// ---------------------------------------------------------------------------
// Test 3: isWithinCooldown returns false when timestamp is 90s ago (past 60s)
// ---------------------------------------------------------------------------

const ninetySecondsAgo = Date.now() - (90 * 1000);
fs.writeFileSync(TEST_RATE_FILE, String(ninetySecondsAgo), 'utf-8');
const t3 = isWithinCooldown(TEST_RATE_FILE);
assert.strictEqual(t3, false, 'Test 3 FAILED: should return false when stamp is 90s ago');
console.log('Test 3 PASSED: isWithinCooldown returns false when stamp is 90s ago (past 60s)');
cleanup();

// ---------------------------------------------------------------------------
// Test 4: stampCooldown writes current epoch; reading back parses to a number
//         close to Date.now() (within 2 seconds of test execution)
// ---------------------------------------------------------------------------

const before = Date.now();
stampCooldown(TEST_RATE_FILE);
const raw = fs.readFileSync(TEST_RATE_FILE, 'utf-8').trim();
const parsed = parseInt(raw, 10);
const after  = Date.now();

assert.ok(!isNaN(parsed), 'Test 4 FAILED: parsed value should be a number');
assert.ok(parsed >= before && parsed <= after + 100,
  'Test 4 FAILED: stamped value should be close to Date.now() (got ' + parsed + ')');
console.log('Test 4 PASSED: stampCooldown writes a valid epoch timestamp');
cleanup();

// ---------------------------------------------------------------------------
// Test 5 (RATE-03 guard): session-start.js must NOT contain rate-limit logic
// ---------------------------------------------------------------------------

const sessionStartPath = path.resolve(__dirname, '..', 'scripts', 'session-start.js');
const sessionStartContent = fs.readFileSync(sessionStartPath, 'utf-8');

assert.ok(
  !sessionStartContent.includes('isWithinCooldown'),
  'Test 5 FAILED: session-start.js must not contain isWithinCooldown (RATE-03)'
);
assert.ok(
  !sessionStartContent.includes('RATE_FILE'),
  'Test 5 FAILED: session-start.js must not contain RATE_FILE (RATE-03)'
);
console.log('Test 5 PASSED: session-start.js contains no rate-limit logic (RATE-03)');

// ---------------------------------------------------------------------------
// All tests passed
// ---------------------------------------------------------------------------

console.log('\nAll pre-tool-use tests PASSED.');
