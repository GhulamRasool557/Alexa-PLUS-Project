// Short text on the Echo Dot's clock display ("YT ON", "DONE", ":)") using APL-T.
// Only sent to devices that report a character display.
const Alexa = require('ask-sdk-core');

const APLT = 'Alexa.Presentation.APLT';

const DOCUMENT = {
  type: 'APLT',
  version: '1.0',
  mainTemplate: {
    parameters: ['payload'],
    item: { type: 'Text', id: 'jarvisText', text: '${payload.jarvis.text}' },
  },
};

function hasCharacterDisplay(handlerInput) {
  const interfaces = Alexa.getSupportedInterfaces(handlerInput.requestEnvelope) || {};
  return Boolean(interfaces[APLT]);
}

// The clock shows about 4 characters at once; longer text scrolls.
function addDisplayText(handlerInput, text) {
  if (!text || !hasCharacterDisplay(handlerInput)) return;
  handlerInput.responseBuilder.addDirective({
    type: `${APLT}.RenderDocument`,
    token: 'jarvis-display',
    targetProfile: 'FOUR_CHARACTER_CLOCK',
    document: DOCUMENT,
    datasources: { jarvis: { text: String(text).toUpperCase().slice(0, 32) } },
  });
}

module.exports = { addDisplayText };
