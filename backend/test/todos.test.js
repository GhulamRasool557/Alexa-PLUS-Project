const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

let server, base;
test.before(async () => {
  server = createApp({ verifyAlexaSignature: false }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const call = (path, body) =>
  fetch(base + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}).then((r) => r.json());
const say = (text) => call('/api/command', { text });

test('add, read back, tick off and clear to-dos by voice or text', async () => {
  assert.strictEqual((await say('add buy milk to my to-do list')).speech, 'Added buy milk to your to-do list.');
  await say('put call the bank on my list');
  await say('add a to do pay rent');
  assert.strictEqual((await say("what's on my to do list")).speech, 'You have 3 things to do: buy milk, call the bank and pay rent.');

  assert.strictEqual((await say('remove number 2')).speech, 'Done. Removed call the bank.');
  assert.strictEqual((await say('mark buy milk as done')).speech, 'Done. Removed buy milk.');
  assert.match((await say('remove bananas from my list')).speech, /couldn't find bananas/);

  assert.strictEqual((await say('clear my to do list')).speech, 'Cleared 1 item.');
  assert.strictEqual((await say('read my list')).speech, 'Your to-do list is empty.');
});

test('dashboard can add and complete to-dos directly', async () => {
  const { todo } = await call('/api/todos', { text: 'water plants' });
  assert.deepStrictEqual((await call('/api/todos')).todos.map((t) => t.text), ['water plants']);
  await call(`/api/todos/${todo.id}/done`, {});
  assert.deepStrictEqual((await call('/api/todos')).todos, []);
});

test('commands are saved to history', async () => {
  await say('hello');
  const { history } = await call('/api/history');
  assert.strictEqual(history.at(-1).command, 'hello');
});

test('typed alarms explain they must be set by voice', async () => {
  assert.match((await say('set an alarm for 7 am')).speech, /set them by voice/);
});
