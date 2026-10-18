import { useEffect, useRef, useState } from 'react'
import { sendCommand } from '../api'

export default function ChatPanel({ log }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const end = useRef(null)

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [log.length])

  async function submit(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setText('')
    setError('')
    try {
      // The reply comes back over the live connection, so it lands in the log
      // the same way a voice command does.
      await sendCommand(value)
    } catch (err) {
      setError(err.message)
      setText(value)
    }
  }

  return (
    <section className="panel chat">
      <header className="panel-head">
        <h2>Commands</h2>
      </header>
      <ol className="log">
        {log.length === 0 && <li className="empty">Say "Alexa, open Jarvis" or type below.</li>}
        {log.map((entry, i) => (
          <li key={i}>
            <p className="you">
              <span className="source">{entry.source === 'alexa' ? 'Voice' : 'Typed'}</span> {entry.text || '(nothing)'}
            </p>
            <p className="jarvis">
              {entry.speech} {entry.display && <span className="display">{entry.display}</span>}
            </p>
          </li>
        ))}
        <li ref={end} />
      </ol>
      <form className="row" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder='Try "play lofi music"' />
        <button>Send</button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  )
}
