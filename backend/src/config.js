require('dotenv').config({ quiet: true });

module.exports = {
  port: Number(process.env.PORT) || 3000,
  // Your skill's ID from the Alexa developer console. When set, requests from any other skill are rejected.
  alexaSkillId: process.env.ALEXA_SKILL_ID || '',
  // Keep true in production. Set to "false" only for local testing with fake requests.
  verifyAlexaSignature: process.env.VERIFY_ALEXA_SIGNATURE !== 'false',
  // Shared secret for the website and phone app's text commands.
  apiKey: process.env.API_KEY || '',
};

// YouTube Data API v3 key (Google Cloud console). Optional: without it, Jarvis reads YouTube's results page instead.
module.exports.youtubeApiKey = process.env.YOUTUBE_API_KEY || '';

// MongoDB Atlas connection string. Without it, data is kept in memory only.
module.exports.mongodbUri = process.env.MONGODB_URI || '';
