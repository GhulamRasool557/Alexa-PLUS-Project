// Vercel serverless entry: every /alexa, /health and /api/* request lands here
// (see vercel.json). The website itself is served as static files from web/dist.
const { createApp } = require('../backend/src/app');
const { connectStore } = require('../backend/src/store');

const app = createApp();

module.exports = async (req, res) => {
  try {
    await connectStore();
  } catch (err) {
    console.error('Could not connect to MongoDB:', err.message);
  }
  return app(req, res);
};
