const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');
const { fakeScreen } = require('./helpers');
const youtube = require('../src/services/youtube');

const VIDEO = { videoId: 'abc123', title: 'Lofi Beats', channel: 'Lofi Girl' };

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

async function withScreen(fn) {
  const screen = fakeScreen(base);
  await screen.connect();
  return fn(screen);
}

test('without a screen, Jarvis says to open the website', async () => {
  const res = await command('play lofi music');
  assert.strictEqual(res.command, 'youtube-play');
  assert.strictEqual(res.display, 'NO SCRN');
});

test('play X searches YouTube and pushes the video to the screen', async (t) => {
  t.mock.method(youtube, 'searchVideos', async (q) => {
    assert.strictEqual(q, 'lofi music');
    return [VIDEO];
  });
  await withScreen(async (screen) => {
    const res = await command('Jarvis, play lofi music on YouTube');
    assert.strictEqual(res.speech, 'Playing Lofi Beats on YouTube.');
    assert.strictEqual(res.display, 'YT ON');
    const action = await screen.next('action');
    assert.strictEqual(action.type, 'youtube-play');
    assert.strictEqual(action.video.videoId, 'abc123');
  });
});

test('with no YouTube API key, falls back to opening YouTube search', async (t) => {
  t.mock.method(youtube, 'searchVideos', async () => null);
  await withScreen(async () => {
    const res = await command('play atif aslam songs');
    assert.deepStrictEqual(res.action, { type: 'open-url', url: 'https://www.youtube.com/results?search_query=atif%20aslam%20songs' });
  });
});

test('open youtube and stop the video', async () => {
  await withScreen(async () => {
    assert.strictEqual((await command('open youtube')).action.type, 'youtube-open');
    assert.strictEqual((await command('stop the video')).action.type, 'youtube-stop');
  });
});
