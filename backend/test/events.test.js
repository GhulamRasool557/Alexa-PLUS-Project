const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');
const { fakeScreen } = require('./helpers');

let server, base;
test.before(async () => {
  server = createApp({ verifyAlexaSignature: false }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const command = (text) =>
  fetch(base + '/api/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) })
    .then((r) => r.json());

test('a screen counts as connected once it polls', async () => {
  assert.strictEqual((await command('open whatsapp')).display, 'NO SCRN');
  await fakeScreen(base).connect();
  assert.strictEqual((await command('open whatsapp')).display, 'WA ON');
});

test('dashboards receive results and list changes', async () => {
  const screen = fakeScreen(base, 'second-screen');
  await screen.connect();
  await command('add buy milk to my list');
  assert.strictEqual(await screen.next('changed'), 'todos');
  await command('hello');
  assert.strictEqual((await screen.next('result')).command, 'hello');
});

test('a poll without a valid "since" returns no old events', async () => {
  const res = await fetch(`${base}/api/events?screen=x`).then((r) => r.json());
  assert.deepStrictEqual(res.events, []);
  assert.ok(res.now);
});
