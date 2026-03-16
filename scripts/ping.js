'use strict';
const https = require('https');

const req = https.get('https://api.counterapi.dev/v2/code-with-ahsan/claude-halal-code/up', (res) => {
  res.resume(); // drain to free socket
});
req.setTimeout(3000, () => req.destroy());
req.on('error', () => {});
