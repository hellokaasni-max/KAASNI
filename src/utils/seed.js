// src/utils/seed.js
// Manual entry point: `npm run seed`
// The same bootstrap logic also runs automatically every time the server
// starts, so this is only needed if you want to trigger it without booting
// the full server.
const { runBootstrap } = require('./bootstrap');
runBootstrap();
console.log('[seed] Done.');
