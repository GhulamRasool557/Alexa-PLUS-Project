// Alarms and reminders that ring on the Echo itself, via the Alexa Reminders API.
// Times come from Alexa's built-in TIME / DATE / DURATION slots, already parsed.
const Alexa = require('ask-sdk-core');
const { getStore } = require('../store');
const realtime = require('../realtime');
const { addDisplayText } = require('./display');

const PERMISSION = 'alexa::alerts:reminders:skill:readwrite';
// Alexa sends these for vague times like "tonight".
const VAGUE_TIMES = { MO: '09:00', AF: '14:00', EV: '19:00', NI: '21:00' };

// ISO 8601 duration ("PT10M", "P1DT2H") to seconds.
function durationToSeconds(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso || '');
  if (!m) return null;
  const [d, h, min, s] = m.slice(1).map((x) => Number(x || 0));
  const total = d * 86400 + h * 3600 + min * 60 + s;
  return total > 0 ? total : null;
}

// Current date and time on the Echo's clock, as "YYYY-MM-DD" and "HH:mm".
function localNow(timeZone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Turn slot values into a reminder trigger. Returns { trigger, at } or { error }.
function buildTrigger({ time, date, duration, timeZone, now = new Date() }) {
  const seconds = durationToSeconds(duration);
  if (seconds) {
    return { trigger: { type: 'SCHEDULED_RELATIVE', offsetInSeconds: seconds }, at: new Date(now.getTime() + seconds * 1000) };
  }
  if (!time) return { error: 'For what time?' };
  const hhmm = VAGUE_TIMES[time] || time;
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return { error: "Sorry, I didn't understand that time." };

  const today = localNow(timeZone, now);
  let day = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : today.date;
  // "7 am" with no date means the next 7 am.
  if (!date && hhmm <= today.time) day = addDays(day, 1);

  const scheduledTime = `${day}T${hhmm}:00.000`;
  return {
    trigger: { type: 'SCHEDULED_ABSOLUTE', scheduledTime, timeZoneId: timeZone },
    at: zonedToDate(day, hhmm, timeZone),
    day,
    hhmm,
  };
}

// The real instant for a wall-clock time in a time zone (good enough for display).
function zonedToDate(day, hhmm, timeZone) {
  const asUtc = new Date(`${day}T${hhmm}:00Z`);
  const shown = localNow(timeZone, asUtc);
  const shownUtc = new Date(`${shown.date}T${shown.time}:00Z`);
  return new Date(asUtc.getTime() - (shownUtc - asUtc));
}

function describe(built, timeZone, now = new Date()) {
  if (built.trigger.type === 'SCHEDULED_RELATIVE') {
    const mins = Math.round(built.trigger.offsetInSeconds / 60);
    if (mins < 60) return `in ${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
    const hours = Math.round((mins / 60) * 10) / 10;
    return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  const [h, m] = built.hhmm.split(':').map(Number);
  const clock = `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
  const today = localNow(timeZone, now).date;
  if (built.day === today) return `at ${clock} today`;
  if (built.day === addDays(today, 1)) return `at ${clock} tomorrow`;
  return `at ${clock} on <say-as interpret-as="date">${built.day}</say-as>`;
}

async function deviceTimeZone(handlerInput) {
  try {
    const deviceId = Alexa.getDeviceId(handlerInput.requestEnvelope);
    return await handlerInput.serviceClientFactory.getUpsServiceClient().getSystemTimeZone(deviceId);
  } catch {
    return process.env.DEFAULT_TIMEZONE || 'Asia/Karachi';
  }
}

function askForPermission(handlerInput) {
  return handlerInput.responseBuilder
    .speak('To set alarms and reminders, I need your permission. I sent a card to your Alexa app. Allow reminders there, then ask me again.')
    .withAskForPermissionsConsentCard([PERMISSION])
    .withShouldEndSession(true)
    .getResponse();
}

// kind: "alarm" or "reminder". Returns an Alexa response.
async function createReminder(handlerInput, kind) {
  const { requestEnvelope, responseBuilder } = handlerInput;
  const permissions = requestEnvelope.context.System.user.permissions;
  if (!permissions || !permissions.consentToken) return askForPermission(handlerInput);

  const slot = (name) => Alexa.getSlotValue(requestEnvelope, name);
  const task = kind === 'alarm' ? 'Wake up! This is your Jarvis alarm.' : slot('task');
  // Missing pieces are asked for, and Alexa sends the answer back to this same intent.
  const intent = requestEnvelope.request.intent;
  if (kind === 'reminder' && !task) {
    const q = 'What should I remind you about?';
    return responseBuilder.speak(q).reprompt(q).addElicitSlotDirective('task', intent).getResponse();
  }
  if (!slot('time') && !slot('duration')) {
    const q = kind === 'alarm' ? 'For what time?' : 'When should I remind you?';
    return responseBuilder.speak(q).reprompt(q).addElicitSlotDirective('time', intent).getResponse();
  }

  const timeZone = await deviceTimeZone(handlerInput);
  const built = buildTrigger({ time: slot('time'), date: slot('date'), duration: slot('duration'), timeZone });
  if (built.error) return responseBuilder.speak(built.error).reprompt(built.error).addElicitSlotDirective('time', intent).getResponse();

  const reminder = {
    requestTime: new Date().toISOString(),
    trigger: built.trigger,
    alertInfo: { spokenInfo: { content: [{ locale: Alexa.getLocale(requestEnvelope) || 'en-US', text: task }] } },
    pushNotification: { status: 'ENABLED' },
  };

  try {
    const client = handlerInput.serviceClientFactory.getReminderManagementServiceClient();
    const created = await client.createReminder(reminder);
    await getStore().reminders.add({ kind, text: task, at: built.at, alexaAlertToken: created.alertToken });
    realtime.notifyChanged('reminders');
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) return askForPermission(handlerInput);
    console.error('Reminder failed:', err.message);
    return responseBuilder.speak("Sorry, I couldn't set that. Try again.").reprompt('What should I do?').getResponse();
  }

  const when = describe(built, timeZone);
  const speech = kind === 'alarm' ? `Alarm set ${when}.` : `Okay, I'll remind you to ${escape(task)} ${when}.`;
  realtime.sendResultToScreens({ text: kind, source: 'alexa', command: kind, speech: speech.replace(/<[^>]+>/g, ''), display: 'SET', at: new Date() });
  addDisplayText(handlerInput, 'SET');
  return responseBuilder.speak(speech).reprompt('Anything else?').withShouldEndSession(false).getResponse();
}

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = { createReminder, buildTrigger, durationToSeconds, describe, PERMISSION };
