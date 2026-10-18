const Alexa = require('ask-sdk-core');
const { runCommand } = require('../commands/router');
const { createReminder } = require('./reminders');
const { addDisplayText } = require('./display');

const REPROMPT = 'What should I do?';

// Video titles and spoken text can contain characters that break Alexa's SSML.
const escapeSsml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Speak the result and keep the session open so you can give another command.
function respond(handlerInput, result, { endSession = false } = {}) {
  addDisplayText(handlerInput, result.display);
  const builder = handlerInput.responseBuilder.speak(escapeSsml(result.speech));
  if (!endSession) builder.reprompt(REPROMPT);
  return builder.withShouldEndSession(endSession).getResponse();
}

const LaunchRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
  handle: (h) => respond(h, { speech: 'Jarvis here. What should I do?', display: 'HI :)' }),
};

const HelloIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'HelloIntent',
  handle: async (h) => respond(h, await runCommand('hello', { source: 'alexa' })),
};

// Catch-all: whatever you said goes to the command router as plain text.
const CommandIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'CommandIntent',
  handle: async (h) => {
    const text = Alexa.getSlotValue(h.requestEnvelope, 'phrase') || '';
    return respond(h, await runCommand(text, { source: 'alexa' }));
  },
};

const SetAlarmIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'SetAlarmIntent',
  handle: (h) => createReminder(h, 'alarm'),
};

const SetReminderIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'SetReminderIntent',
  handle: (h) => createReminder(h, 'reminder'),
};

const HelpIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.HelpIntent',
  handle: async (h) => respond(h, await runCommand('help', { source: 'alexa' })),
};

const StopIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    ['AMAZON.StopIntent', 'AMAZON.CancelIntent'].includes(Alexa.getIntentName(h.requestEnvelope)),
  handle: (h) => respond(h, { speech: 'Goodbye.', display: 'BYE' }, { endSession: true }),
};

const FallbackIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.FallbackIntent',
  handle: (h) => respond(h, { speech: "Sorry, I didn't get that. Try again." }),
};

const SessionEndedRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest',
  handle: (h) => h.responseBuilder.getResponse(),
};

const ErrorHandler = {
  canHandle: () => true,
  handle: (h, error) => {
    console.error('Alexa handler error:', error);
    return respond(h, { speech: 'Sorry, something went wrong on my server.' });
  },
};

function buildSkill(skillId) {
  const builder = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
      LaunchRequestHandler,
      HelloIntentHandler,
      CommandIntentHandler,
      SetAlarmIntentHandler,
      SetReminderIntentHandler,
      HelpIntentHandler,
      StopIntentHandler,
      FallbackIntentHandler,
      SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    // Needed for the Reminders and time zone APIs.
    .withApiClient(new Alexa.DefaultApiClient());
  if (skillId) builder.withSkillId(skillId);
  return builder.create();
}

module.exports = { buildSkill };
