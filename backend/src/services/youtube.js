const config = require('../config');

// Alexa gives up after ~8 seconds, so never wait long on YouTube.
const TIMEOUT_MS = 3500;

// Returns videos, or null when YouTube can't be searched (the caller then
// opens youtube.com instead).
async function searchVideos(query, maxResults = 8) {
  if (!config.youtubeApiKey) return searchWithoutKey(query, maxResults);
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

// No API key: read the videos out of YouTube's own results page. This is not
// an official API, so any failure just returns null.
async function searchWithoutKey(query, maxResults) {
  try {
    const url = `https://www.youtube.com/results?hl=en&search_query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'accept-language': 'en-US,en;q=0.9', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const videos = parseResultsPage(await res.text()).slice(0, maxResults);
    return videos.length ? videos : null;
  } catch (err) {
    console.error('YouTube page search failed:', err.message);
    return null;
  }
}

function parseResultsPage(html) {
  const match = html.match(/ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!match) return [];
  const videos = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    const r = node.videoRenderer;
    if (r?.videoId) {
      videos.push({
        videoId: r.videoId,
        title: r.title?.runs?.[0]?.text || '',
        channel: r.ownerText?.runs?.[0]?.text || '',
        thumbnail: r.thumbnail?.thumbnails?.[0]?.url,
      });
      return;
    }
    for (const value of Object.values(node)) walk(value);
  })(JSON.parse(match[1]));
  return videos;
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

module.exports = { searchVideos, parseResultsPage };
