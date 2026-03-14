'use strict';
const fs = require('fs');

// Test 1: process.stderr
process.stderr.write('[MECHANISM TEST] stderr: if you see this line, stderr is visible\n');

// Test 2: /dev/tty
try {
  fs.writeFileSync('/dev/tty', '[MECHANISM TEST] /dev/tty: if you see this line, /dev/tty is visible\n');
} catch (e) {
  process.stderr.write('[MECHANISM TEST] /dev/tty: FAILED (' + e.code + ')\n');
}

// Test 3+4: stdout — systemMessage JSON (the confirmed working channel)
// Raw stdout text is NOT tested separately to avoid corrupting the JSON parse
process.stdout.write(JSON.stringify({
  systemMessage: [
    '',
    '[MECHANISM TEST] systemMessage: if you see this, systemMessage JSON is working.',
    '[MECHANISM TEST] This is the confirmed output channel for Phase 1.',
    ''
  ].join('\n')
}));
process.exit(0);
