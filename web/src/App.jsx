import { useCallback, useEffect, useState } from 'react'
import { checkAuth, getHistory, getReminders, getTodos, setApiKey } from './api'
import { useJarvisSocket } from './useJarvisSocket'
import YouTubePanel from './components/YouTubePanel'
import ChatPanel from './components/ChatPanel'
import TodoPanel from './components/TodoPanel'
import RemindersPanel from './components/RemindersPanel'
import './App.css'

const MAX_LOG = 50

const QUICK_LINKS = [
  { label: 'Google', url: 'https://www.google.com' },
  { label: 'Claude', url: 'https://claude.ai/new' },
  { label: 'WhatsApp', url: 'https://web.whatsapp.com' },
  { label: 'VS Code', url: 'https://vscode.dev' },
]

export default function App() {
  const [auth, setAuth] = useState('checking') // checking | needed | ok
  const [activated, setActivated] = useState(false)
  const [log, setLog] = useState([])
  const [youtube, setYoutube] = useState({ open: false, video: null, results: [] })
  const [blockedUrl, setBlockedUrl] = useState(null)
  const [todos, setTodos] = useState([])
  const [reminders, setReminders] = useState([])

  const loadTodos = useCallback(() => getTodos().then((r) => setTodos(r.todos), console.error), [])
  const loadReminders = useCallback(() => getReminders().then((r) => setReminders(r.reminders), console.error), [])

  useEffect(() => {
    checkAuth().then(
      () => setAuth('ok'),
      (err) => setAuth(err.status === 401 ? 'needed' : 'ok'),
    )
  }, [])

  const onAction = useCallback((action) => {
    switch (action.type) {
      case 'youtube-open':
        setYoutube((y) => ({ ...y, open: true }))
        break
      case 'youtube-play':
        setYoutube({ open: true, video: action.video, results: action.results || [] })
        break
      case 'youtube-stop':
        setYoutube((y) => ({ ...y, video: null }))
        break
      case 'open-url': {
        const tab = window.open(action.url, '_blank')
        if (tab) tab.opener = null
        else setBlockedUrl(action.url)
        break
      }
      default:
        console.warn('Unknown action', action)
    }
  }, [])

  const onResult = useCallback((result) => setLog((l) => [...l, result].slice(-MAX_LOG)), [])

  const onChanged = useCallback(
    (what) => {
      if (what === 'todos') loadTodos()
      if (what === 'reminders') loadReminders()
    },
    [loadTodos, loadReminders],
  )

  useEffect(() => {
    if (auth !== 'ok') return
    loadTodos()
    loadReminders()
    getHistory().then((r) => setLog(r.history), console.error)
  }, [auth, loadTodos, loadReminders])

  const status = useJarvisSocket({ enabled: auth === 'ok', onAction, onResult, onChanged })

  if (auth === 'checking') return <main className="center">Connecting…</main>
  if (auth === 'needed') return <KeyForm onSaved={() => setAuth('ok')} />

  return (
    <main className="app">
      <header className="top">
        <h1>Jarvis</h1>
        <span className={`status ${status}`}>{status === 'online' ? 'Live' : status === 'offline' ? 'Offline' : 'Connecting'}</span>
      </header>

      {!activated && (
        <button className="activate" onClick={() => setActivated(true)}>
          Tap once to let Jarvis play sound and open tabs on this screen
        </button>
      )}

      {blockedUrl && (
        <div className="notice">
          Your browser blocked a new tab. Allow pop-ups for this site, then{' '}
          <a href={blockedUrl} target="_blank" rel="noreferrer" onClick={() => setBlockedUrl(null)}>open it here</a>.
        </div>
      )}

      <nav className="launcher">
        <button onClick={() => setYoutube((y) => ({ ...y, open: true }))}>YouTube</button>
        {QUICK_LINKS.map((link) => (
          <a key={link.label} className="button" href={link.url} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </nav>

      <div className="grid">
        {youtube.open ? (
          <YouTubePanel
            video={youtube.video}
            results={youtube.results}
            onPlay={(video) => setYoutube((y) => ({ ...y, video }))}
            onResults={(results) => setYoutube((y) => ({ ...y, results }))}
            onClose={() => setYoutube({ open: false, video: null, results: [] })}
          />
        ) : (
          <section className="panel idle">
            <p>Say "Alexa, open Jarvis", then try "play lofi music", "search for the weather in Lahore" or "open WhatsApp".</p>
          </section>
        )}
        <div className="side">
          <ChatPanel log={log} />
          <TodoPanel todos={todos} onChange={loadTodos} />
          <RemindersPanel reminders={reminders} />
        </div>
      </div>
    </main>
  )
}

function KeyForm({ onSaved }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    setApiKey(key.trim())
    try {
      await checkAuth()
      onSaved()
    } catch {
      setError('That key was not accepted.')
    }
  }

  return (
    <main className="center">
      <form className="panel key-form" onSubmit={save}>
        <h1>Jarvis</h1>
        <p>Enter your API key once on this screen.</p>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="API key" autoFocus />
        <button>Unlock</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  )
}
