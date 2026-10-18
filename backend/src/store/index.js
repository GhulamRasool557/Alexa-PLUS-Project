const config = require('../config');
const { createMemoryStore } = require('./memory');

// Starts as in-memory so the app works before the database connects (and in tests).
let store = createMemoryStore();

let connecting = null;
let problem = null;

// A short reason the database isn't in use, safe to show on /health (never the error text itself).
function describeProblem(err) {
  const text = String(err && err.message);
  if (/auth/i.test(text)) return 'MongoDB rejected the username or password';
  if (/whitelist|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|timed out|Server selection/i.test(text)) return 'Could not reach MongoDB; check Network Access allows 0.0.0.0/0';
  if (/URI|scheme|parse|unescaped/i.test(text)) return 'MONGODB_URI is not a valid connection string';
  return 'Could not connect to MongoDB';
}

// Safe to call on every request (serverless): connects once and reuses it.
function connectStore() {
  if (!connecting) {
    connecting = connect().catch((err) => {
      connecting = null;
      problem = describeProblem(err);
      throw err;
    });
  }
  return connecting;
}

async function connect() {
  if (!config.mongodbUri) {
    console.warn('MONGODB_URI is not set: to-dos and history are kept in memory and lost on restart.');
    problem = 'MONGODB_URI is not set';
    return store;
  }
  const { createMongoStore } = require('./mongo');
  store = await createMongoStore(config.mongodbUri);
  problem = null;
  return store;
}

module.exports = { connectStore, getStore: () => store, getStoreProblem: () => problem, describeProblem };
