// One brain for every input: Alexa voice, the website chat box and the phone app
// all send plain text here and get back the same result shape.
//
// Result: { command, speech, display, action }
//   speech  - what Alexa says (or the chat box shows)
//   display - short text for the Echo Dot clock display, e.g. "OK!"
//   action  - instruction pushed live to every open dashboard

const realtime = require('../realtime');
const youtube = require('../services/youtube');
const answers = require('../services/answers');
const todoHandlers = require('./todos');
const { getStore } = require('../store');

const NO_SCREEN = {
  speech: 'No screen is connected. Open your Jarvis website on a screen first.',
  display: 'NO SCRN',
};

const youtubeSearchUrl = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

async function playOnYouTube(query) {
  if (!(await realtime.screenCount())) return NO_SCREEN;
  let videos;
  try {
    videos = await youtube.searchVideos(query);
  } catch (err) {
    console.error(err.message);
    return { speech: "Sorry, YouTube didn't answer in time. Try again.", display: 'ERR' };
  }
  if (videos === null) {
    // No API key: fall back to YouTube's own search page in a new tab.
    return {
      speech: `Opening YouTube results for ${query}.`,
      display: 'YT ON',
      action: { type: 'open-url', url: youtubeSearchUrl(query) },
    };
  }
  if (!videos.length) return { speech: `I couldn't find anything on YouTube for ${query}.`, display: '?' };
  const [first] = videos;
  return {
    speech: `Playing ${first.title} on YouTube.`,
    display: 'YT ON',
    action: { type: 'youtube-play', video: first, results: videos },
  };
}

// Websites Jarvis can open in a new tab. Aliases cover how Alexa tends to hear each name.
const SITES = [
  { name: 'Google', aliases: ['chrome', 'google', 'google chrome', 'browser', 'the browser'], url: 'https://www.google.com', display: 'WEB' },
  { name: 'Claude', aliases: ['claude', 'cloud', 'claude ai', 'clod'], url: 'https://claude.ai/new', display: 'AI ON' },
  { name: 'WhatsApp', aliases: ['whatsapp', 'whats app', 'whatsapp web'], url: 'https://web.whatsapp.com', display: 'WA ON' },
  { name: 'VS Code', aliases: ['vs code', 'v s code', 'vscode', 'visual studio code', 'vs code dev', 'code editor'], url: 'https://vscode.dev', display: 'CODE' },
  { name: 'Gmail', aliases: ['gmail', 'my email', 'email', 'mail'], url: 'https://mail.google.com', display: 'MAIL' },
  { name: 'GitHub', aliases: ['github', 'git hub'], url: 'https://github.com', display: 'GIT' },
];

function findSite(spoken) {
  const name = spoken.replace(/^(the|my) /, '').replace(/ (app|website|site|tab)$/, '');
  return SITES.find((site) => site.aliases.includes(name) || site.aliases.includes(spoken));
}

async function openSite(site, url = site.url) {
  if (!(await realtime.screenCount())) return NO_SCREEN;
  return { speech: `Opening ${site.name}.`, display: site.display, action: { type: 'open-url', url } };
}

const googleSearchUrl = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

async function webSearch(query) {
  const hasScreen = (await realtime.screenCount()) > 0;
  const answer = await answers.quickAnswer(query);
  if (!hasScreen) {
    return answer ? { speech: answer, display: 'OK!' } : NO_SCREEN;
  }
  return {
    speech: answer ? `${answer} Full results are on your screen.` : `Here are the results for ${query} on your screen.`,
    display: 'WEB',
    action: { type: 'open-url', url: googleSearchUrl(query) },
  };
}

