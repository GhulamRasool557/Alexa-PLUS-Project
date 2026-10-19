const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

function alexaRequest(request, supportedInterfaces = {}) {
  return {
    version: '1.0',
    session: { new: true, sessionId: 's1', application: { applicationId: 'test-skill' }, user: { userId: 'u1' } },
    context: { System: { application: { applicationId: 'test-skill' }, user: { userId: 'u1' }, device: { deviceId: 'd1', supportedInterfaces } } },
    request: { requestId: 'r1', timestamp: new Date().toISOString(), locale: 'en-US', ...request },
  };
}

let server, base;
test.before(async () => {
  server = createApp({ verifyAlexaSignature: false }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

async function post(path, body, headers = {}) {
  const res = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

test('launch greets and listens once without a reprompt', async () => {
  const { body } = await post('/alexa', alexaRequest({ type: 'LaunchRequest' }));
  assert.match(body.response.outputSpeech.ssml, /Jarvis here/);
  assert.strictEqual(body.response.shouldEndSession, false);
  assert.strictEqual(body.response.reprompt, undefined);
});

test('HelloIntent says hello', async () => {
  const { body } = await post('/alexa', alexaRequest({ type: 'IntentRequest', intent: { name: 'HelloIntent', slots: {} } }));
  assert.match(body.response.outputSpeech.ssml, /Jarvis is online/);
});

test('catch-all CommandIntent routes spoken text', async () => {
  const intent = { name: 'CommandIntent', slots: { phrase: { name: 'phrase', value: 'hello there' } } };
  const { body } = await post('/alexa', alexaRequest({ type: 'IntentRequest', intent }));
  assert.match(body.response.outputSpeech.ssml, /Jarvis is online/);
  assert.strictEqual(body.response.shouldEndSession, true);
  assert.strictEqual(body.response.reprompt, undefined);
});

test('stop ends the session', async () => {
  const { body } = await post('/alexa', alexaRequest({ type: 'IntentRequest', intent: { name: 'AMAZON.StopIntent' } }));
  assert.strictEqual(body.response.shouldEndSession, true);
});

test('text command endpoint uses the same router', async () => {
  const { status, body } = await post('/api/command', { text: 'Jarvis, hello!' });
  assert.strictEqual(status, 200);
  assert.strictEqual(body.command, 'hello');
  assert.strictEqual(body.display, 'HI :)');
});

test('unknown commands are echoed back', async () => {
  const { body } = await post('/api/command', { text: 'fly to the moon' });
  assert.strictEqual(body.command, null);
  assert.match(body.speech, /fly to the moon/);
});

test('alexa endpoint rejects unsigned requests when verification is on', async () => {
  const strict = createApp({ verifyAlexaSignature: true }).listen(0);
  await new Promise((r) => strict.once('listening', r));
  const res = await fetch(`http://127.0.0.1:${strict.address().port}/alexa`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(alexaRequest({ type: 'LaunchRequest' })),
  });
  strict.close();
  assert.strictEqual(res.status, 400);
});


test('Echo Dot with clock gets short display text', async () => {
  const req = alexaRequest({ type: 'IntentRequest', intent: { name: 'HelloIntent', slots: {} } }, { 'Alexa.Presentation.APLT': { runtime: { maxVersion: '1.0' } } });
  const { body } = await post('/alexa', req);
  const directive = body.response.directives[0];
  assert.strictEqual(directive.type, 'Alexa.Presentation.APLT.RenderDocument');
  assert.strictEqual(directive.targetProfile, 'FOUR_CHARACTER_CLOCK');
  assert.strictEqual(directive.datasources.jarvis.text, 'HI :)');
});

test('devices without a display get no display directive', async () => {
  const { body } = await post('/alexa', alexaRequest({ type: 'IntentRequest', intent: { name: 'HelloIntent', slots: {} } }));
  assert.strictEqual(body.response.directives, undefined);
});
