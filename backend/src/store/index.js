const config = require('../config');
const { createMemoryStore } = require('./memory');

// Starts as in-memory so the app works before the database connects (and in tests).
let store = createMemoryStore();

let connecting = null;

// Safe to call on every request (serverless): connects once and reuses it.
function connectStore() {
  if (!connecting) {
    connecting = connect().catch((err) => {
      connecting = null;
      throw err;
    });
  }
  return connecting;
}

async function connect() {
  if (!config.mongodbUri) {
    console.warn('MONGODB_URI is not set: to-dos and history are kept in memory and lost on restart.');
    return store;
  }
  const { createMongoStore } = require('./mongo');
  store = await createMongoStore(config.mongodbUri);
  return store;
}

module.exports = { connectStore, getStore: () => store };
