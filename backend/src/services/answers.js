// Short spoken answers for "search ..." / "what is ..." commands.
// Free sources with no API key: DuckDuckGo Instant Answers, then Wikipedia.
// Full results always open on the screen, so a missing answer is fine.

// Both sources run in parallel; Wikipedia makes two calls, so the worst case is ~4s,
// well inside Alexa's 8-second limit.
const TIMEOUT_MS = 2000;
const HEADERS = { 'user-agent': 'JarvisAssistant/1.0 (personal Alexa skill)' };

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url.hostname} answered ${res.status}`);
  return res.json();
}

async function fromDuckDuckGo(query) {
  const url = new URL('https://api.duckduckgo.com/');
  url.search = new URLSearchParams({ q: query, format: 'json', no_html: '1', skip_disambig: '1' });
  const data = await getJson(url);
  return data.Answer || data.AbstractText || null;
}

async function fromWikipedia(query) {
  const search = new URL('https://en.wikipedia.org/w/api.php');
  search.search = new URLSearchParams({ action: 'query', list: 'search', srsearch: query, srlimit: '1', format: 'json' });
  const hit = (await getJson(search)).query?.search?.[0];
  if (!hit) return null;
  const summary = await getJson(new URL(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`));
  return summary.extract || null;
}

// Keep it to what Alexa can say in a breath: the first sentence or two.
function shorten(text, max = 220) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  let out = '';
  for (const s of sentences) {
    if ((out + s).length > max) break;
    out += s;
  }
  return (out || clean.slice(0, max).replace(/\s\S*$/, '') + '…').trim();
}

async function quickAnswer(query) {
  const attempt = (source) =>
    source(query).catch((err) => {
      console.error('Answer lookup failed:', err.message);
      return null;
    });
  const [ddg, wiki] = await Promise.all([attempt(fromDuckDuckGo), attempt(fromWikipedia)]);
  const answer = ddg || wiki;
  return answer ? shorten(answer) : null;
}

module.exports = { quickAnswer, shorten };
