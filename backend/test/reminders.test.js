const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { createApp } = require('../src/app');
const { buildTrigger } = require('../src/alexa/reminders');

// A stand-in for Amazon's Alexa API (time zone + Reminders), so we can see what the skill sends.
let created = [];
const fakeAlexaApi = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url.includes('/settings/System.timeZone')) return res.end(JSON.stringify('Asia/Karachi'));
    if (req.url === '/v1/alerts/reminders' && req.method === 'POST') {
      created.push(JSON.parse(body));
      return res.end(JSON.stringify({ alertToken: 'token-1', status: 'ON' }));
    }
    res.statusCode = 404;
    res.end('{}');
  });
});

let server, base, apiEndpoint;
test.before(async () => {
  fakeAlexaApi.listen(0);
  await new Promise((r) => fakeAlexaApi.once('listening', r));
  apiEndpoint = `http://127.0.0.1:${fakeAlexaApi.address().port}`;
  server = createApp({ verifyAlexaSignature: false }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => {
  server.close();
  fakeAlexaApi.close();
});

function intentRequest(name, slots, { consent = true } = {}) {
  const user = { userId: 'u1', ...(consent && { permissions: { consentToken: 'consent' } }) };
  return {
    version: '1.0',
    session: { new: false, sessionId: 's1', application: { applicationId: 'test' }, user },
    context: { System: { application: { applicationId: 'test' }, user, device: { deviceId: 'd1', supportedInterfaces: {} }, apiEndpoint, apiAccessToken: 'token' } },
    request: {
      type: 'IntentRequest', requestId: 'r1', timestamp: new Date().toISOString(), locale: 'en-US',
      intent: { name, confirmationStatus: 'NONE', slots: Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, { name: k, value: v }])) },
    },
  };
}

const alexa = (body) =>
  fetch(base + '/alexa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

test('without permission, asks for it with a card in the Alexa app', async () => {
  const res = await alexa(intentRequest('SetAlarmIntent', { time: '07:00' }, { consent: false }));
  assert.strictEqual(res.response.card.type, 'AskForPermissionsConsent');
  assert.deepStrictEqual(res.response.card.permissions, ['alexa::alerts:reminders:skill:readwrite']);
});

test('"remind me to drink water in 10 minutes" creates a relative reminder', async () => {
  created = [];
  const res = await alexa(intentRequest('SetReminderIntent', { task: 'drink water', duration: 'PT10M' }));
  assert.match(res.response.outputSpeech.ssml, /remind you to drink water in 10 minutes/);
  assert.deepStrictEqual(created[0].trigger, { type: 'SCHEDULED_RELATIVE', offsetInSeconds: 600 });
  assert.strictEqual(created[0].alertInfo.spokenInfo.content[0].text, 'drink water');

  const reminders = await fetch(base + '/api/reminders').then((r) => r.json());
  assert.strictEqual(reminders.reminders.at(-1).text, 'drink water');
});

test('alarm with a time is set in the Echo\'s time zone', async () => {
  created = [];
  const res = await alexa(intentRequest('SetAlarmIntent', { time: '07:00' }));
  assert.match(res.response.outputSpeech.ssml, /Alarm set at 7 AM/);
  assert.strictEqual(created[0].trigger.type, 'SCHEDULED_ABSOLUTE');
  assert.strictEqual(created[0].trigger.timeZoneId, 'Asia/Karachi');
  assert.match(created[0].trigger.scheduledTime, /T07:00:00\.000$/);
});

test('missing time is asked for', async () => {
  const res = await alexa(intentRequest('SetReminderIntent', { task: 'call mom' }));
  assert.match(res.response.outputSpeech.ssml, /When should I remind you/);
  assert.strictEqual(res.response.directives[0].type, 'Dialog.ElicitSlot');
  assert.strictEqual(res.response.directives[0].slotToElicit, 'time');
});

test('a time that already passed today means tomorrow', () => {
  const now = new Date('2026-10-18T17:00:00Z'); // 10 PM in Karachi
  const built = buildTrigger({ time: '07:00', timeZone: 'Asia/Karachi', now });
  assert.strictEqual(built.trigger.scheduledTime, '2026-10-19T07:00:00.000');
  assert.strictEqual(built.at.toISOString(), '2026-10-19T02:00:00.000Z');
});
