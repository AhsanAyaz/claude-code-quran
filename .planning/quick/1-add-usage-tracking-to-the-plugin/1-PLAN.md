---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/ping.js
  - scripts/session-start.js
  - README.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Each session start fires a silent, non-blocking ping to a counter endpoint"
    - "The ping never delays or breaks the hook — session-start.js exits immediately as before"
    - "No PII is transmitted — the ping is anonymous (no user ID, no machine ID, no session ID)"
    - "A README badge reflects the live session count"
  artifacts:
    - path: "scripts/ping.js"
      provides: "Standalone pinger script run in detached child process"
    - path: "scripts/session-start.js"
      provides: "Spawns ping.js detached before writing systemMessage to stdout"
  key_links:
    - from: "scripts/session-start.js"
      to: "scripts/ping.js"
      via: "child_process.spawn detached + unref()"
      pattern: "spawn.*ping\\.js"
---

<objective>
Add lightweight, anonymous usage tracking so the number of active installs/sessions can be observed.

Purpose: The plugin is distributed via marketplace with no server side. A fire-and-forget ping on each SessionStart gives a real signal of usage without collecting PII, without adding dependencies, and without slowing down the hook.

Output: scripts/ping.js (pinger), updated scripts/session-start.js (spawns pinger), README badge.
</objective>

<execution_context>
@/Users/amu1o5/.claude/get-shit-done/workflows/execute-plan.md
@/Users/amu1o5/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key constraints from project decisions:
- CommonJS only (require(), not import)
- session-start.js MUST write JSON to stdout and call process.exit(0) — no async operations in main flow
- NEVER use console.log in hook scripts (would corrupt the JSON stdout channel)
- Zero new npm dependencies — use Node built-ins only

Counter endpoint strategy:
Use https://counterapi.dev — free, no account, no auth.
Endpoint: GET https://api.counterapi.dev/v1/claude-halal-code/sessions/up
Returns JSON { count: N }. The count value can be read via the API or displayed via a shields.io badge.

Badge URL (shields.io dynamic):
https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.counterapi.dev%2Fv1%2Fclaude-halal-code%2Fsessions&query=count&label=sessions&color=green
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create scripts/ping.js — standalone anonymous counter pinger</name>
  <files>scripts/ping.js</files>
  <action>
Create `scripts/ping.js` as a standalone CommonJS script that fires one HTTPS GET to the counter API and exits silently. It must:

1. Use Node built-in `https` module only — no require of chalk or any project lib
2. Make a GET request to: `https://api.counterapi.dev/v1/claude-halal-code/sessions/up`
3. Consume and discard the response body (attach `res.resume()` to drain it)
4. On any error (network down, timeout, DNS failure) — catch silently and exit 0
5. Set a 3000ms timeout on the request via `req.setTimeout(3000, () => req.destroy())`
6. Exit 0 in all paths

Structure:
```js
'use strict';
const https = require('https');

const req = https.get('https://api.counterapi.dev/v1/claude-halal-code/sessions/up', (res) => {
  res.resume(); // drain to free socket
});
req.setTimeout(3000, () => req.destroy());
req.on('error', () => {});
```

That's the entire file. Short, single-purpose, bulletproof.
  </action>
  <verify>
    node /Users/amu1o5/personal/claude-halal-code/scripts/ping.js && echo "exit 0"
    # Must exit cleanly. Also verify no stdout output (would corrupt JSON channel if imported):
    output=$(node /Users/amu1o5/personal/claude-halal-code/scripts/ping.js); [ -z "$output" ] && echo "no stdout — ok"
  </verify>
  <done>scripts/ping.js exists, exits 0, produces no stdout, tolerates network failure silently</done>
</task>

<task type="auto">
  <name>Task 2: Wire ping into session-start.js and add README badge</name>
  <files>scripts/session-start.js, README.md</files>
  <action>
**In scripts/session-start.js:**

Add a fire-and-forget spawn of ping.js at the top of `main()`, before the `selectAyah` call. Use `child_process.spawn` with `detached: true` and call `.unref()` so the parent process is not held open.

Add at top of file (after existing requires):
```js
const { spawn } = require('child_process');
```

Add as first line of `main()`:
```js
// Fire-and-forget usage ping — detached so it never delays exit
try {
  const pinger = spawn(process.execPath, [path.join(__dirname, 'ping.js')], {
    detached: true,
    stdio: 'ignore',
  });
  pinger.unref();
} catch (_) {}
```

Do NOT move, change, or remove any other code. The rest of main() stays identical.

**In README.md:**

Add a "Sessions" badge in the header section, after the existing badges (or create a badges row if none exists). Place it just below the `<h1>` or under the crescent SVG block:

```markdown
[![Sessions](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.counterapi.dev%2Fv1%2Fclaude-halal-code%2Fsessions&query=count&label=sessions%20tracked&color=green)](https://api.counterapi.dev/v1/claude-halal-code/sessions)
```

This badge displays the live counter value from counterapi.dev.
  </action>
  <verify>
    # Verify session-start.js still produces valid JSON on stdout (core contract):
    output=$(node /Users/amu1o5/personal/claude-halal-code/scripts/session-start.js 2>/dev/null)
    echo "$output" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); JSON.parse(d); console.log('valid JSON')"
    # Verify spawn line is present:
    grep -n "pinger" /Users/amu1o5/personal/claude-halal-code/scripts/session-start.js
    # Verify badge in README:
    grep -n "counterapi" /Users/amu1o5/personal/claude-halal-code/README.md
  </verify>
  <done>
    - session-start.js still outputs valid JSON systemMessage to stdout
    - spawn + unref pattern present in main()
    - README has counterapi.dev badge
    - No console.log added anywhere in session-start.js
  </done>
</task>

</tasks>

<verification>
Full integration check:

1. Run session-start.js and confirm JSON output is valid and unchanged in structure:
   `node scripts/session-start.js | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const o=JSON.parse(d); console.log(Object.keys(o))"`
   Expected: `[ 'systemMessage' ]`

2. Confirm ping.js exits cleanly with no stdout:
   `node scripts/ping.js; echo "exit: $?"`

3. Check counterapi.dev counter incremented (manual):
   `curl -s https://api.counterapi.dev/v1/claude-halal-code/sessions | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d))"`
</verification>

<success_criteria>
- Each session start fires an anonymous ping to counterapi.dev
- The hook exits at normal speed — no blocking on network I/O
- Zero new npm packages added
- README badge shows live session count
- No PII transmitted (no user ID, no session ID, no IP address stored beyond what counterapi.dev logs by default)
</success_criteria>

<output>
After completion, create `.planning/quick/1-add-usage-tracking-to-the-plugin/1-SUMMARY.md`
</output>
