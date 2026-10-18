const config = require('./config');
const { createApp } = require('./app');
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
  createApp().listen(config.port, () => {
    console.log(`Jarvis backend listening on port ${config.port}`);
  });
}

main();
