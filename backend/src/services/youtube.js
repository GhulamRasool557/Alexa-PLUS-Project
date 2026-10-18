const config = require('../config');

// Alexa gives up after ~8 seconds, so never wait long on YouTube.
const TIMEOUT_MS = 3500;

async function searchVideos(query, maxResults = 8) {
  if (!config.youtubeApiKey) return null;
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    maxResults: String(maxResults),
    q: query,
    key: config.youtubeApiKey,
  });
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
  const data = await res.json();
  return data.items.map((item) => ({
    videoId: item.id.videoId,
    title: decodeEntities(item.snippet.title),
    channel: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url,
  }));
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

module.exports = { searchVideos };
