import { useState } from 'react'
import { searchYouTube } from '../api'

export default function YouTubePanel({ video, results, onPlay, onResults, onClose }) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function search(e) {
    e.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    setError('')
    try {
      const { videos } = await searchYouTube(query)
      onResults(videos)
    } catch (err) {
      setError(err.status === 501 ? 'YouTube search needs YOUTUBE_API_KEY on the server.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel youtube">
      <header className="panel-head">
        <h2>YouTube</h2>
        <button className="ghost" onClick={onClose}>Close</button>
      </header>

      {video && (
        <div className="player">
          <iframe
            key={video.videoId}
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
          <p className="now-playing">{video.title} <span>{video.channel}</span></p>
        </div>
      )}

      <form className="row" onSubmit={search}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search YouTube" />
        <button disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      {error && <p className="error">{error}</p>}

      {results.length > 0 && (
        <ul className="results">
          {results.map((v) => (
            <li key={v.videoId}>
              <button className={v.videoId === video?.videoId ? 'result active' : 'result'} onClick={() => onPlay(v)}>
                {v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" />}
                <span className="result-title">{v.title}</span>
                <span className="result-channel">{v.channel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
