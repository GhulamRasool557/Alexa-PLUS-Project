const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');
const { connectStore, describeProblem } = require('../src/store');

test('/health says why the database is not in use', async () => {
  await connectStore();
  const server = createApp({ verifyAlexaSignature: false }).listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/health`).then((r) => r.json());
    assert.strictEqual(res.store, 'memory');
    assert.strictEqual(res.problem, 'MONGODB_URI is not set');
  } finally {
    server.close();
  }
});

test('connection errors become short reasons without the error text', () => {
  assert.match(describeProblem(new Error('bad auth : Authentication failed.')), /username or password/);
  assert.match(describeProblem(new Error("Could not connect to any servers in your MongoDB Atlas cluster. One common reason is that you're trying to access the database from an IP that isn't whitelisted.")), /Network Access/);
  assert.match(describeProblem(new Error('querySrv ENOTFOUND _mongodb._tcp.backend.example.net')), /reach MongoDB/);
  assert.match(describeProblem(new Error('Password contains unescaped characters')), /not a valid connection string/);
  assert.match(describeProblem(new Error('Invalid scheme, expected connection string to start with "mongodb://"')), /not a valid connection string/);
});
