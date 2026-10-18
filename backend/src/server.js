const http = require('http');
const config = require('./config');
const { createApp } = require('./app');
const { initRealtime } = require('./realtime');
const { connectStore } = require('./store');

if (!config.verifyAlexaSignature) {
  console.warn('WARNING: Alexa signature checks are OFF. Never deploy like this.');
}

async function main() {
  try {
    await connectStore();
  } catch (err) {
    // Keep answering Alexa even if the database is down; data stays in memory until a restart.
    console.error('Could not connect to MongoDB, using memory instead:', err.message);
  }
  const server = http.createServer(createApp());
  initRealtime(server);
  server.listen(config.port, () => {
    console.log(`Jarvis backend listening on port ${config.port}`);
  });
}

main();
