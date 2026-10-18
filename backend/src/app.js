const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { ExpressAdapter } = require('ask-sdk-express-adapter');
const config = require('./config');
const { buildSkill } = require('./alexa/skill');
const { runCommand } = require('./commands/router');
const youtube = require('./services/youtube');
const { getStore, getStoreProblem } = require('./store');
const realtime = require('./realtime');

const WEB_DIST = path.join(__dirname, '..', '..', 'web', 'dist');

function requireApiKey(req, res, next) {
  if (config.apiKey && req.get('x-api-key') !== config.apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

function createApp(options = {}) {
  const verify = options.verifyAlexaSignature ?? config.verifyAlexaSignature;
  const app = express();

  // Alexa endpoint. The adapter checks Amazon's request signature and timestamp,
  // which Amazon requires for skills hosted outside AWS Lambda.
  const adapter = new ExpressAdapter(buildSkill(config.alexaSkillId), verify, verify);
  app.post('/alexa', adapter.getRequestHandlers());

  app.use(cors());
  app.use(express.json());

  // For uptime checks and the keep-awake pinger.
  app.get('/health', (req, res) => {
    const problem = getStoreProblem();
    res.json({ ok: true, store: getStore().kind, ...(problem && { problem }), time: new Date().toISOString() });
  });

  // Lets the website check its saved API key before connecting.
  app.get('/api/auth', requireApiKey, (req, res) => res.json({ ok: true }));

  // Text commands from the website chat box and the phone app.
  app.post('/api/command', requireApiKey, async (req, res) => {
    const text = req.body && req.body.text;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Send JSON like {"text": "hello"}' });
    }
    res.json(await runCommand(text, { source: 'text' }));
  });

  // The website's own YouTube search box.
  app.get('/api/youtube/search', requireApiKey, async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing q' });
    try {
      const videos = await youtube.searchVideos(q);
      if (videos === null) return res.status(501).json({ error: 'YOUTUBE_API_KEY is not set' });
      res.json({ videos });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  // Lists shown on the dashboard. Voice and typed commands change them through the router;
  // these let the dashboard add and tick off to-dos directly.
  app.get('/api/todos', requireApiKey, async (req, res) => res.json({ todos: await getStore().todos.list() }));

  app.post('/api/todos', requireApiKey, async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Missing text' });
    const todo = await getStore().todos.add(text);
    await realtime.notifyChanged('todos');
    res.status(201).json({ todo });
  });

  app.post('/api/todos/:id/done', requireApiKey, async (req, res) => {
    const todo = await getStore().todos.complete(req.params.id);
    if (!todo) return res.status(404).json({ error: 'Not found' });
    await realtime.notifyChanged('todos');
    res.json({ todo });
  });

  app.get('/api/reminders', requireApiKey, async (req, res) => res.json({ reminders: await getStore().reminders.upcoming() }));

  // Dashboards poll this every couple of seconds. It also marks the screen as
  // connected, so voice commands know someone is watching.
  app.get('/api/events', requireApiKey, async (req, res) => {
    const store = getStore();
    const screen = String(req.query.screen || '').slice(0, 64);
    const since = new Date(String(req.query.since || ''));
    const now = new Date();
    if (screen) await store.screens.seen(screen);
    const events = Number.isNaN(since.getTime()) ? [] : await store.events.since(since);
    res.json({ events, now: now.toISOString() });
  });

  app.get('/api/history', requireApiKey, async (req, res) => res.json({ history: await getStore().history.recent(50) }));

  // Express 5 passes rejected async handlers here.
  app.use('/api', (err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });

  // The React dashboard, built into web/dist.
  if (fs.existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST));
    app.get(/^\/(?!api\/|alexa|health).*/, (req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
  }

  return app;
}

module.exports = { createApp };
