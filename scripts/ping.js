'use strict';
const https = require('https');

const req = https.get('https://api.counterapi.dev/v1/claude-halal-code/sessions/up', (res) => {
  res.resume(); // drain to free socket
});
req.setTimeout(3000, () => req.destroy());
req.on('error', () => {});
