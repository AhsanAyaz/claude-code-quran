'use strict';
const fs = require('fs');
const path = require('path');
const { loadAyah } = require('./lib/load-ayah');

/**
 * Resolve the plugin root using three strategies in priority order:
 * 1. CLAUDE_PLUGIN_ROOT env var (works for non-SessionStart hooks)
 * 2. ~/.claude/plugins/installed_plugins.json (marketplace installs)
 * 3. __dirname relative — scripts/ is one level below root (works for --plugin-dir)
 */
function resolvePluginRoot() {
  // Strategy 1: env var
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    try {
      fs.accessSync(process.env.CLAUDE_PLUGIN_ROOT);
      return process.env.CLAUDE_PLUGIN_ROOT;
    } catch (_) {}
  }
  // Strategy 2: installed_plugins.json (marketplace installs)
  try {
    const installFile = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.claude', 'plugins', 'installed_plugins.json'
    );
    const data = JSON.parse(fs.readFileSync(installFile, 'utf8'));
    const plugins = data.plugins || {};
    for (const [key, val] of Object.entries(plugins)) {
      if (key.includes('claude-code-quran') && val.installPath) {
        return val.installPath.replace(/\/$/, '');
      }
    }
  } catch (_) {}
  // Strategy 3: __dirname relative (works for --plugin-dir; scripts/ is one level below root)
  return path.resolve(__dirname, '..');
}

/**
 * Format an ayah object into the Phase 1 display block (CONTEXT.md LOCKED format).
 */
function formatAyah(ayah) {
  return [
    '',
    '------',
    ayah.arabic,
    ayah.transliteration,
    '"' + ayah.translation + '"',
    '\u2014 ' + ayah.surah_name + ' ' + ayah.surah_number + ':' + ayah.ayah_number,
    '------',
    ''
  ].join('\n');
}

function main() {
  const pluginRoot = resolvePluginRoot();
  const ayah = loadAyah(pluginRoot, 'ilm');
  if (!ayah) {
    // DATA-05: silent failure — empty systemMessage, exit 0
    process.stdout.write(JSON.stringify({ systemMessage: '' }));
    process.exit(0);
  }
  const displayText = formatAyah(ayah);
  process.stdout.write(JSON.stringify({ systemMessage: displayText }));
  process.exit(0);
}

try {
  main();
} catch (_) {
  // DATA-05: any unhandled error — silent exit
  process.stdout.write(JSON.stringify({ systemMessage: '' }));
  process.exit(0);
}
