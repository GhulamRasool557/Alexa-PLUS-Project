const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { io: connect } = require('socket.io-client');
const { createApp } = require('../src/app');
const { initRealtime } = require('../src/realtime');
const answers = require('../src/services/answers');

let server, base, screen;
test.before(async () => {
  server = http.createServer(createApp({ verifyAlexaSignature: false }));
  initRealtime(server);
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  screen = connect(base, { transports: ['websocket'] });
  await new Promise((r) => screen.once('connect', r));
});
test.after(() => {
  screen.close();
  server.close();
});

const command = (text) =>
  fetch(base + '/api/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) })
    .then((r) => r.json());

for (const [said, url] of [
  ['open chrome', 'https://www.google.com'],
  ['open Claude', 'https://claude.ai/new'],
  ['open the WhatsApp app', 'https://web.whatsapp.com'],
  ['launch VS Code', 'https://vscode.dev'],
  ['open visual studio code', 'https://vscode.dev'],
]) {
  test(`"${said}" opens ${url}`, async () => {
    const res = await command(said);
    assert.deepStrictEqual(res.action, { type: 'open-url', url });
  });
}

test('unknown sites are not opened', async () => {
  const res = await command('open netflix');
  assert.strictEqual(res.action, undefined);
  assert.match(res.speech, /don't know how to open netflix/);
});

test('ask claude opens Claude with the question filled in', async () => {
  const res = await command('ask Claude to write a poem about rain');
  assert.strictEqual(res.action.url, 'https://claude.ai/new?q=write%20a%20poem%20about%20rain');
});

test('search speaks a short answer and opens Google results', async (t) => {
  t.mock.method(answers, 'quickAnswer', async (q) => {
    assert.strictEqual(q, 'weather in lahore');
    return 'Lahore is sunny today.';
  });
  const res = await command('search for weather in Lahore');
  assert.strictEqual(res.speech, 'Lahore is sunny today. Full results are on your screen.');
  assert.strictEqual(res.action.url, 'https://www.google.com/search?q=weather%20in%20lahore');
});

test('questions go to search as-is, even with no answer found', async (t) => {
  t.mock.method(answers, 'quickAnswer', async () => null);
  const res = await command('who won the cricket match');
  assert.strictEqual(res.command, 'question');
  assert.match(res.speech, /results for who won the cricket match/);
});

test('"search youtube for" still goes to YouTube', async () => {
  assert.strictEqual((await command('search youtube for cats')).command, 'youtube-play');
});

test('answers are cut to a sentence or two for Alexa', () => {
  const long = 'Islamabad is the capital city of Pakistan. ' + 'It is a planned city built in the 1960s. '.repeat(10);
  const short = answers.shorten(long);
  assert.ok(short.length <= 220);
  assert.ok(short.startsWith('Islamabad is the capital city of Pakistan.'));
});
