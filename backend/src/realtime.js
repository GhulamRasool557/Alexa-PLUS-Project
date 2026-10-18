// Link to every open dashboard (website, TV, phone browser).
// Events are written to the store and dashboards poll /api/events for them, so
// this works on serverless hosts (Vercel) as well as an always-on server.
const { getStore } = require('./store');

// A screen counts as connected if it polled within this window.
const SCREEN_TIMEOUT_MS = 15000;

const screenCount = () => getStore().screens.countActive(SCREEN_TIMEOUT_MS);

const publish = (type, data) => getStore().events.add({ type, data, at: new Date() });

// Something a screen must do, e.g. play a video or open a tab.
const sendToScreens = (action) => publish('action', action);

// A finished command, shown in every dashboard's command log.
const sendResultToScreens = (result) => publish('result', result);

// Tell dashboards to refresh a list ("todos", "reminders").
const notifyChanged = (what) => publish('changed', what);

module.exports = { screenCount, sendToScreens, sendResultToScreens, notifyChanged, SCREEN_TIMEOUT_MS };