const handlers = [
  {
    name: 'hello',
    match: /^(hello|hi|hey|yo|good (morning|afternoon|evening))\b/,
    run: () => ({ speech: 'Hello! Jarvis is online and ready.', display: 'HI :)' }),
  },
  {
    name: 'help',
    match: /^(help|what can you do)\b/,
    run: () => ({
      speech:
        'Try: play lofi music, search for the weather in Lahore, open WhatsApp, or ask Claude a question. To-dos, alarms and calls are coming next.',
      display: 'HELP',
    }),
  },
  ...todoHandlers,
  {
    // Typed alarms can't reach the Echo: Amazon only lets a skill set reminders while you're talking to it.
    name: 'alarm-typed',
    match: /^(?:set (?:an |a )?(?:alarm|reminder)|wake me|remind me)\b/,
    run: ({ source }) => ({
      speech:
        source === 'alexa'
          ? 'Try saying: set an alarm for 7 AM, or remind me to drink water in 10 minutes.'
          : 'Alarms ring on your Echo, so set them by voice. Say: Alexa, ask Jarvis to set an alarm for 7 AM.',
      display: 'ALARM',
    }),
  },
  {
    name: 'youtube-stop',
    match: /^(stop|pause|close) (the )?(video|youtube|music)\b/,
    run: async () => {
      if (!(await realtime.screenCount())) return NO_SCREEN;
      return { speech: 'Stopped.', display: 'DONE', action: { type: 'youtube-stop' } };
    },
  },
  {
    name: 'youtube-play',
    // "play X", "play X on youtube", "search youtube for X", "youtube X"
    match: /^(?:play|put on|watch|search youtube for|youtube) (.+?)(?: (?:on|from|in) youtube)?$/,
    run: ({ match }) => playOnYouTube(match[1]),
  },
  {
    name: 'youtube-open',
    match: /^(open|show|launch|start) youtube$/,
    run: async () => {
      if (!(await realtime.screenCount())) return NO_SCREEN;
      return { speech: 'YouTube is open on your screen. What should I play?', display: 'YT ON', action: { type: 'youtube-open' } };
    },
  },
  {
    name: 'ask-claude',
    match: /^ask claude (?:to |about |if |whether )?(.+)$/,
    run: ({ match }) => openSite(findSite('claude'), `https://claude.ai/new?q=${encodeURIComponent(match[1])}`),
  },
  {
    name: 'open-site',
    match: /^(?:open|launch|start|show|go to)(?: up)? (.+)$/,
    run: ({ match }) => {
      const site = findSite(match[1]);
      if (site) return openSite(site);
      return { speech: `I don't know how to open ${match[1]} yet.`, display: '?' };
    },
  },
  {
    name: 'web-search',
    // "search (google) for X", "google X", "look up X"
    match: /^(?:search|google|look up)(?: on)?(?: google)?(?: for)? (.+)$/,
    run: ({ match }) => webSearch(match[1]),
  },
  {
    name: 'question',
    // Plain questions go to search as-is: "what is ...", "who was ...", "how far is ...".
    // Keep this last: it catches anything shaped like a question.
    match: /^(?:what|what's|whats|who|who's|when|where|why|how|which|is|are|does|do|can) .+$/,
    run: ({ match }) => webSearch(match[0]),
  },
];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/^(jarvis|please)[,\s]+/, '')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function runCommand(text, context = {}) {
  const clean = normalize(text);
  let result;
  if (!clean) {
    result = { command: null, speech: 'Sorry, I did not catch that.', display: '?' };
  } else {
    const h = handlers.find((handler) => handler.match.test(clean));
    result = h
      ? { command: h.name, ...(await h.run({ text: clean, match: clean.match(h.match), ...context })) }
      : { command: null, speech: `I heard "${clean}", but I don't know that command yet.`, display: '?' };
  }

  if (result.action) await realtime.sendToScreens(result.action);
  const entry = { text: clean, source: context.source, command: result.command, speech: result.speech, display: result.display, at: new Date() };
  // Awaited so serverless hosts don't freeze the function before these are saved.
  await Promise.all([
    realtime.sendResultToScreens({ ...entry, action: result.action }),
    getStore().history.add(entry),
  ]).catch((err) => console.error('Could not save result:', err.message));
  return result;
}

module.exports = { runCommand, normalize };
